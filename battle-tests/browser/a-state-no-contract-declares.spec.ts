/**
 * A control announcing a state its kind says it does not have — asked of the page.
 *
 * `undeclared-states.battle.test.mjs` asks this of the projection: does what a controller produces
 * assert only the states `stateCarriers` declares? It is green. This asks it of the document a
 * browser was given, which is a different layer and can differ — a renderer adds attributes the
 * projection never named, and only the page shows that.
 *
 * The table's own words are the standard, and A11Y-004's evidence repeats them: *an undeclared state
 * asserted is as much a defect as a declared state unchecked*. So each element carrying a part's
 * class is checked against that part's declared states.
 *
 * Kinds and parts come from `MDY_WIDGET_CONTRACTS`, so a part that gains or loses a state moves this
 * spec with it, and every kind is mounted with a disabled option where its kind takes options —
 * because the state most likely to be asserted without being declared is the one a document can ask
 * for.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** The ARIA attributes that carry a state, and the state each one carries. */
const ARIA_STATES: Record<string, string> = {
  "aria-disabled": "disabled",
  "aria-readonly": "readonly",
  "aria-invalid": "invalid",
  "aria-selected": "selected",
  "aria-expanded": "open",
  "aria-checked": "checked",
};

type PartMap = Record<string, { classes?: string[]; states?: string[] }>;

for (const host of HOSTS) {
  test(`${host.name}: a part asserts only the states its kind declares`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const undeclared: string[] = [];
    let checked = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const parts = ((MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: PartMap }>)[kind]?.parts) ?? {};
      const id = `states-${kind}`;
      await page.evaluate(
        ({ mountId, k, api }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
          if (/select|radio|segmented/.test(k)) {
            field.options = [{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }];
          }
          (window as never as Record<string, { mountFields(id: string, f: unknown[], o?: unknown): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api },
      );
      await page.waitForTimeout(150);

      const found = await page.evaluate(({ selector, partMap, aria }) => {
        const root = document.querySelector(selector);
        if (root === null) return { seen: 0, wrong: [] as string[] };
        const wrong: string[] = [];
        let seen = 0;
        for (const [part, spec] of Object.entries(partMap as PartMap)) {
          for (const cls of spec.classes ?? []) {
            for (const element of Array.from(root.querySelectorAll(`.${cls}`))) {
              seen += 1;
              for (const [attribute, state] of Object.entries(aria)) {
                const value = element.getAttribute(attribute);
                // Only an asserted state counts: `aria-disabled="false"` says the opposite.
                if (value === null || value === "false") continue;
                if (!(spec.states ?? []).includes(state)) {
                  wrong.push(`${part} ${attribute}="${value}" (declared: ${JSON.stringify(spec.states ?? [])})`);
                }
              }
            }
          }
        }
        return { seen, wrong: [...new Set(wrong)] };
      }, { selector: `[data-form="${id}"]`, partMap: parts, aria: ARIA_STATES });

      checked += found.seen;
      for (const each of found.wrong) undeclared.push(`${kind}: ${each}`);

      await page.evaluate(
        ({ mountId, api }) => (window as never as Record<string, { dispose?: (id: string) => void }>)[api].dispose?.(mountId),
        { mountId: id, api: host.api },
      );
      await page.waitForTimeout(100);
    }

    // The control: parts were found and read. A selector that matched nothing would report nothing
    // undeclared and mean nothing by it.
    expect(checked, JSON.stringify({ checked, undeclared })).toBeGreaterThan(20);

    expect(undeclared, JSON.stringify(undeclared, null, 1)).toEqual([]);
  });
}
