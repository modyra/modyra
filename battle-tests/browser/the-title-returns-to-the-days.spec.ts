/**
 * The header title that brings a calendar back to its days puts the keyboard on the day.
 *
 * From the days the title opens the years, and stays where it is: the keyboard stays on it. Pressed
 * again it shows the days, and a person who went back to the days went back to choose one, so the
 * keyboard lands on the grid's tab stop. Choosing a month and Escape land there already; the title is
 * the third way back, and a renderer that leaves the keyboard on the title makes it the only one that
 * costs a Tab.
 *
 * Claims under attack: ADR 0226.
 */

import { expect, test, type Page } from "@playwright/test";

import { HOSTS, SETTLES } from "./bench";

const open = (page: Page, form: string) => page.evaluate((id) =>
  document.querySelector(`[data-form="${id}"] [aria-expanded="true"]`) !== null, form);

async function mountAndOpen(page: Page, api: string, form: string, kind: "datepicker" | "daterange") {
  await page.evaluate(({ api, form, kind }) => {
    (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields(form, [kind === "datepicker"
        ? { name: "x", kind, label: "X", initialValue: "2026-04-03" }
        : { name: "x", kind, label: "X" }]);
  }, { api, form, kind });
  await page.waitForTimeout(320);

  for (const selector of [`[data-form="${form}"] [aria-haspopup]`, `[data-form="${form}"] button`, `[data-form="${form}"] input`]) {
    const candidate = page.locator(selector).first();
    if (await candidate.count() === 0) continue;
    await candidate.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
    if (await open(page, form)) break;
  }
  expect(await open(page, form), `the ${kind} did not open`).toBe(true);
}

/** The header's title button: the visible button whose text is a month and year, or a span of years. */
const titleButton = (page: Page) => page.locator("button:visible").filter({ hasText: /\d{4}/ })
  .filter({ hasNot: page.locator('[role="gridcell"]') }).first();

/** Whether the visible grid of days is showing. */
const daysShown = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[id$="__grid"]')).some((grid) => grid.getClientRects().length > 0));

/** Where the keyboard is: "day" for a cell of the grid, "title" for the title button, else a name. */
const where = (page: Page) => page.evaluate(() => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return "nothing";
  if (active.closest('[id$="__grid"]') !== null && active.getAttribute("role") === "gridcell") return "day";
  if (active.tagName === "BUTTON" && /\d{4}/.test(active.textContent ?? "") && active.closest('[id$="__grid"], [id$="__years"], [id$="__months"]') === null) return "title";
  return active.getAttribute("aria-label") ?? `${active.tagName.toLowerCase()} "${active.textContent?.trim().slice(0, 24)}"`;
});

for (const host of HOSTS) {
  for (const kind of ["datepicker", "daterange"] as const) {
    for (const press of ["click", "Enter"] as const) {
      test(`the title of a ${kind} back to the days lands on the day, by ${press}, ${host.name}`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

        const form = `tr-${kind}-${press.toLowerCase()}`;
        await mountAndOpen(page, host.api, form, kind);
        const pressTitle = async () => {
          const button = titleButton(page);
          if (press === "click") await button.click();
          else { await button.focus(); await page.keyboard.press("Enter"); }
        };

        await pressTitle();
        await expect.poll(() => daysShown(page), { message: "the title did not leave the days", ...SETTLES }).toBe(false);
        await page.waitForTimeout(200);
        expect(await open(page, form), "the title closed the popup").toBe(true);
        expect(await where(page), "the title that opened the years lost the keyboard").toBe("title");

        await pressTitle();
        await expect.poll(() => daysShown(page), { message: "the title did not bring the days back", ...SETTLES }).toBe(true);
        await page.waitForTimeout(200);
        expect(await open(page, form), "the title closed the popup").toBe(true);
        expect(await where(page), "the title that brought the days back left the keyboard off them").toBe("day");
      });
    }
  }
}
