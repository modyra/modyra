/**
 * What is left on the page after the field that owned it is gone.
 *
 * A popup is positioned against its trigger but does not live inside it: it is rendered at the end of
 * the document so that no ancestor's `overflow` can clip it. That is a deliberate arrangement, and it
 * carries a debt — the popup's only tie to the control is the code that built it. Ending the field
 * has to end the popup too, because nothing in the tree will do it as a side effect.
 *
 * When it does not, a person is left with a calendar. It is still in the page, still in the tab
 * order, still a grid a screen reader will walk, and it belongs to a control that no longer exists.
 * There is nothing to close it with: the trigger that would toggle it is gone, `Escape` reaches a
 * handler that was disposed, and clicking outside it does nothing because the listener that watched
 * for that went with the field. It is not a stale visual; it is an interactive region with no owner.
 *
 * The check is the whole page, not the field's own subtree. Scoping it to the field would pass by
 * construction — the field is exactly what was removed, so its subtree is empty whatever happened to
 * the popup, and the one arrangement this is about is the one that puts the popup elsewhere.
 *
 * Both halves are asserted so that neither way of being wrong reads as right:
 *
 *   - opening it must put something on the page, or the disposal proves nothing;
 *   - disposing must return the page to what it was before the mount.
 *
 * A renderer that failed to open anything would satisfy the second on its own.
 *
 * The count is taken against a baseline read before the mount rather than against zero, because the
 * host page is not empty and this spec is about what the field added, not about what the page holds.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

/** Kinds whose contract declares a popup. */
const KINDS = ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"];

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/**
 * Everything on the page that reads as an open overlay, wherever it sits.
 *
 * Counted document-wide and by role as well as by class: a renderer that leaves a grid behind under a
 * name this file did not predict is the case this exists to catch, so the net is the union of what
 * the three renderers call a popup and what the accessibility tree calls one.
 */
const overlays = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const selector = ".mdy-popup, [class*='__popup'], [class*='__dropdown'], [role='grid'], [role='listbox'], [role='dialog']";
  const visible = (element: Element) => {
    const style = getComputedStyle(element as HTMLElement);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if ((element as HTMLElement).hidden) return false;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      if (node.getAttribute("aria-hidden") === "true") return false;
    }
    return true;
  };
  return {
    open: Array.from(document.querySelectorAll(selector)).filter(visible).length,
    expanded: document.querySelectorAll("[aria-expanded='true']").length,
  };
});

for (const host of HOSTS) {
  for (const kind of KINDS) {
    test(`a popup does not outlive the field that owned it, ${kind}, ${host.name}`, async ({ page }) => {
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const before = await overlays(page);

      const id = `outlives_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [
          { name: "f", kind, label: "Campo", options },
        ] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });

      const trigger = page.locator(`${root} [aria-haspopup], ${root} .mdy-multiselect__trigger`).first();
      const opens = await trigger.count() > 0;
      // A kind whose trigger this file cannot find is reported as unreached rather than passed: the
      // disposal below would be measuring a popup that never opened.
      test.skip(!opens, `${host.name} published no opener for ${kind}`);

      await trigger.click({ timeout: 5_000 });
      await expect
        .poll(async () => (await overlays(page)).open, { timeout: 5_000 })
        .toBeGreaterThan(before.open);

      await page.evaluate(({ api, id }) => {
        (window as never as Api)[api].dispose?.(id as never);
      }, { api: host.api, id });

      await expect(page.locator(root)).toHaveCount(0, { timeout: 5_000 });

      const after = await overlays(page);
      expect(after.open, `${host.name} left ${after.open - before.open} open overlay(s) on the page after the ${kind} field was gone`)
        .toBe(before.open);
      expect(after.expanded, `${host.name} left ${after.expanded - before.expanded} element(s) still reporting aria-expanded="true" after the ${kind} field was gone`)
        .toBe(before.expanded);

      const dangling = await page.evaluate((api) => (window as never as Api)[api].danglingReferences() as unknown as string[], host.api);
      expect(dangling, `${host.name} left references naming ids nothing carries after the ${kind} field was gone`).toEqual([]);
    });
  }
}
