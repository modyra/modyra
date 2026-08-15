/**
 * The three views a calendar has, and the way down through them.
 *
 * `MDY_CALENDAR_VIEW_MODES` publishes `days`, `months`, `years`, and two functions decide the moves
 * between them: `calendarViewOnToggle` for pressing the header, `calendarViewAfterPick` for choosing
 * something in the view you are in. Neither was named by anything in this suite.
 *
 * The path they describe is a drill-down rather than a cycle. From the days, the header goes straight
 * to the **years** — not to the months, which is what a reader expects if they assume each press
 * climbs one step. Choosing a year lands on the months of that year, choosing a month lands on its
 * days. Two presses out, two choices back.
 *
 * That shape is worth pinning precisely because it is not the obvious one: a renderer that "fixes" the
 * header to step days → months → years would be self-consistent, would look right in a screenshot, and
 * would leave anyone reaching for a year in 1997 pressing the header twice for the rest of the
 * product's life.
 *
 * Anything the functions do not recognise lands on the days, which is the view a calendar can always
 * draw.
 */

import { expect, test } from "@playwright/test";
import { MDY_CALENDAR_VIEW_MODES, calendarViewAfterPick, calendarViewOnToggle } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

test("the published moves between a calendar's views", () => {
  expect(MDY_CALENDAR_VIEW_MODES).toEqual(["days", "months", "years"]);

  // Pressing the header: out to the widest view, then back to the days from either of the others.
  expect(calendarViewOnToggle("days")).toBe("years");
  expect(calendarViewOnToggle("months")).toBe("days");
  expect(calendarViewOnToggle("years")).toBe("days");

  // Choosing something: one step down, and nowhere from the days because there is nowhere below.
  expect(calendarViewAfterPick("years")).toBe("months");
  expect(calendarViewAfterPick("months")).toBe("days");
  expect(calendarViewAfterPick("days")).toBe("days");

  // A view nobody declared is the days rather than nothing: a calendar can always draw those.
  expect(calendarViewOnToggle("nonsense")).toBe("days");
  expect(calendarViewAfterPick("nonsense")).toBe("days");
});

for (const host of HOSTS) {
  test(`a calendar goes where the moves say, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("cv", [{ name: "x", kind: "datepicker", label: "X", initialValue: "2026-04-03" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    for (const selector of ['[data-form="cv"] [aria-haspopup]', '[data-form="cv"] button', '[data-form="cv"] input']) {
      const candidate = page.locator(selector).first();
      if (await candidate.count() === 0) continue;
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      const open = await page.evaluate(() =>
        document.querySelector('[data-form="cv"] [aria-expanded="true"]') !== null);
      if (open) break;
    }

    /**
     * Which view is on screen, by the region the renderer shows.
     *
     * The regions are named by the part ids — a grid of days, a list of months, a list of years — so
     * this reads the view rather than guessing it from what the cells say.
     */
    const shown = () => page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll("[id]"))
        .filter((each) => /__(grid|months|years)$/.test(each.id) && each.getClientRects().length > 0)
        .map((each) => /__(grid|months|years)$/.exec(each.id)?.[1]);
      return visible.includes("grid") ? "days" : visible.includes("months") ? "months" : visible.includes("years") ? "years" : null;
    });

    expect(await shown(), "a datepicker did not open on its days").toBe("days");

    /**
     * A button inside the open calendar, found on the page rather than under the field.
     *
     * One renderer places its overlay outside the form's own container, so a scoped locator finds
     * none of the calendar's own buttons and reads an open calendar as an empty one.
     */
    const inCalendar = (text: RegExp) => page.locator("button").filter({ hasText: text });

    // The header is the toggle. From the days it goes to the widest view, not one step.
    const header = inCalendar(/\w+\s+\d{4}/).first();
    expect(await header.count(), "no header to press").toBeGreaterThan(0);
    await header.click();
    await page.waitForTimeout(340);

    expect(await shown(), "pressing the header from the days did not go where the published move says")
      .toBe(calendarViewOnToggle("days"));

    // And back down, one choice at a time.
    const year = inCalendar(/^\s*\d{4}\s*$/).nth(4);
    expect(await year.count(), "the years view offered no year to choose").toBeGreaterThan(0);
    await year.click();
    await page.waitForTimeout(340);
    expect(await shown(), "choosing a year did not land on that year's months").toBe(calendarViewAfterPick("years"));

    /**
     * And the year already shown, which is the same move.
     *
     * `calendarViewAfterPick` takes the view and nothing else: there is no case for "you picked the
     * one that was already selected". A calendar that treats it as a cancel sends someone who opened
     * the years to change the *month* back to the days without ever showing them.
     *
     * On its own field, because the walk above left this one on the days.
     */
    // The first field goes first: the locators below look across the page, because one renderer
    // places its overlay outside the field, and two calendars on a page make every one of them
    // ambiguous.
    await page.evaluate(({ api }) => {
      const battle = window as never as Record<string, { dispose(i: string): void; mountFields(i: string, f: unknown[]): unknown }>;
      battle[api].dispose("cv");
      battle[api].mountFields("same", [{ name: "x", kind: "datepicker", label: "X", initialValue: "2026-04-03" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    for (const selector of ['[data-form="same"] [aria-haspopup]', '[data-form="same"] button', '[data-form="same"] input']) {
      const candidate = page.locator(selector).first();
      if (await candidate.count() === 0) continue;
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      const open = await page.evaluate(() =>
        document.querySelector('[data-form="same"] [aria-expanded="true"]') !== null);
      if (open) break;
    }

    await inCalendar(/\w+\s+\d{4}/).first().click();
    await page.waitForTimeout(340);

    const current = inCalendar(/^\s*2026\s*$/).first();
    expect(await current.count(), "the years view does not offer the year the field holds").toBeGreaterThan(0);
    await current.click();
    await page.waitForTimeout(340);

    expect(
      await shown(),
      "picking the year already selected skipped the months, so a person changing only the month cannot reach them",
    ).toBe(calendarViewAfterPick("years"));

    const month = inCalendar(/^\s*[A-Za-zÀ-ÿ]{3,}\s*$/).first();
    expect(await month.count(), "the months view offered no month to choose").toBeGreaterThan(0);
    await month.click();
    await page.waitForTimeout(340);
    expect(await shown(), "choosing a month did not land on its days").toBe(calendarViewAfterPick("months"));
  });
}
