/**
 * Whether a field is in play, and who gets a say.
 *
 * A field can be put out of play by its own `when`, by any section that encloses it, and — inside a
 * collection — by the row's own rules. Each of those was composed by hand where it was discovered:
 * three copies of *out of play if any of them says no*, in the schema registration and in the two
 * collection managers. Three copies is how one of them came not to know about the others, which is
 * why a `record()` inside a conditional section stayed in play while the section was closed.
 *
 * So the sentence is written once, here, and the callers say **which** conditions apply rather than
 * how they combine.
 */
import { MDY_DEV } from "./dev-flags.js";
import type { MdyReactivity, MdySignal } from "./reactivity-contract.js";

/**
 * One say over whether a field is in play.
 *
 * `read` supplies the two arguments the predicate is given — the value it is about, and the value
 * that encloses it — so a condition on a section, on a row and on a field are the same kind of
 * thing, differing only in what they read.
 */
export interface MdyCondition {
  readonly holds: (value: unknown, enclosing: Record<string, unknown>) => boolean;
  readonly read: () => { readonly value: unknown; readonly enclosing: Record<string, unknown> };
}

/**
 * The signal a field's interactivity reads: true while **any** condition refuses it.
 *
 * One signal per field however many conditions there are, so a field's activity is one question with
 * one answer — not a stack of overrides where the last writer wins.
 */
export function composeConditions(
  rx: MdyReactivity,
  conditions: readonly MdyCondition[],
  /** Says what a caller could not have worked out from the condition alone. Silent in production. */
  warn: (message: string) => void = () => undefined,
): MdySignal<boolean> {
  return rx.computed(() =>
    !conditions.every((condition) => {
      const { value, enclosing } = condition.read();
      const holds = condition.holds(value, enclosing);
      // A predicate must be a pure function of what it is given: it re-runs when what it *reads*
      // changes, so one that reads anything else — a clock, a random source, a mutable outside the
      // form — answers correctly once and then goes stale with nothing to say so. Asking twice in
      // the same computation catches the ones that cannot even agree with themselves.
      if (MDY_DEV) {
        const again = condition.holds(value, enclosing);
        if (again !== holds) {
          warn(
            "a `when` predicate gave two answers for the same value. It must be a pure function of " +
            "its arguments — a predicate that reads a clock, a random source or anything else " +
            "outside the form goes stale without saying so. (This check only catches disagreement " +
            "within one evaluation.)",
          );
        }
      }
      return holds;
    }),
  );
}
