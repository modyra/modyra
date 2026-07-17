/**
 * Locale configuration for date renderers.
 * Framework adapters should provide/inject this shape through their own DI.
 */
export interface MdyDateLocale {
    /** BCP 47 locale tag (e.g. `en-US`, `it-IT`). */
    readonly locale: string;
    /** 0 = Sunday, 1 = Monday, … 6 = Saturday. */
    readonly firstDayOfWeek: number;
    /** Short month names (Jan, Feb, …), length 12. */
    readonly monthNamesShort: readonly string[];
    /** Long month names (January, February, …), length 12. */
    readonly monthNamesLong: readonly string[];
    /** Narrow weekday labels (S, M, T, …), Sunday-first, length 7. */
    readonly dayNamesNarrow: readonly string[];
    /** Short weekday labels (Sun, Mon, …), Sunday-first, length 7. */
    readonly dayNamesShort: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function detectFirstDayOfWeek(locale: string): number {
    try {
        const loc = new Intl.Locale(locale);
        const weekInfo = Reflect.get(loc, "weekInfo");
        if (isRecord(weekInfo)) {
            const firstDay = weekInfo["firstDay"];
            if (typeof firstDay === "number") {
                return firstDay === 7 ? 0 : firstDay;
            }
        }
        const getWeekInfo = Reflect.get(loc, "getWeekInfo");
        if (typeof getWeekInfo === "function") {
            const info = getWeekInfo.call(loc);
            if (isRecord(info)) {
                const firstDay = info["firstDay"];
                if (typeof firstDay === "number") {
                    return firstDay === 7 ? 0 : firstDay;
                }
            }
        }
    } catch {
        // Intl.Locale unsupported or invalid locale tag.
    }
    return 1; // ISO default (Monday)
}

/**
 * Builds a locale bundle from a BCP 47 locale tag using Intl APIs.
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

    const monthNamesLong: string[] = [];
    const monthNamesShort: string[] = [];
    for (let m = 0; m < 12; m++) {
        const d = new Date(2024, m, 15);
        monthNamesLong.push(monthFormatter.format(d));
        monthNamesShort.push(monthShortFormatter.format(d));
    }

    const dayNamesNarrow: string[] = [];
    const dayNamesShort: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(2024, 0, 7 + i); // Jan 7, 2024 is Sunday.
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
