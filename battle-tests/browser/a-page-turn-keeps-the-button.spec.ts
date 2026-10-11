/**
 * Turning the page of a calendar from its header leaves the keyboard on the button that turned it.
 *
 * Next and Previous move the month the grid shows, and with it the day that is the grid's tab stop.
 * The focus is a different thing: a person pressing Next three times to reach a month three ahead
 * presses the same button three times. A renderer that answers the new tab stop by focusing the day
 * sends the second press into the grid, where it picks a date nobody chose.
 *
 * Previous is the sharper case. The day the calendar opened on is still drawn, as a day of the next
 * month, in the grid of the month before; a renderer that focuses the tab stop whenever it can see
 * it takes the keyboard there on the first press.
 *
 * The press is a click, which leaves the focus on the button in Chromium: it measures where the
 * renderer puts the keyboard after a page turn, whatever the button was pressed with.
 *
 * Claims under attack: ADR 0226.
 */

import { expect, test, type Page } from "@playwright/test";
import { MDY_I18N_PRESETS } from "@modyra/widgets";

import { HOSTS, SETTLES } from "./bench";

const open = (page: Page, form: string) => page.evaluate((id) =>
  document.querySelector(`[data-form="${id}"] [aria-expanded="true"]`) !== null, form);

async function mountAndOpen(page: Page, api: string, form: string, kind: "datepicker" | "daterange" = "datepicker") {
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
  expect(await open(page, form), "the datepicker did not open").toBe(true);
}

/** The header's month title, read so a press that did nothing is not mistaken for one that kept focus. */
const title = (page: Page) => page.locator("button").filter({ hasText: /\w+\s+\d{4}/ }).first().innerText();

/** A header paging button, found by the name the catalogue gives it in whichever locale the host runs. */
const pager = (page: Page, which: "next" | "previous") => {
  const names = Object.values(MDY_I18N_PRESETS)
    .map((messages) => which === "next" ? messages.datepickerNextMonth : messages.datepickerPreviousMonth);
  return page.locator(names.map((name) => `button[aria-label="${name}"]:visible`).join(", ")).first();
};

/** Where the keyboard is, as a name a failure can print: the focused control's label, or its text. */
const where = (page: Page) => page.evaluate(() => {
  const active = document.activeElement;
  return active?.getAttribute("aria-label") ?? `${active?.tagName.toLowerCase()} "${active?.textContent?.trim().slice(0, 24)}"`;
});

/** The grid's tab stops that can be seen: paging must keep exactly one, or the keyboard has no way in. */
const tabStops = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[id$="__grid"] [role="gridcell"][tabindex="0"]'))
    .filter((cell) => cell.getClientRects().length > 0).length);

for (const host of HOSTS) {
  for (const which of ["next", "previous"] as const) {
    test(`pressing ${which} twice keeps the keyboard on it, ${host.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      await mountAndOpen(page, host.api, `pt-${which}`);
      const button = pager(page, which);
      expect(await button.count(), `${host.name} drew no ${which} button`).toBeGreaterThan(0);
      const label = await button.getAttribute("aria-label");

      for (const press of ["first", "second"]) {
        const before = await title(page);
        await button.click();
        await expect.poll(() => title(page), { message: `the ${press} press of ${which} did not turn the page`, ...SETTLES })
          .not.toBe(before);
        await expect.poll(() => tabStops(page), { message: `the month ${which} reached has no single tab stop`, ...SETTLES })
          .toBe(1);
        // Settled: a renderer that moves the focus does it a frame or a tick after the page turns.
        await page.waitForTimeout(200);
        expect(await where(page), `the ${press} press of ${which} took the keyboard off it`).toBe(label);
      }
    });
  }
}

/*
 * The same page turn from the keyboard. Enter and Space activate a button; on a header button inside
 * the popup they turn the page and nothing else. The popup stays open, the keyboard stays on the
 * button, and the key does not travel on to the field or the dialog that holds the calendar.
 */
for (const host of HOSTS) {
  for (const kind of ["datepicker", "daterange"] as const) {
    for (const which of ["next", "previous"] as const) {
      for (const key of ["Enter", "Space"] as const) {
        test(`${key} on ${which} of a ${kind} twice turns the page and keeps the keyboard on it, ${host.name}`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.goto(host.page);
          await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

          const form = `pk-${kind}-${which}-${key.toLowerCase()}`;
          await mountAndOpen(page, host.api, form, kind);
          const button = pager(page, which);
          expect(await button.count(), `${host.name} drew no ${which} button`).toBeGreaterThan(0);
          const label = await button.getAttribute("aria-label");
          await button.focus();
          expect(await where(page), `${host.name} would not put the keyboard on ${which}`).toBe(label);

          for (const press of ["first", "second"]) {
            const before = await title(page);
            await page.keyboard.press(key);
            await expect.poll(() => open(page, form), { message: `${key} on ${which} closed the popup`, ...SETTLES })
              .toBe(true);
            await expect.poll(() => title(page), { message: `the ${press} ${key} on ${which} did not turn the page`, ...SETTLES })
              .not.toBe(before);
            await expect.poll(() => tabStops(page), { message: `the month ${which} reached has no single tab stop`, ...SETTLES })
              .toBe(1);
            await page.waitForTimeout(200);
            expect(await open(page, form), `${key} on ${which} closed the popup after it settled`).toBe(true);
            expect(await where(page), `the ${press} ${key} on ${which} took the keyboard off it`).toBe(label);
          }
        });
      }
    }
  }
}
