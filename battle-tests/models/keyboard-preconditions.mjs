/**
 * Which declared key bindings are owed a precondition, and which of those lack one.
 *
 * A binding may apply only in some state (`when`) or only where the field asked for a capability
 * (`requires`). A reader consulting the table — to build a help panel, or to decide what to bind —
 * needs to tell a key an ordinary control honours from one it will not.
 *
 * **The subject is a kind's intent, never an intent alone.** Two kinds can spell one intent and mean
 * different capabilities: a number field steps because stepping a range is what it does, and a chip
 * steps only where the field says a value can be held more than once. Keyed on the intent by itself,
 * a single kind gating its stepping turns every other kind's stepping into a finding, and the native
 * range-steppers are reported for a capability they were never part of.
 *
 * The confusion this exists to catch lives *inside* one kind: two bindings that look alike in the
 * same table, one gated and one not, saying two different things about the same capability.
 *
 * Lives here rather than inside the battle so that both directions can be exercised on tables built
 * for the purpose — a rule that can only be run against the real contract can be shown to pass, and
 * never shown to fail.
 */

/** The bindings of a kind's intent, where any binding of that same kind and intent is gated. */
export function bindingsOwedAPrecondition(declared) {
  const gated = new Set(
    declared
      .filter((binding) => binding.requires !== undefined && binding.requires !== null)
      .map((binding) => `${binding.kind} ${binding.intent}`),
  );
  return declared.filter((binding) => gated.has(`${binding.kind} ${binding.intent}`));
}

/** Those of them carrying neither a state nor a capability: the ones a reader cannot place. */
export function bindingsWithNoPrecondition(declared) {
  return bindingsOwedAPrecondition(declared)
    .filter((binding) =>
      (binding.when === undefined || binding.when === null)
      && (binding.requires === undefined || binding.requires === null));
}
