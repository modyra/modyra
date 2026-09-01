/**
 * Carrying a form's verdicts from where it was built to where it is used.
 *
 * A form built outside a browser computes the same verdicts as one built inside it, and this is how
 * they travel: values, and the outcome of every rule that could be decided without waiting. What
 * could not be decided is carried as undecided, because a verdict that has not happened must never
 * arrive as one that has — a field shown green by a rule that never ran is worse than a field shown
 * unknown, since only one of the two invites a second look.
 *
 * Nothing here is read from the clock. A snapshot carrying a timestamp cannot round-trip to an equal
 * snapshot by construction, which would make the property this module exists for untestable rather
 * than merely false.
 */
import type { MdyTypedForm, MdyFormSchema } from "./typed-form.js";
import type { MdyReactivity } from "./reactivity.js";

/**
 * What is known about a field, which is not always whether it is valid.
 *
 * `unknown` is the state a boolean cannot hold: a rule is still being asked, so nothing has decided
 * yet. Folding it into `valid` renders a field green on the strength of a rule that never ran, and
 * folding it into `invalid` accuses a value nothing has objected to. It is its own answer.
 */
export type MdyServerVerdict = "valid" | "invalid" | "unknown";

/** One field, as it crossed the boundary. */
export interface MdyServerFieldSnapshot {
  readonly path: string;
  readonly value: unknown;
  /**
   * What the rules concluded, with `unknown` where they have not concluded.
   *
   * A synchronous failure is `invalid` even while an asynchronous rule is still running: something
   * is already known to be wrong, and waiting does not make it less so.
   */
  readonly verdict: MdyServerVerdict;
  /** Whether a rule is still being asked. Orthogonal to the verdict, and both are needed. */
  readonly pending: boolean;
  readonly errors: readonly string[];
}

/** A form's verdicts, in a form that survives being written as text. */
export interface MdyServerSnapshot {
  /** The form's own verdict, `unknown` while any field is still being asked and none has failed. */
  readonly verdict: MdyServerVerdict;
  /**
   * The whole form value, which is what the receiving side is started from.
   *
   * Held once rather than per field: the value is the only thing a restore writes, and a second
   * copy spread across the field entries would be a shape that can disagree with itself.
   */
  readonly value: unknown;
  readonly pending: boolean;
  readonly fields: readonly MdyServerFieldSnapshot[];
}

/**
 * Take the verdicts a form has reached.
 *
 * The values are read through the form rather than from the schema, so a field written before the
 * snapshot travels as written.
 */
export function mdyServerSnapshot<S extends MdyFormSchema>(
  form: MdyTypedForm<S>,
  reactivity: MdyReactivity,
): MdyServerSnapshot {
  assertCanSnapshot(reactivity, "mdyServerSnapshot");
  const fields = form.fieldNames().map((path) => {
    const state = form.getField(path)?.();
    const pending = state?.pending() ?? false;
    const errors = state?.errors().map((each) => each.message) ?? [];
    // A synchronous failure is a decision, so it outranks waiting. Nothing wrong *and* still being
    // asked is the one case where no verdict has been reached.
    const verdict: MdyServerVerdict =
      errors.length > 0 || state?.valid() === false ? "invalid" : pending ? "unknown" : "valid";
    return { path, value: state?.value() ?? null, verdict, pending, errors };
  });

  const pending = fields.some((each) => each.pending) || form.state.pending();
  return {
    value: form.getValue(),
    verdict: fields.some((each) => each.verdict === "invalid")
      ? "invalid"
      : pending
        ? "unknown"
        : "valid",
    // A form with anything still being asked is pending, whatever its synchronous rules concluded.
    pending,
    fields,
  };
}

/**
 * Start a form from verdicts taken elsewhere.
 *
 * The values are written back and the form recomputes its synchronous rules from them, rather than
 * having the carried verdicts installed. That is deliberate: a verdict restored as data is a claim
 * nothing checked, and would hide exactly the disagreement between the two roads that this path
 * exists to make impossible. The carried outcomes are what the sending side rendered; the receiving
 * side re-derives its own and must reach the same ones.
 *
 * Rules that were still being asked when the snapshot was taken are not assumed to have passed. They
 * run here, because writing the value is what asks them.
 */
export function mdyRestoreSnapshot<S extends MdyFormSchema>(
  form: MdyTypedForm<S>,
  snapshot: MdyServerSnapshot,
  reactivity: MdyReactivity,
): MdyTypedForm<S> {
  assertCanSnapshot(reactivity, "mdyRestoreSnapshot");
  form.setValue(snapshot.value as never);
  return form;
}

/**
 * Refuse a runtime that has not said it can do this.
 *
 * The reactivity is asked for rather than taken from the form, and it is not optional. A default
 * would answer for a runtime nobody named: a caller who built with one that cannot re-run its
 * computations would be told the snapshot is sound on the strength of a different runtime's
 * capabilities, which is the silent wrong answer this refusal exists to replace.
 */
function assertCanSnapshot(reactivity: MdyReactivity, called: string): void {
  if (reactivity.capabilities?.serverSnapshots === true) return;
  throw new TypeError(
    `[modyra] ${called} needs a reactivity that declares \`serverSnapshots: true\`, and ` +
    `${String(reactivity.kind ?? "this one")} declares ` +
    `${String(reactivity.capabilities?.serverSnapshots)}. A runtime whose computations do not ` +
    "re-run outside a browser produces verdicts that disagree with the ones a person will see, so " +
    "the path refuses rather than serialising them. Build with a runtime that declares it, or run " +
    "this form in the browser.",
  );
}