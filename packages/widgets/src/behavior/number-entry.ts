/**
 * The number in a box a person types into, or nothing.
 *
 * Three renderers answered this three ways: one parsed the text, one read `valueAsNumber`, and one
 * did not convert at all and put the box's *string* in the model — where a numeric field's own
 * contract says it holds a number, so every rule about bounds was then judging text.
 *
 * Read from the text rather than from `valueAsNumber`, because that property is unimplemented in
 * some DOM implementations this library is asked to run in, and there it answers `NaN` for a box
 * that plainly holds a number — turning every typed digit into an empty field.
 *
 * Empty is nothing, text that is not a number is nothing, and a number is itself — never a value the
 * person did not write. `Number("")` is `0`, and a numeric field is nullable: clearing the box must
 * not supply a quantity nobody typed, which on the wire is an order line of zero, a price that is
 * free, a discount that is all of it.
 */
export function numberEntered(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}
