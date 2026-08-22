/**
 * Framework-free keyboard interaction logic for the composite widgets.
 *
 * A component translates a DOM event into one of these pure decisions and applies the target it
 * returns to its own state. Nothing here touches the DOM, so the same key means the same thing
 * wherever the widget is drawn.
 */
import {
  addDays,
  addMonths,
  addYears,
  CalendarDate,
  daysInMonth,
} from "@modyra/core/datetime";

/**
 * Listbox navigation (WAI-ARIA listbox pattern): returns the next active
 * option index for a navigation key, or `null` when the key does not
 * navigate (selection/close keys are the caller's business).
 *
 * `activeIndex` may be -1 (no active option yet): ArrowDown enters the list
 * at 0, ArrowUp at the last option.
 */
export function listboxNextIndex(
  key: string,
  activeIndex: number,
  optionCount: number,
): number | null {
  if (optionCount <= 0) return null;
  const last = optionCount - 1;
  switch (key) {
    case "ArrowDown":
      return Math.min(activeIndex + 1, last);
    case "ArrowUp":
      return activeIndex === -1 ? last : Math.max(activeIndex - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

/**
 * Where the reading position goes in a row that clamps at its ends.
 *
 * A listbox laid out horizontally — the colour presets — walked with either axis: `ArrowLeft` and
 * `ArrowRight` because the row runs that way, `ArrowUp` and `ArrowDown` because a person reading it
 * as a list reaches for them, `Home` and `End` for its ends. It clamps rather than wraps, which is
 * what tells a person they have reached the end without their having to notice they are back at the
 * start.
 *
 * `by` is the binding's direction where the caller has one: the row runs in the writing direction, so
 * `ArrowLeft` is *later* in a right-to-left document and a renderer reading the key alone would be
 * wrong there. Absent, the key decides.
 *
 * Published because three renderers each had this arithmetic, which is three chances for one of them
 * to clamp where the others wrap.
 */
export function rowRovingIndex(
  key: string,
  at: number,
  count: number,
  by?: -1 | 1,
): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  const step = by ?? (key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1);
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return null;
  // From nowhere, a step forward starts at the beginning and a step back at the end.
  if (at < 0) return step === -1 ? last : 0;
  return Math.max(0, Math.min(last, at + step));
}

/**
 * Calendar grid navigation (WAI-ARIA grid pattern): returns the date that
 * should receive focus for a navigation key, or `null` when the key does
 * not move focus. Month/year jumps clamp the day (Jan 31 → Feb 28), and
 * `shiftKey` upgrades PageUp/PageDown to year jumps.
 */
export function calendarKeyboardTarget(
  key: string,
  focused: CalendarDate,
  shiftKey = false,
): CalendarDate | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(focused, -1);
    case "ArrowRight":
      return addDays(focused, 1);
    case "ArrowUp":
      return addDays(focused, -7);
    case "ArrowDown":
      return addDays(focused, 7);
    case "PageUp":
      return shiftKey ? addYears(focused, -1) : addMonths(focused, -1);
    case "PageDown":
      return shiftKey ? addYears(focused, 1) : addMonths(focused, 1);
    case "Home":
      return { year: focused.year, month: focused.month, day: 1 };
    case "End":
      return {
        year: focused.year,
        month: focused.month,
        day: daysInMonth(focused.year, focused.month),
      };
    default:
      return null;
  }
}
