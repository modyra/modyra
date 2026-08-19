/**
 * `aria-haspopup` is a promise made before anything opens.
 *
 * A screen reader announces it with the control — "combobox, has popup listbox" — so a person decides
 * whether to open the thing based on what they were told it is. `listbox` means options to choose
 * between. `grid` means a table to move around with the arrow keys. `dialog` means somewhere to go
 * and come back from.
 *
 * They are not interchangeable, and the value is only worth having if it is true. A control promising
 * `listbox` that opens a group of buttons has told the user there are options with a selected state
 * and a listbox's keyboard; there are neither.
 *
 * The check is the promise against what appears: whatever the opener says will open, something with
 * that role is on screen once it has.
 *
 * A field the browser draws is excluded — the platform makes both the promise and the popup.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`what a control promises is what opens, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const broken: string[] = [];
    let promised = 0;

    for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
      const id = `h-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(240);

      const promise = await page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-haspopup]`)?.getAttribute("aria-haspopup") ?? null,
        `[data-form="${id}"]`);

      // Nothing promised is nothing to hold to account — a native control, or an opener that says
      // only that it expands.
      if (promise === null || promise === "true" || promise === "false") {
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        continue;
      }
      promised += 1;

      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(280);
        const open = await page.evaluate((sel) =>
          document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`);
        if (open) break;
      }

      const onScreen = await page.evaluate(() =>
        [...new Set(Array.from(document.querySelectorAll("[role]"))
          .filter((each) => each.getClientRects().length > 0)
          .map((each) => each.getAttribute("role")))]);

      if (!onScreen.includes(promise)) {
        broken.push(`${kind}: promised ${promise}, opened ${JSON.stringify(onScreen.filter((each) => each !== "combobox"))}`);
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(70);
    }

    // The control: promises were made. A run where no opener said what it opens would find nothing
    // broken and mean nothing by it.
    expect(promised, "no control promised a kind of popup, so nothing was measured").toBeGreaterThan(2);

    expect(
      broken,
      "a control announces one kind of popup and opens another, so a person is told what to expect and gets something else",
    ).toEqual([]);
  });
}
