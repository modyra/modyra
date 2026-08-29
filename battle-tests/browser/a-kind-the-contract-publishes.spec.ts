/**
 * Every kind the contract publishes renders something, in every renderer.
 *
 * `MDY_WIDGET_KINDS` is the published list of what a document may declare. A document is portable
 * because that list means the same thing everywhere: an author picks a kind, and whichever adapter
 * the page is built with draws a control. A kind one renderer never implemented makes the list a
 * description of one adapter and a promise the others do not keep.
 *
 * This is deliberately the weakest possible assertion — **something was drawn** — and it is written
 * that way on purpose. What a kind should look like is the business of the contract tests and of the
 * per-kind battles; whether it exists at all is measured by none of them, because every one of them
 * begins by finding the control. A check that starts by locating a thing cannot report that the
 * thing is absent: it finds nothing, skips, and the skip reads as a pass.
 *
 * The bar is the bare form element plus anything visible inside it. A renderer that mounts, throws
 * nothing, and leaves an empty form is the exact failure this exists to name.
 *
 * Claims under attack: UI-009, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`every published kind draws a control, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const empty: Array<Record<string, unknown>> = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `drawn_${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{
            name: "f",
            kind: k,
            label: "F",
            // Given to every kind: those that need choices get them, those that do not ignore them.
            // A kind reported as drawing nothing because the fixture starved it would be this
            // spec's defect rather than the renderer's.
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.waitForTimeout(320);

      const seen = await page.evaluate((mountId) => {
        const form = document.querySelector(`[data-form="${mountId}"]`);
        if (form === null) return { drew: 0, visible: 0, tags: [] as string[] };
        const all = [...form.querySelectorAll("*")];
        const visible = all.filter((each) => {
          const box = each.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        });
        return {
          drew: all.length,
          visible: visible.length,
          tags: [...new Set(visible.map((each) => each.tagName.toLowerCase()))].slice(0, 6),
        };
      }, id);

      // One visible node is the form itself. Anything inside it counts: this refuses absence, not
      // any particular anatomy.
      if (seen.visible <= 1) empty.push({ kind, ...seen });
    }

    expect(
      empty,
      `${host.name} draws nothing for ${empty.length} published kind(s):\n${JSON.stringify(empty, null, 1)}`,
    ).toEqual([]);
  });
}
