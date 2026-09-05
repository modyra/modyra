/**
 * What a date box shows: the text that could not be read, or failing that, the date being held.
 *
 * `entryText` is not the control's text. It is the text somebody typed that the field could **not**
 * read as a date, and every path that produces a value clears it — so it is empty for every readable
 * value. Bound to a box on its own, the box is blank whenever the field is holding something, and a
 * field that submits a date while showing nothing is the worst shape a defect takes here.
 *
 * Two questions in order, and the order is the whole of it: what a person typed and the field could
 * not read outranks what the field holds, because those keystrokes are still theirs to correct. Only
 * when there is nothing outstanding does the held value speak.
 *
 * Answered here rather than composed per renderer: three of them wrote this expression out, a fourth
 * wrote only its first half, and the field went blank for every valid date it held. The formatting
 * stays the caller's — a renderer knows the locale it resolved and this package does not — so what
 * is shared is the rule, not the words.
 */
export function dateEntryText(
  /** The keystrokes the field could not read, where there are any. */
  outstanding: string | null | undefined,
  /** The held value already formatted for the reader, where the field holds one. */
  held: string | null | undefined,
): string {
  return outstanding ?? held ?? "";
}
