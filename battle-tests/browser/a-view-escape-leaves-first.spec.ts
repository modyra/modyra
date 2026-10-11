/**
 * Escape in a calendar's month or year view leaves that view before it closes anything.
 *
 * From the months or the years, Escape shows the days and puts the keyboard on the day grid, and the
 * popup stays open; a second Escape, now in the days, closes it. A person who went up to the years to
 * look and changed their mind gets back to where they started with one key, rather than losing the
 * calendar together with the view.
 *
 * Every renderer writes this rule by hand, so one that drifts — closing at once, or showing the days
 * with the focus left on a hidden year — stays green in its own suite. This spec holds them to the same
 * answer.
 *
 * The months case reaches its view by choosing a year from the keyboard, and where that choice leaves
 * the keyboard is a contract of its own: the keyboard follows the eye into the months. It has its own
 * case here, so a renderer that drops the keyboard there is named for that rather than for Escape.
 *
 * Claims under attack: UI-002, ADR 0225.
 */

import { expect, test, type Page } from "@playwright/test";
import { calendarViewAfterPick, calendarViewOnToggle } from "@modyra/widgets";

import { HOSTS, SETTLES } from "./bench";

/** Which view is on screen, read from the region the renderer shows rather than from the cells. */
const shown = (page: Page) => page.evaluate(() => {
  const visible = Array.from(document.querySelectorAll("[id]"))
    .filter((each) => /__(grid|months|years)$/.test(each.id) && each.getClientRects().length > 0)
    .map((each) => /__(grid|months|years)$/.exec(each.id)?.[1]);
  return visible.includes("grid") ? "days" : visible.includes("months") ? "months" : visible.includes("years") ? "years" : null;
});

/** Whether the keyboard is on a day, which is where Escape out of a wider view must leave it. */
const focusInDays = (page: Page) => page.evaluate(() =>
  document.activeElement?.closest('[id$="__grid"]') != null);

const open = (page: Page, form: string) => page.evaluate((id) =>
  document.querySelector(`[data-form="${id}"] [aria-expanded="true"]`) !== null, form);

async function mountAndOpen(page: Page, api: string, form: string) {
  await page.evaluate(({ api, form }) => {
    (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields(form, [{ name: "x", kind: "datepicker", label: "X", initialValue: "2026-04-03" }]);
  }, { api, form });
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

/**
 * A button inside the open calendar, found on the page rather than under the field: one renderer
 * places its overlay outside the form's own container.
 */
const inCalendar = (page: Page, text: RegExp) => page.locator("button").filter({ hasText: text });

for (const host of HOSTS) {
  test(`Escape in the years goes back to the days and only a second one closes, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mountAndOpen(page, host.api, "ey");
    expect(await shown(page), "the datepicker did not open on its days").toBe("days");

    await inCalendar(page, /\w+\s+\d{4}/).first().click();
    await expect.poll(() => shown(page), { message: "the header did not reach the years, so Escape is measuring nothing", ...SETTLES })
      .toBe(calendarViewOnToggle("days"));

    await page.keyboard.press("Escape");
    await expect.poll(() => shown(page), { message: "Escape in the years did not bring the days back", ...SETTLES }).toBe("days");
    expect(await open(page, "ey"), "Escape in the years closed the calendar instead of leaving the view").toBe(true);
    await expect.poll(() => focusInDays(page), { message: "Escape in the years left the keyboard off the days", ...SETTLES }).toBe(true);

    await page.keyboard.press("Escape");
    await expect.poll(() => open(page, "ey"), { message: "a second Escape, in the days, did not close the calendar", ...SETTLES }).toBe(false);
  });

  test(`Escape in the months goes back to the days, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mountAndOpen(page, host.api, "em");

    await inCalendar(page, /\w+\s+\d{4}/).first().click();
    await expect.poll(() => shown(page), SETTLES).toBe(calendarViewOnToggle("days"));
    // Chosen from the keyboard, so the press that follows starts where a keyboard user's would. A
    // pointer pick can leave the focus on the page, and an Escape from there measures the page.
    await inCalendar(page, /^\s*\d{4}\s*$/).nth(4).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => shown(page), { message: "choosing a year did not reach the months, so Escape is measuring nothing", ...SETTLES })
      .toBe(calendarViewAfterPick("years"));
    // Placed on a month by hand: where a pick leaves the keyboard is a contract of its own, held by
    // the case below, and this one measures Escape from the months whatever that answers.
    await page.locator('[id$="__months"] button:not([disabled])').first().focus();
    expect(await page.evaluate(() => document.activeElement?.closest('[id$="__months"]') != null),
      "no month took the keyboard, so Escape is measuring nothing").toBe(true);

    await page.keyboard.press("Escape");
    await expect.poll(() => shown(page), { message: "Escape in the months did not bring the days back", ...SETTLES }).toBe("days");
    expect(await open(page, "em"), "Escape in the months closed the calendar instead of leaving the view").toBe(true);
    await expect.poll(() => focusInDays(page), { message: "Escape in the months left the keyboard off the days", ...SETTLES }).toBe(true);
  });

  test(`choosing a year from the keyboard leaves the keyboard on the months, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mountAndOpen(page, host.api, "ek");

    await inCalendar(page, /\w+\s+\d{4}/).first().click();
    await expect.poll(() => shown(page), SETTLES).toBe(calendarViewOnToggle("days"));
    await inCalendar(page, /^\s*\d{4}\s*$/).nth(4).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => shown(page), SETTLES).toBe(calendarViewAfterPick("years"));
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[id$="__months"]') != null),
      { message: "choosing a year from the keyboard left the keyboard outside the months", ...SETTLES }).toBe(true);
  });

  test(`Escape on a year goes back to the days, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mountAndOpen(page, host.api, "eo");

    await inCalendar(page, /\w+\s+\d{4}/).first().click();
    await expect.poll(() => shown(page), SETTLES).toBe(calendarViewOnToggle("days"));
    await inCalendar(page, /^\s*\d{4}\s*$/).nth(4).focus();

    await page.keyboard.press("Escape");
    await expect.poll(() => shown(page), { message: "Escape on a year did not bring the days back", ...SETTLES }).toBe("days");
    expect(await open(page, "eo"), "Escape on a year closed the calendar instead of leaving the view").toBe(true);
    await expect.poll(() => focusInDays(page), { message: "Escape on a year left the keyboard off the days", ...SETTLES }).toBe(true);
  });
}
