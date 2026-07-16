/**
 * Pure utility functions for ISO 8601 date manipulation.
 *
 * All dates are represented as `YYYY-MM-DD` strings (ISO 8601 calendar date).
 * No `Date` object is exposed in the public API — parsing/formatting
 * happens internally to avoid timezone ambiguity.
 */

/** Parsed representation of a calendar date (all 1-based). */
export interface CalendarDate {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  /** 1–31 */
  readonly day: number;
}

/** A single cell in the calendar grid. */
export interface CalendarCell {
  readonly date: CalendarDate;
  /** ISO string `YYYY-MM-DD` for quick comparison. */
  readonly iso: string;
  /** True when the cell belongs to the displayed month. */
  readonly inMonth: boolean;
}

// ── Parsing / Formatting ──────────────────────────────────────────────────────

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse an ISO `YYYY-MM-DD` string. Returns `null` on invalid input. */
export function parseIsoDate(
  value: string | null | undefined,
): CalendarDate | null {
  if (!value) return null;
  const m = ISO_DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

/** Format a CalendarDate as `YYYY-MM-DD`. */
export function formatIsoDate(d: CalendarDate): string {
  const y = String(d.year).padStart(4, "0");
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get today's date as a CalendarDate. */
export function today(): CalendarDate {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

// ── Date Arithmetic ───────────────────────────────────────────────────────────

/** Number of days in a given month (1-based). */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of next month = last day of current month
  return new Date(year, month, 0).getDate();
}

/** Day of week for the 1st of the month (0 = Sunday, 6 = Saturday). */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Check if two CalendarDates represent the same day. */
export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Compare two CalendarDates. Returns <0, 0, or >0. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Check if a date falls within [min, max] (inclusive). Null bounds are ignored. */
export function isDateInRange(
  date: CalendarDate,
  min: CalendarDate | null,
  max: CalendarDate | null,
): boolean {
  if (min && compareDates(date, min) < 0) return false;
  if (max && compareDates(date, max) > 0) return false;
  return true;
}

/** Add months to a CalendarDate, clamping the day if needed. */
export function addMonths(d: CalendarDate, count: number): CalendarDate {
  let month = d.month + count;
  let year = d.year;
  // Normalize month to 1–12
  year += Math.floor((month - 1) / 12);
  month = ((((month - 1) % 12) + 12) % 12) + 1;
  const maxDay = daysInMonth(year, month);
  return { year, month, day: Math.min(d.day, maxDay) };
}

/** Add years to a CalendarDate, clamping Feb 29 if needed. */
export function addYears(d: CalendarDate, count: number): CalendarDate {
  const year = d.year + count;
  const maxDay = daysInMonth(year, d.month);
  return { year, month: d.month, day: Math.min(d.day, maxDay) };
}

/** Add days, returning a new CalendarDate. */
export function addDays(d: CalendarDate, count: number): CalendarDate {
  const dt = new Date(d.year, d.month - 1, d.day + count);
  return {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
  };
}

// ── Grid Generation ───────────────────────────────────────────────────────────

/**
 * Build a 6×7 calendar grid for the given month.
 *
 * @param year           Full year (e.g. 2026)
 * @param month          1-based month (1 = January)
 * @param firstDayOfWeek 0 = Sunday, 1 = Monday, …
 * @returns              42 CalendarCells (6 rows × 7 columns)
 */
export function buildMonthGrid(
  year: number,
  month: number,
  firstDayOfWeek: number,
): readonly CalendarCell[] {
  const totalDays = daysInMonth(year, month);
  const startWeekday = firstWeekday(year, month);

  // How many leading cells from the previous month
  const leadingBlanks = (startWeekday - firstDayOfWeek + 7) % 7;

  const cells: CalendarCell[] = [];

  // Previous month fill
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevDays = daysInMonth(prevYear, prevMonth);
  for (let i = leadingBlanks - 1; i >= 0; i--) {
    const day = prevDays - i;
    const date: CalendarDate = { year: prevYear, month: prevMonth, day };
    cells.push({ date, iso: formatIsoDate(date), inMonth: false });
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    const date: CalendarDate = { year, month, day: d };
    cells.push({ date, iso: formatIsoDate(date), inMonth: true });
  }

  // Next month fill (pad to 42)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    const date: CalendarDate = {
      year: nextYear,
      month: nextMonth,
      day: nextDay++,
    };
    cells.push({ date, iso: formatIsoDate(date), inMonth: false });
  }

  return cells;
}

// ── Range Helpers ─────────────────────────────────────────────────────────────

/**
 * Check if a date falls strictly between two dates (exclusive of endpoints).
 * Returns `false` when either bound is `null`.
 */
export function isDateBetween(
  date: CalendarDate,
  start: CalendarDate | null,
  end: CalendarDate | null,
): boolean {
  if (!start || !end) return false;
  return compareDates(date, start) > 0 && compareDates(date, end) < 0;
}

/**
 * Normalise a pair of dates so that `start <= end`.
 * Returns `[earlier, later]`. If either is `null` the pair is returned as-is.
 */
export function orderDates(
  a: CalendarDate | null,
  b: CalendarDate | null,
): readonly [CalendarDate | null, CalendarDate | null] {
  if (!a || !b) return [a, b] as const;
  return compareDates(a, b) <= 0 ? ([a, b] as const) : ([b, a] as const);
}

// ─── Localized typing ─────────────────────────────────────────────────────────

/**
 * Detects the day/month/year order for a BCP 47 locale from
 * `Intl.DateTimeFormat.formatToParts` (e.g. it-IT → d/m/y, en-US → m/d/y).
 * Falls back to d/m/y when Intl is unavailable.
 */
export function localeDateOrder(
  locale: string,
): readonly ["day" | "month" | "year", "day" | "month" | "year", "day" | "month" | "year"] {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(2001, 1, 3));
    const order = parts
      .map(p => p.type)
      .filter((t): t is "day" | "month" | "year" =>
        t === "day" || t === "month" || t === "year",
      );
    if (order.length === 3) return order as [
      "day" | "month" | "year",
      "day" | "month" | "year",
      "day" | "month" | "year",
    ];
  } catch {
    // fall through to the ISO-ish default
  }
  return ["day", "month", "year"];
}

/**
 * Parses a date typed in the locale's numeric format (`31/12/2026`,
 * `12/31/2026`, `31.12.2026`, …). ISO `YYYY-MM-DD` is always accepted.
 * Two-digit years map to 2000-2099. Returns `null` on anything invalid.
 */
export function parseLocalizedDate(
  raw: string | null | undefined,
  locale: string,
): CalendarDate | null {
  if (!raw) return null;
  const iso = parseIsoDate(raw.trim());
  if (iso) return iso;

  const numbers = raw.trim().split(/[^0-9]+/).filter(s => s.length > 0);
  if (numbers.length !== 3) return null;

  // A 4-digit token is the year regardless of position (e.g. "2026/12/31").
  const order = localeDateOrder(locale);
  const values: Partial<Record<"day" | "month" | "year", number>> = {};
  const fourDigitIndex = numbers.findIndex(n => n.length === 4);
  if (fourDigitIndex >= 0 && order[fourDigitIndex] !== "year") {
    // Year-first input ("2026/12/31") reads big-endian: month before day.
    const remaining: ReadonlyArray<"day" | "month"> =
      fourDigitIndex === 0
        ? ["month", "day"]
        : order.filter((part): part is "day" | "month" => part !== "year");
    let cursor = 0;
    numbers.forEach((n, i) => {
      if (i === fourDigitIndex) values.year = Number(n);
      else {
        const part = remaining[cursor++];
        if (part) values[part] = Number(n);
      }
    });
  } else {
    order.forEach((part, i) => {
      values[part] = Number(numbers[i]);
    });
  }

  let { year } = values;
  const { month, day } = values;
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  if (year < 100) year += 2000;
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }
  return { year, month, day };
}
