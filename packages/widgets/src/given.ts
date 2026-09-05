/**
 * What a door does when it is handed the wrong shape.
 *
 * **A value of the wrong shape is a verdict; an argument of the wrong shape is a defect.** ADR 0208
 * settled the first: a value is a person's data, so the page survives it and the verdict channel
 * reports it. This is the other half, and the opposite policy for the opposite audience — a
 * malformed argument is a mistake in the calling code, and code defects are answered loudly, to the
 * builder, rather than quietly to the page. One coherence under two policies: a wrong shape never
 * passes in silence.
 *
 * The silence was measured, not supposed. In one evening six probes written by two careful sessions
 * passed the wrong input to a door or a fixture, and **not one of them objected**: a key nobody read,
 * an object satisfying a structural type just enough to answer `undefined`. Four of the six produced
 * a defect that did not exist, and one of those was carried most of the way to a report.
 *
 * Only doors whose every field is required are guarded. A door declaring an optional field is saying
 * a partial object is legitimate — `fieldAccessibleName({ ariaLabel })` is a caller asking what it
 * means to have only that — and demanding the rest there would refuse the very callers it is for.
 */

/**
 * The argument, or a refusal naming what is missing and what was expected.
 *
 * `undefined` is the only absence tested. `null` is a value a field may legitimately hold — a
 * calendar with no focused date holds `null` — and refusing it would turn a state the contract
 * declares into an error.
 */
export function given<T extends object>(
  door: string,
  shape: string,
  argument: T,
  fields: ReadonlyArray<keyof T & string>,
): T {
  const absent = argument === null || typeof argument !== "object"
    ? fields
    : fields.filter((field) => (argument as Record<string, unknown>)[field] === undefined);
  if (absent.length === 0) return argument;
  throw new TypeError(
    `[modyra] ${door} expects ${shape}, and was given an object without `
    + `${absent.map((field) => `.${field}`).join(", ")}. `
    + "A door is answering about a shape it cannot see: the argument is wrong, not the widget.",
  );
}
