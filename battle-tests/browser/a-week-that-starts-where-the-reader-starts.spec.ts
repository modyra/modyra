/**
 * The day a week starts on, which is not the same day everywhere.
 *
 * A calendar that opens on the wrong first day is wrong in a way nobody reports as a bug. Every date
 * is still in the grid, the month is still right, and a reader who has never seen a Sunday-first
 * calendar simply counts the columns wrong once and picks the day beside the one they meant.
 *
 * `Intl.Locale` answers this per locale — `getWeekInfo().firstDay`, 1 for Monday and 7 for Sunday —
 * and the browser running the page is the same authority the renderer can consult. So the check is a
 * differential against the platform rather than a table of days kept here, which would be a second
 * opinion about the calendars of the world and would go stale the first time one of them changed.
 *
 * Six locales, chosen because they disagree: Sunday-first, Monday-first and a Saturday-first one, in
 * two scripts and two writing directions.
 *
 * The day names and the month are checked as well, because a grid can start on the right day and
 * still be labelled in the wrong language — the two come from different places and only one of them
 * is a number.
 */

import { expect, test } from "@playwright/test";

/** Locales that disagree about where a week starts, with the day names as the reader sees them. */
const LOCALES = ["en-US", "it-IT", "de-DE", "fr-FR", "ar-EG", "ja-JP"];

test("a calendar starts the week where the reader's locale starts it", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  for (const locale of LOCALES) {
    const id = `cal-${locale}`;
    const outcome = await page.evaluate(({ mountId, loc }) =>
      (window as never as Record<string, { mountDocument(i: string, e: unknown): { mounted: boolean } }>).battle
        .mountDocument(mountId, {
          version: 3,
          fields: [{ name: "d", kind: "datepicker", label: "D", initialValue: "2026-04-03", locale: loc }],
        }), { mountId: id, loc: locale });

    expect(outcome.mounted, `the document for ${locale} did not mount`).toBe(true);
    await page.waitForTimeout(220);
    await page.locator(`[data-form="${id}"] button`).first().click();
    await page.waitForTimeout(360);

    const seen = await page.evaluate(({ sel, loc }) => {
      const root = document.querySelector(sel);
      if (root === null) return null;
      const headers = Array.from(root.querySelectorAll("th, [role='columnheader']"))
        .map((each) => (each.textContent ?? "").trim())
        .filter((text) => text !== "");
      const locale = new Intl.Locale(loc) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
      };
      const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? null;
      // The same day, named the way this locale names it, to compare against the first column.
      const named = (day: number) => new Intl.DateTimeFormat(loc, { weekday: "narrow" })
        // 2026-04-05 is a Sunday, so day 7 lands on it and day 1 on the Monday after.
        .format(new Date(Date.UTC(2026, 3, 5 + (day % 7))));
      const month = new Intl.DateTimeFormat(loc, { month: "long" }).format(new Date(Date.UTC(2026, 3, 3)));
      return {
        headers: headers.slice(0, 7),
        expectedFirst: firstDay === null ? null : named(firstDay),
        month,
        text: (root.textContent ?? "").replace(/\s+/g, " "),
      };
    }, { sel: `[data-form="${id}"]`, loc: locale });

    expect(seen, `no calendar was found for ${locale}`).not.toBeNull();

    // The premise: a week of column headers was drawn at all.
    expect(seen!.headers, `${locale} drew ${seen!.headers.length} day headings`).toHaveLength(7);

    expect(
      seen!.headers[0],
      `${locale} starts its week on ${seen!.headers[0]} where the platform starts it on ${seen!.expectedFirst}`,
    ).toBe(seen!.expectedFirst);

    // And the month is named in the reader's language, which is the other half of a localized
    // calendar and comes from somewhere else.
    expect(
      seen!.text.toLowerCase(),
      `${locale} did not name the month as ${seen!.month}`,
    ).toContain(seen!.month.toLowerCase());

    await page.evaluate(({ mountId }) =>
      (window as never as Record<string, { dispose(i: string): void }>).battle.dispose(mountId), { mountId: id });
    await page.waitForTimeout(80);
  }
});
