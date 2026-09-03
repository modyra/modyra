/**
 * A container query unit with no container is not an error. It is the viewport.
 *
 * `width: 100cqw` resolves against the nearest ancestor that declares `container-type`. With no such
 * ancestor the declaration is **not** invalid and is **not** ignored: the unit falls back to its
 * viewport equivalent, so `100cqw` silently becomes `100svw` — the full width of the window.
 *
 * In a control inside a form inside a page, that is the difference between a chip capped at its
 * field's width and a chip as wide as the screen. On every browser. With every checker green, because
 * there is nothing here for a browser-support linter to object to: the feature is supported, widely,
 * for years. It is being asked a question it has no ancestor to answer.
 *
 * **And the ancestor is found by walking the DOM, so anything that moves an element changes what the
 * unit means without touching the rule.** This library moves a popup out of its field on purpose, and
 * a `container-type` ancestor makes itself a containing block — the sheet says so beside both
 * declarations. That is exactly the shape where an element arrives somewhere its rule did not expect.
 *
 * ## Why this is measured rather than reviewed
 *
 * The support question — *may I use this* — is answered by a linter against a published baseline. This
 * is the other question, and no linter can reach it: **does the feature have, here, what it needs in
 * order to mean anything.** A rule can be perfectly supported and perfectly wrong.
 *
 * The selectors are read from the stylesheet rather than written here, so a rule that starts using a
 * container unit tomorrow is covered without anyone remembering to add it — and a rule that stops
 * using one takes itself out.
 *
 * ## The rules are read through the CSSOM, and that is the second thing this file is about
 *
 * A unit only exists before it is resolved — by the time a browser has computed a length it is pixels,
 * and `100cqw` answered by the viewport is indistinguishable from a correct one except by being wrong.
 * So the rules have to be read rather than the computed styles.
 *
 * **Read as text, they cannot be.** At least five constructions nest rules — `@layer`, `@media`,
 * `@supports`, `@container`, and native nesting with `&` — and a reader counting braces handles the
 * ones its author had met. The first version of this file was one: it counted braces, this sheet nests
 * inside `@layer`, and it reported that **no rule uses a container unit at all**. Which reads as good
 * news.
 *
 * `document.styleSheets` is the browser's own parse, and a descent that asks each rule for its
 * children walks every construction including the one added after this was written. The browser has
 * done the interpreting; redoing it is redoing a job that can only be got wrong.
 *
 * A sheet from another origin throws on `cssRules`, and that is **reported rather than skipped** —
 * silently passing over one is how a reader goes back to saying "nothing to look at" in the voice of
 * "nothing found".
 *
 * Claims under attack: UI-005, STY-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** A unit that answers to a query container rather than to the viewport. */
const CONTAINER_UNIT = /\b[0-9.]+cq(w|i|h|b|min|max)\b/;

for (const host of HOSTS) {
  test(`every container unit has a container above it, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const sheets = await page.evaluate(({ pattern }) => {
      const wanted = new RegExp(pattern);
      const selectors = new Set<string>();
      const unreadable: string[] = [];
      let rulesSeen = 0;

      // Every construction that nests rules holds them under `cssRules`, so the descent asks for the
      // property rather than for a list of types it happens to know. One added to CSS after this was
      // written carries its children the same way and is walked without this being edited.
      const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          rulesSeen += 1;
          const style = (rule as CSSStyleRule).style as CSSStyleDeclaration | undefined;
          if (style !== undefined && style !== null) {
            for (const property of Array.from(style)) {
              if (wanted.test(style.getPropertyValue(property))) {
                const selector = (rule as CSSStyleRule).selectorText;
                if (selector !== undefined && selector !== "") selectors.add(selector);
              }
            }
          }
          const nested = (rule as unknown as { cssRules?: CSSRuleList }).cssRules;
          if (nested !== undefined) walk(nested);
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules);
        } catch (error) {
          unreadable.push(`${sheet.href ?? "(inline)"}: ${String(error).slice(0, 60)}`);
        }
      }
      return { selectors: [...selectors], unreadable, rulesSeen };
    }, { pattern: CONTAINER_UNIT.source });

    // A sheet this reader could not open is a hole of exactly the shape this file refuses: it would
    // report "no rule uses one" while never having looked. Reported, never skipped.
    expect(
      sheets.unreadable,
      `${host.name}: ${sheets.unreadable.length} stylesheet(s) could not be read, so anything below `
      + `would be a statement about what was reachable rather than about the page:\n`
      + sheets.unreadable.join("\n"),
    ).toEqual([]);

    // A nested rule's `selectorText` carries its `&`, which no `querySelectorAll` accepts. Such a
    // selector cannot be checked from here and is **named** rather than passed over: skipping it
    // quietly would shrink the population and leave the file reporting on what it happened to be able
    // to ask about.
    const unqueryable = sheets.selectors.filter((one) => one.includes("&"));
    expect(
      unqueryable,
      `${host.name}: ${unqueryable.length} rule(s) using a container unit are written with native `
      + `nesting and cannot be resolved to elements from here — ${JSON.stringify(unqueryable)}. They `
      + "are the ones this file would otherwise be silent about.",
    ).toEqual([]);

    const selectors = sheets.selectors;

    // The premise, and it is the one that matters: **"the property holds" and "the property has no
    // instances" are the same green**, and one of them means this file read nothing. The count of
    // rules walked is in the message because it is what tells the two apart.
    expect(
      selectors.length,
      `${host.name} walked ${sheets.rulesSeen} rule(s) and found none using a container query unit. `
      + "Either no rule does — in which case this file has nothing to check and should say so — or "
      + "they are not being reached, which is what a brace-counting reader did with an @layer and what "
      + "an unopened sheet does in silence.",
    ).toBeGreaterThan(0);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("units", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true, reorderable: true,
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "a", "b"],
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="units"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    // Open it too. A popup leaves its field's ancestry on purpose, so anything drawn inside one is
    // where a unit is most likely to be resolving against something else.
    await page.locator('[data-form="units"] [aria-haspopup], [data-form="units"] [role="combobox"]')
      .first().click({ timeout: 4_000 }).catch(() => undefined);
    await page.waitForTimeout(400);

    const orphans = await page.evaluate(({ selectors }) => {
      const out: string[] = [];
      let checked = 0;
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          checked += 1;
          let at: Element | null = element.parentElement;
          let container: string | null = null;
          while (at !== null) {
            const type = getComputedStyle(at).containerType;
            if (type !== undefined && type !== "" && type !== "normal") {
              container = Array.from(at.classList).find((one) => one.startsWith("mdy-")) ?? at.tagName.toLowerCase();
              break;
            }
            at = at.parentElement;
          }
          if (container === null) {
            const box = element.getBoundingClientRect();
            out.push(`${selector} — drawn ${Math.round(box.width)}px wide in a ${window.innerWidth}px window`);
          }
        }
      }
      return { out: [...new Set(out)], checked };
    }, { selectors });

    // The second premise: those selectors matched something. A rule that uses a container unit and
    // draws nothing has no orphan to report, and the silence would read as safety.
    expect(
      orphans.checked,
      `${host.name}: ${selectors.length} selector(s) use a container unit and none of them matched an `
      + `element on the page — ${JSON.stringify(selectors)}. Nothing was measured.`,
    ).toBeGreaterThan(0);

    expect(
      orphans.out,
      `${host.name}: ${orphans.out.length} element(s) resolve a container query unit with no `
      + `container above them:\n${orphans.out.join("\n")}\n\n`
      + "The unit does not fail there — it falls back to the viewport, so a length meant to be a share "
      + "of a field becomes a share of the window. Nothing reports it: the feature is supported, the "
      + "declaration is valid, and the number is simply about something else.",
    ).toEqual([]);
  });
}
