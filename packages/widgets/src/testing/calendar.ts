/**
 * What every calendar owes its user's locale, stated once for every renderer.
 *
 * A week does not begin on the same day everywhere. A renderer that fixes the first day to a
 * constant draws one locale's calendar for all of them — and it looks completely normal to whoever
 * wrote it, because it is right in their own locale. Nothing about such a calendar is malformed:
 * the parts are present, the ARIA is correct, the grid is a grid. Only the order is wrong, and only
 * against a locale nobody ran it in.
 *
 * The expectation is derived from `Intl` rather than from the renderer's own helper, so a renderer
 * cannot satisfy it by agreeing with itself.
 */
import { buildDateLocale } from "@modyra/core/datetime";

export const MDY_CALENDAR_ISSUE = {
  /** The week starts on a day the locale does not start on. */
  weekStartsWrong: "CALENDAR_WEEK_START_IGNORES_LOCALE",
} as const;

export type MdyCalendarIssueCode = (typeof MDY_CALENDAR_ISSUE)[keyof typeof MDY_CALENDAR_ISSUE];

export interface MdyCalendarIssue {
  readonly code: MdyCalendarIssueCode;
  readonly detail: string;
}

/**
 * The narrow weekday names a locale's calendar shows, in the order it shows them.
 *
 * 2024-01-01 was a Monday, which is the anchor the day arithmetic below counts from.
 */
export function expectedWeekdayOrder(locale: string): readonly string[] {
  const firstDay = buildDateLocale(locale).firstDayOfWeek;
  const format = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  return Array.from({ length: 7 }, (_, index) => {
    const day = ((firstDay + index + 6) % 7) + 1;
    return format.format(new Date(Date.UTC(2024, 0, day)));
  });
}

/**
 * Judges a rendered set of weekday headers against the locale they were rendered for.
 *
 * An empty result is a calendar that begins its week where its user's does.
 */
export function inspectCalendarWeekStart(
  rendered: readonly string[],
  locale: string,
): readonly MdyCalendarIssue[] {
  const expected = expectedWeekdayOrder(locale);
  if (rendered.length !== expected.length) {
    return [{
      code: MDY_CALENDAR_ISSUE.weekStartsWrong,
      detail: `expected ${expected.length} weekday headers for ${locale}, found ${rendered.length}`,
    }];
  }
  if (rendered.every((name, index) => name === expected[index])) return [];
  return [{
    code: MDY_CALENDAR_ISSUE.weekStartsWrong,
    detail: `${locale} starts its week on ${expected[0]}: expected ${expected.join(" ")}, rendered ${rendered.join(" ")}`,
  }];
}
