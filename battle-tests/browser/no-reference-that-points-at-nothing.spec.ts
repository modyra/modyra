/**
 * Every id an attribute names, in the states a widget only reaches when it is used.
 *
 * The suite already walks the ids a page names — at rest. A widget's inside does not exist then: a
 * calendar's grid, a dial's face and a listbox's options are built when the popup opens, and some of
 * them are replaced again when the view changes underneath.
 *
 * That is where a reference goes stale, and staleness is the worst shape of this defect. A missing
 * attribute is visible; an attribute naming an id that used to exist reads correctly in the markup,
 * survives every review of the element, and resolves to nothing only in the state a user reaches by
 * pressing something.
 *
 * So the same walk is done twice more: with each popup open, and again one view deeper — the calendar
 * header taken to the years, which replaces the grid the opener was naming.
 *
 * Two kinds of failure show up in that last state and both are here rather than described: a grid
 * whose label names an id nobody wrote, and an opener whose `aria-controls` still names the view it
 * has left.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The attributes whose value is an id, or a list of them. */
const REFERENCING = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-errormessage",
  "aria-activedescendant",
  "aria-owns",
  "for",
];

for (const host of HOSTS) {
  test(`no attribute names an id that is not there, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Every reference on the page that resolves to nothing. */
    const dangling = () => page.evaluate((attributes) => {
      const found: string[] = [];
      for (const attribute of attributes) {
        for (const element of Array.from(document.querySelectorAll(`[${attribute}]`))) {
          for (const reference of (element.getAttribute(attribute) ?? "").split(/\s+/).filter((each) => each !== "")) {
            if (document.getElementById(reference) === null) {
              found.push(`${element.tagName.toLowerCase()}[${attribute}=${reference}]`);
            }
          }
        }
      }
      return [...new Set(found)];
    }, REFERENCING);

    const whileOpen: string[] = [];
    const oneViewDeeper: string[] = [];
    let opened = 0;
    let drilled = 0;

    for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
      const id = `dv-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "Appointment", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(240);

      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(260);
        const isOpen = await page.evaluate((sel) =>
          document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`);
        if (isOpen) { opened += 1; break; }
      }

      whileOpen.push(...(await dangling()).map((each) => `${kind}: ${each}`));

      // One view deeper, where a calendar replaces the grid the opener was naming.
      const header = page.locator("button").filter({ hasText: /\w+\s+\d{4}/ }).first();
      if (await header.count() > 0) {
        await header.click().catch(() => undefined);
        await page.waitForTimeout(320);
        drilled += 1;
        oneViewDeeper.push(...(await dangling()).map((each) => `${kind}: ${each}`));
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(70);
    }

    // The controls: popups were opened and views were changed. A run that reached neither state would
    // report nothing dangling and mean nothing by it.
    expect(opened, "no popup opened, so no widget's inside was ever walked").toBeGreaterThan(3);
    expect(drilled, "no view was changed, so the state a reference goes stale in was never reached").toBeGreaterThan(0);

    expect(whileOpen, "an attribute names an id that is not on the page, with a popup open").toEqual([]);
    expect(
      oneViewDeeper,
      "an attribute names an id that is not on the page once the view under it changed",
    ).toEqual([]);
  });
}
