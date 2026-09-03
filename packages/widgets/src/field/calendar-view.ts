/**
 * What a calendar is showing: the days of a month, the months of a year, or a run of years.
 *
 * A calendar that only pages a month at a time makes a birth date thirty clicks away, so two of the
 * three renderers grew a month picker and a year picker — separately, with the same seven class
 * names, none of them in the catalogue, neither carrying a role. The third grew nothing, and nobody
 * decided that either.
 *
 * The mode is state, so it belongs to the controller for the kind rather than to each renderer, for
 * the reason the timepicker already demonstrates: it holds `viewMode` and its renderers ask.
 */
export const MDY_CALENDAR_VIEW_MODES = Object.freeze(["days", "months", "years"] as const);

export type MdyCalendarViewMode = (typeof MDY_CALENDAR_VIEW_MODES)[number];

/**
 * Where choosing in one view lands.
 *
 * Choosing a year narrows to its months, choosing a month narrows to its days — the funnel a user
 * expects, and the reason picking a year does not close the popup. Stated here so a renderer cannot
 * decide that a year jumps straight to the grid while another walks the funnel.
 */
export function calendarViewAfterPick(mode: MdyCalendarViewMode): MdyCalendarViewMode {
  return mode === "years" ? "months" : "days";
}

/**
 * Where the header's own control goes.
 *
 * The top of the funnel, not the next step down it: from the days it opens the *years*, because a
 * user reaching for the header is looking for a date far from the month on screen — a birth date, a
 * maturity — and walking through the months to get there is the paging the views exist to avoid.
 * From anywhere else it goes back to the days.
 *
 * Stated because the two renderers that had these views agreed on it by accident and a third,
 * written later, chose the other order.
 */
export function calendarViewOnToggle(mode: MdyCalendarViewMode): MdyCalendarViewMode {
  return mode === "days" ? "years" : "days";
}

/**
 * Where a step along the funnel goes: `1` out to a wider view, `-1` back in to a narrower one.
 *
 * A different journey from the header's control, and deliberately so. The header is a shortcut to
 * the top for somebody reaching for a date far from the month on screen; this walks the three views
 * one at a time, which is what a key repeated in one direction should do.
 *
 * **Clamped at both ends rather than wrapped.** A ring would send a person zooming out past the
 * years straight back to the days, so holding the key would oscillate between the widest and the
 * narrowest view instead of settling — and the end of a range is where a repeated key is most likely
 * to be held one press too long.
 */
export function calendarViewOnZoom(mode: MdyCalendarViewMode, by: -1 | 1): MdyCalendarViewMode {
  const at = MDY_CALENDAR_VIEW_MODES.indexOf(mode);
  const next = Math.min(Math.max(at + by, 0), MDY_CALENDAR_VIEW_MODES.length - 1);
  return MDY_CALENDAR_VIEW_MODES[next]!;
}
