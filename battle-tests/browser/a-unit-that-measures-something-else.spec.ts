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
 * @source-inspection — the authored sheet is where a unit still exists. By the time a browser has
 * computed a length it is pixels, and `100cqw` resolved against the viewport is indistinguishable from
 * a correct one except by being wrong.
 *
 * Claims under attack: UI-005, STY-001.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const HERE = dirname(new URL(import.meta.url).pathname);
const SHEET = join(resolve(HERE, "..", ".."), "packages", "styles", "src", "modyra.css");

/**
 * Selectors whose declarations use a container query unit.
 *
 * Read line by line rather than by matching rule bodies: the sheet nests inside `@layer` and
 * `@media`, and a brace-counting reader that does not know that reports zero rules and looks like
 * good news.
 */
const selectorsUsingContainerUnits = (): string[] => {
  const lines = readFileSync(SHEET, "utf8").split("\n");
  const found = new Set<string>();
  let selector: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("/*") || line.startsWith("*")) continue;
    if (line.endsWith("{")) {
      const head = line.slice(0, -1).trim();
      if (head !== "" && !head.startsWith("@")) selector = head;
      continue;
    }
    if (/\b[0-9.]+cq(w|i|h|b|min|max)\b/.test(line) && selector !== null) found.add(selector);
  }
  return [...found];
};

for (const host of HOSTS) {
  test(`every container unit has a container above it, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const selectors = selectorsUsingContainerUnits();

    // The premise, and it is the one that matters: a reader that found nothing would pass while
    // measuring nothing, and "no rule uses a container unit" is exactly what a broken reader says.
    expect(
      selectors.length,
      "no rule in the stylesheet was found using a container query unit. Either none does — in which "
      + "case this file has nothing to check and should say so — or the sheet is being read wrongly, "
      + "which is what a brace-counting reader does with an @layer.",
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
