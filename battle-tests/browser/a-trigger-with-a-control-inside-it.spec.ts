/**
 * What lives inside the element that opens something.
 *
 * The strip of chosen chips is rendered inside the element that opens the popup, and that element is
 * a `<button>`. Each chip carries its own button that removes it, so the page holds a button inside a
 * button — which HTML's content model forbids.
 *
 * **This browser copes, and that is not a reason to keep it.** The prohibition is a *parser* rule, and
 * these elements are built with `createElement` and `appendChild`, which never go through the parser.
 * So the DOM keeps the nesting, the accessibility tree is built from that DOM, and every inner control
 * is present and named. The same markup arriving as text — server-rendered, hydrated, or copied into a
 * documentation page — is parsed, and the parser closes the outer button before the inner one, which
 * takes the chip strip out of the control and the remove buttons with it.
 *
 * So the defect is not what any one engine does with it today. It is that the structure is only
 * survivable by the route it happens to be built through.
 *
 * **Every kind that opens something is checked, not the one this was found on.** The sentence — *a
 * control that opens something contains no other control* — is not about chips: it is about what an
 * opener may hold, and a kind nobody has looked at can be built the same way. One is: a colour field
 * puts a native colour input inside its button, in one renderer, which is this arrangement in a
 * control that was never part of the conversation that produced the rule.
 *
 * **The property asserted is structural, and deliberately not geometric.** The visible symptom is that
 * a press aimed at the middle of the field can land on a chip's delete button, and how often that
 * happens is decided by how long the chosen label is — so a check written in terms of where things end
 * up passes for the words whoever wrote it thought of, and fails for a translation. *The opener has no
 * operable descendants* has no dependence on content, is true or false today, and forbids the whole
 * class rather than the instances someone imagined.
 *
 * It is asserted against the DOM rather than against the computed accessibility tree for the same
 * reason: the tree is one engine's opinion of this structure, and the structure is the thing under
 * attack.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`the element that opens something contains no other control, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Anything a person can press, focus or type into. */
    const OPERABLE = "button, a[href], input, select, textarea, [tabindex], [role='button'], [role='link'], [role='checkbox'], [role='menuitem']";

    const nested: string[] = [];
    let openers = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `nested_${kind}`;
      await page.evaluate(({ api, id, kind }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "f", kind, label: "Scelte", clearable: true,
          options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
          initialValue: kind === "multiselect" ? ["a", "b"] : undefined,
        }] as never);
      }, { api: host.api, id, kind });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(120);

      const found = await page.evaluate(({ selector, operable }) => {
        // Whatever opens something: the element carrying the promise, whichever part it is.
        const opener = document.querySelector(`${selector} [aria-haspopup]`);
        if (opener === null) return null;
        return {
          opener: `${opener.tagName.toLowerCase()}${opener.getAttribute("role") === null ? "" : `[role=${opener.getAttribute("role")}]`}`,
          inside: [...new Set(Array.from(opener.querySelectorAll(operable))
            .map((element) => `${element.tagName.toLowerCase()}.${element.className.split(/\s+/)[0]}`))],
        };
      }, { selector: root, operable: OPERABLE });

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      if (found === null) continue;
      openers += 1;
      if (found.inside.length > 0) {
        nested.push(`${kind}: ${found.opener} contains ${found.inside.join(", ")}`);
      }
    }

    // A run that found no opener would report no nesting for the wrong reason.
    expect(openers, `${host.name} drew no element promising to open anything`).toBeGreaterThan(2);

    expect(
      nested,
      `${host.name}: ${nested.length} opener(s) contain a control — ${nested.join("; ")}. `
      + "A press aimed at the opener can land on one of them, and which one is decided by content rather than by code.",
    ).toEqual([]);
  });
}
