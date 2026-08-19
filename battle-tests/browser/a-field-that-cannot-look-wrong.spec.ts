/**
 * A control the form has refused, and whether anything on the page says so.
 *
 * `MDY_STATE_EXPRESSION` publishes how each kind shows that it is unusable or wrong. Ten kinds carry a
 * modifier on `mdy-input-wrapper`; seven express it *structurally*, because their wrapper is their own
 * and the control below already carries the truth. Its own docblock names the risk that follows: the
 * style audit can only see the first mechanism, so "an audit that cannot see a mechanism cannot tell a
 * kind that *shows* it is disabled from one that merely claims to".
 *
 * This asks the page instead of a table. Every field is mounted with a `required` rule and left
 * untouched, so the form refuses it; then every rule in the stylesheets the page actually loaded is
 * read out of `document.styleSheets`, the ones whose selector reaches an error state are kept, and
 * each field is asked whether any of them matches something inside it.
 *
 * The host page carries no stylesheet of its own — it is a harness, not a demo — so the shipped ones
 * are added to it here and then read back out of `document.styleSheets`. That way the rules being
 * matched are the rules a browser parsed, not the text a file happened to contain, and a selector the
 * browser will not parse is skipped rather than counted.
 *
 * Two controls stand under it: the field really is refused — `aria-invalid="true"` is present — and
 * some kinds in the same renderer really are painted, so a kind that is not is that kind rather than
 * a page with no error styling in it.
 *
 * Claims under attack: UI-009, A11Y-004.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

const HERE = dirname(new URL(import.meta.url).pathname);
/** The stylesheets the package ships, as built. The host page carries none of its own. */
const SHIPPED = resolve(HERE, "..", "..", "packages", "styles", "dist");

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

const KINDS = ["text", "number", "checkbox", "toggle", "segmented", "radio", "select", "multiselect", "file"];
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`${host.name}: a field the form refused is one the page can paint`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const file of readdirSync(SHIPPED).filter((name) => name.endsWith(".css"))) {
      await page.addStyleTag({ content: readFileSync(join(SHIPPED, file), "utf8") });
    }

    // The rules the browser was actually given, not the ones the repository holds.
    const selectors = await page.evaluate(() => {
      const hooks = ["aria-invalid", "--error", "--invalid", ":invalid", "has-error"];
      const found = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try { rules = sheet.cssRules; } catch { continue; }
        const walk = (list: CSSRuleList) => {
          for (const rule of Array.from(list)) {
            const selector = (rule as CSSStyleRule).selectorText;
            if (typeof selector === "string" && hooks.some((h) => selector.includes(h))) found.add(selector);
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested !== undefined) walk(nested);
          }
        };
        walk(rules);
      }
      return [...found].filter((s) => !s.includes("::") && !s.includes(":focus") && s.length < 240);
    });

    // The premise: the page carries error styling at all.
    expect(selectors.length, "the page loaded no rule that reaches an error state").toBeGreaterThan(2);

    const unpainted: Array<Record<string, unknown>> = [];
    const painted: string[] = [];

    for (const kind of KINDS) {
      const id = `e-${kind}`;
      await page.evaluate(
        ({ mountId, k, api, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L", validators: { required: true } };
          if (/select|radio|segmented/.test(k)) field.options = options;
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api, options: OPTIONS },
      );
      await page.waitForTimeout(140);

      // Give it a turn, the way a person does, so a renderer that waits for that has had it.
      const first = page.locator(`[data-form="${id}"] input, [data-form="${id}"] select, [data-form="${id}"] button`).first();
      if (await first.count() > 0) {
        await first.focus().catch(() => undefined);
        await first.blur().catch(() => undefined);
      }
      await page.waitForTimeout(200);

      const seen = await page.evaluate(({ sel, rules }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        const refused = root.querySelectorAll('[aria-invalid="true"]').length > 0;
        let matches = 0;
        for (const rule of rules) {
          try {
            for (const element of Array.from(document.querySelectorAll(rule))) {
              if (element === root || root.contains(element)) { matches += 1; break; }
            }
          } catch { /* a selector this browser will not parse is not evidence either way */ }
        }
        return { refused, matches };
      }, { sel: `[data-form="${id}"]`, rules: selectors });

      if (seen === null) continue;
      // The premise for this kind: the form did refuse it. A kind that is not refused has nothing to
      // show and is not evidence.
      if (!seen.refused) continue;

      if (seen.matches > 0) painted.push(kind);
      else unpainted.push({ kind, refused: seen.refused, matches: seen.matches });
    }

    // The control: some kinds in this renderer are painted, so one that is not is that kind.
    expect(painted.length, JSON.stringify({ painted, unpainted })).toBeGreaterThan(2);

    expect(unpainted, JSON.stringify({ painted, unpainted }, null, 1)).toEqual([]);
  });
}
