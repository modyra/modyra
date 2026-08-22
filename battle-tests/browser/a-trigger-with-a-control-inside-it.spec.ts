/**
 * What lives inside the element that opens the list.
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

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`the element that opens the list contains no other control, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("nested", [{
        name: "s", kind: "multiselect", label: "Scelte",
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "b"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="nested"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(900);

    const inside = await page.evaluate(() => {
      const opener = document.querySelector('[data-form="nested"] .mdy-multiselect__trigger');
      if (opener === null) return null;
      const operable = "button, a[href], input, select, textarea, [tabindex], [role='button'], [role='link'], [role='checkbox'], [role='menuitem']";
      return {
        opener: `${opener.tagName.toLowerCase()}${opener.getAttribute("role") === null ? "" : `[role=${opener.getAttribute("role")}]`}`,
        found: Array.from(opener.querySelectorAll(operable))
          .map((element) => `${element.tagName.toLowerCase()}.${element.className.split(/\s+/)[0]}`),
      };
    });

    expect(inside, `${host.name} drew no opener to look inside`).not.toBeNull();
    expect(
      inside?.found,
      `${host.name}: ${inside?.opener} contains ${inside?.found.length} operable element(s) — ${[...new Set(inside?.found)].join(", ")}. `
      + "A press aimed at the opener can land on one of them, and which one is decided by how long a chosen label is.",
    ).toEqual([]);
  });
}
