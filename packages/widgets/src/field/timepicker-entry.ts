/**
 * What a number box may hold while somebody is typing into it, and when the hand follows.
 *
 * A half-typed number is a state every time field has, and the contract had never named it. So each
 * renderer answered on its own and all three answers were wrong in different directions: one padded
 * to two digits after every keystroke, so clearing `00` and typing `0` then `1` produced `001` in a
 * two-digit field and `01` was unreachable by the route a person takes; the other two reformatted the
 * character away, so no partial existed at all and the box could not be cleared.
 *
 * The rule is a hybrid, and the second half is what makes it more than "leave the text alone":
 *
 * - a focused segment **may hold a partial** — empty, or fewer digits than the canonical width;
 * - on every keystroke, **if the text names a value the field accepts, the draft takes it and the
 *   hand moves there**;
 * - if it does not — empty, out of range, off the granularity's step — the draft keeps its last
 *   accepted value and the hand stays where it was;
 * - on blur or commit, the text normalises to the canonical form of what the draft holds.
 *
 * The text and the hand are two views of one draft, which is the same principle the focus contract
 * rests on: the moment they can disagree is the moment there are two states to keep in step.
 */
import { acceptTimeField, type MdyTimeField } from "../time-bounds.js";
import { MDY_EVERY_TIME, type MdyTimeSteps } from "../time-granularity.js";
import type { MdyTimeFormat } from "@modyra/core/datetime";

/** What a segment's text means right now. */
export interface MdyTimepickerEntry {
  /** The text the box may keep showing, which is what the person typed. */
  readonly text: string;
  /**
   * The value the draft takes, or `null` to keep what it has.
   *
   * `null` is not a refusal of the *text* — the box still shows it. It says this text does not yet
   * name a time, so nothing about the draft or the hand changes.
   */
  readonly value: number | null;
}

/** How many digits the canonical form of a field has. */
const WIDTH = 2;

/**
 * Reads what a box now holds.
 *
 * Everything that is not a digit is refused outright, because a segment is a number and a character
 * that can never become one is not a partial — keeping it would mean carrying text that no amount of
 * further typing rescues.
 */
export function timepickerEntry(
  field: MdyTimeField,
  format: MdyTimeFormat,
  text: string,
  steps: MdyTimeSteps = MDY_EVERY_TIME,
  /**
   * How a numeral is read, when the host knows something this package cannot.
   *
   * The field beside this one already goes through a host-supplied reader — the whole reason it is a
   * dependency is that a numeral is not `[0-9]` everywhere. Reading the box with a regexp here made
   * the same characters acceptable when the whole time was typed and refused when typed into a
   * segment, which is one library answering one question two ways.
   */
  parseSegment: (candidate: string) => number | null = readAsciiDigits,
): MdyTimepickerEntry | null {
  const typed = text.trim();
  if (typed.length > WIDTH) return null;
  // Empty names nothing, and that is a state a box is allowed to be in: it is how a person replaces
  // a value rather than editing it.
  if (typed.length === 0) return { text: typed, value: null };
  const number = parseSegment(typed);
  // Not a numeral at all in whatever alphabet the host reads: no amount of further typing rescues
  // it, so it is refused rather than kept as a partial.
  if (number === null) return null;
  const entry = acceptTimeField(field, format, number, steps);
  return { text: typed, value: entry.type === "accepted" ? entry.value : null };
}

/** The digits every locale shares, which is what a host that says nothing gets. */
function readAsciiDigits(candidate: string): number | null {
  return /^\d+$/.test(candidate) ? Number(candidate) : null;
}

/**
 * The canonical text for a value — what a box settles to when it stops being edited.
 *
 * Both fields are padded to two digits. An hour shown as `9` and one shown as `09` are the same hour
 * and different widths, and a box that changes width as you leave it moves the thing beside it.
 */
export function timepickerEntryText(value: number): string {
  return String(value).padStart(WIDTH, "0");
}

/**
 * The shape a time is typed in, shown when the field is empty and nothing else was asked for.
 *
 * One answer because it describes the notation the control reads, which is the format's property
 * rather than each renderer's taste. Written out separately it was three answers: two spellings and,
 * in the third renderer, no placeholder at all — so the same document told a person what to type in
 * two adapters and nothing in the other.
 */
export function timepickerPlaceholder(format: MdyTimeFormat): string {
  return format === "24h" ? "HH:mm" : "hh:mm AM/PM";
}
