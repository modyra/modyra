import { InjectionToken } from "@angular/core";

/**
 * Locale configuration for the date picker.
 *
 * Provides localized month names, day-of-week names, and
 * first-day-of-week preference. Consumers can override via DI
 * to support any locale.
 */
export interface MdyDateLocale {
  /** BCP 47 locale tag (e.g. `'en-US'`, `'it-IT'`). Used by `Intl` formatters. */
  readonly locale: string;
  /** 0 = Sunday, 1 = Monday, … 6 = Saturday. */
  readonly firstDayOfWeek: number;
  /** Short month names (Jan, Feb, …) — length 12. */
  readonly monthNamesShort: readonly string[];
  /** Long month names (January, February, …) — length 12. */
  readonly monthNamesLong: readonly string[];
  /** Narrow day-of-week headers (S, M, T, …) — length 7, starting from Sunday. */
  readonly dayNamesNarrow: readonly string[];
  /** Short day-of-week headers (Sun, Mon, …) — length 7, starting from Sunday. */
  readonly dayNamesShort: readonly string[];
}

/**
 * Build an MdyDateLocale from a BCP 47 locale tag.
 *
 * Uses `Intl.DateTimeFormat` so it works with any locale the runtime supports
 * without shipping locale data bundles.
 *
 * @param locale         BCP 47 tag (e.g. `'it-IT'`)
 * @param firstDayOfWeek Override first day of week. When omitted, uses
 *                       `Intl.Locale.prototype.weekInfo` (Chromium 99+, FF/Safari 17+)
 *                       or defaults to Monday.
 */
export function buildDateLocale(
  locale: string,
  firstDayOfWeek?: number,
): MdyDateLocale {
  const resolvedFirst = firstDayOfWeek ?? detectFirstDayOfWeek(locale);

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long" });
  const monthShortFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
  });
  const dayNarrowFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
  });
  const dayShortFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
  });

  // Generate month names — use a known year (2024) to avoid edge-case issues
  const monthNamesLong: string[] = [];
  const monthNamesShort: string[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(2024, m, 15);
    monthNamesLong.push(monthFormatter.format(d));
    monthNamesShort.push(monthShortFormatter.format(d));
  }

  // Generate day names — Jan 7, 2024 is a Sunday
  const dayNamesNarrow: string[] = [];
  const dayNamesShort: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, 7 + i); // Sun=7, Mon=8, …
    dayNamesNarrow.push(dayNarrowFormatter.format(d));
    dayNamesShort.push(dayShortFormatter.format(d));
  }

  return {
    locale,
    firstDayOfWeek: resolvedFirst,
    monthNamesLong,
    monthNamesShort,
    dayNamesNarrow,
    dayNamesShort,
  };
}

/**
 * Detect the first day of week for a locale using `Intl.Locale.weekInfo`
 * when available (modern browsers). Falls back to Monday (ISO standard).
 */
function detectFirstDayOfWeek(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { readonly firstDay: number };
      getWeekInfo?: () => { readonly firstDay: number };
    };
    // Chrome 99+: weekInfo property; Firefox/Safari 17+: getWeekInfo()
    const info = loc.weekInfo ?? loc.getWeekInfo?.();
    if (info) {
      // Intl weekInfo uses 1=Mon…7=Sun; convert to 0=Sun…6=Sat
      return info.firstDay === 7 ? 0 : info.firstDay;
    }
  } catch {
    // Intl.Locale not supported — fall through
  }
  return 1; // Monday as sensible default (ISO 8601)
}

/**
 * DI token that provides locale configuration for date components.
 *
 * Override at root or component level:
 * ```ts
 * providers: [
 *   { provide: MDY_DATE_LOCALE, useValue: buildDateLocale('it-IT') }
 * ]
 * ```
 */
export const MDY_DATE_LOCALE = new InjectionToken<MdyDateLocale>(
  "MDY_DATE_LOCALE",
  {
    providedIn: "root",
    factory: (): MdyDateLocale => {
      const tag =
        typeof navigator !== "undefined" && navigator.language
          ? navigator.language
          : "en-US";
      return buildDateLocale(tag);
    },
  },
);
