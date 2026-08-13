/**
 * What a mounted field can still be told.
 *
 * A renderer here is a function that draws and returns its teardown, which is enough for a field
 * whose configuration never moves. It is not enough for the two things that do: an option list
 * arriving from a fetch, and a range of dates that narrows when a sibling field is answered. The
 * controllers behind these kinds take both — `setOptions`, `setBounds` — and this renderer had no
 * door to reach them through, so it was the one adapter that could not be told.
 *
 * Carried on the teardown rather than returned beside it, so every existing caller keeps working:
 * the result is still the function it always was.
 */
export interface MdyFieldControls {
  /** Replace the options a chooser offers. Present on the kinds that have a list. */
  readonly setOptions?: (options: ReadonlyArray<{ readonly value: unknown; readonly label: string; readonly disabled?: boolean }>) => void;
  /** Replace the range of dates on offer, ISO `YYYY-MM-DD` or null for open-ended. */
  readonly setBounds?: (minDate: string | null, maxDate: string | null) => void;
}

/** A teardown that also carries what the mounted field can be told. */
export type MdyMountedField = (() => void) & MdyFieldControls;

/**
 * Attaches the updaters a kind supports to its teardown.
 *
 * Not on the package entry: a consumer receives the result, it does not build one. The two types
 * above are what a consumer needs, and they are public.
 */
export function withControls(teardown: () => void, controls: MdyFieldControls): MdyMountedField {
  return Object.assign(teardown, controls);
}
