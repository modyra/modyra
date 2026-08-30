/**
 * SCENARIO (c) — binding the engine to a reactive system it has never seen.
 *
 * Somebody has a small signals library of their own and wants Modyra's forms to run on it: a field's
 * value should be readable as one of their signals, and writing it should notify their subscribers.
 * Nothing else — no components, no renderer, no framework integration.
 *
 * That is the whole specification. It does not change when the library does, and the after-version
 * of this pass is re-implemented from these words rather than edited from this file.
 *
 * Measured on this file, working:
 *
 *     doors            1     @modyra/core
 *     named symbols    3     createForm, field, required
 *     interfaces read  2     MdyReactivity, and MdyWritableSignal for what its signal returns
 *     members          10    id · kind · capabilities · signal · computed · effect · untracked,
 *                            and set · update · asReadonly on the signal
 *     truth claims     10    every capability is believed; saying `true` to something untrue does
 *                            not fail here, it fails later in a check that trusted it
 *
 * The member that costs the most is `asReadonly`, because it is declared on a different interface
 * from the one an adapter author reads: leaving it out crashes while the form is being *constructed*,
 * with a message about a signal the author never wrote, and nothing points back at the contract.
 */
import { createForm, field, required } from "@modyra/core";

/**
 * The reactive system being adapted. Deliberately tiny and written here, because the scenario is
 * about what the *contract* asks for — an adapter for a real library answers the same questions.
 */
const listeners = new Set();
let depth = 0;
const toy = {
  signal(initial) {
    let value = initial;
    const subscribers = new Set();
    const read = () => { if (depth > 0) subscribers.add(current); return value; };
    read.set = (next) => { if (Object.is(next, value)) return; value = next; for (const s of subscribers) s(); };
    read.update = (fn) => read.set(fn(value));
    return read;
  },
  watch(fn) { const run = () => { current = run; depth += 1; try { fn(); } finally { depth -= 1; } }; run(); listeners.add(run); return () => listeners.delete(run); },
};
let current = null;

/**
 * The adapter. Four methods and three properties — and `capabilities` is the part that takes the
 * thinking: ten questions about what this reactive system actually guarantees, answered for a
 * library that will believe the answers. Saying `true` to something untrue does not fail here; it
 * fails somewhere else, later, in a check that trusted it.
 */
const toyReactivity = {
  id: Symbol("toy"),
  kind: "toy",
  capabilities: {
    effects: true,
    effectOwnership: false,     // no scope to own them: `createScope` is not implemented below
    signalEquality: true,       // `Object.is` above, and nothing lets a caller change it
    computedEquality: false,    // computeds here recompute and re-notify without comparing
    batching: false,            // every write notifies immediately
    deterministicFlush: false,  // ...so there is no flush to be deterministic about
    directObservation: true,
    graphInspection: false,
    serverSnapshots: false,
    pureComputeds: false,       // a write inside a computed is not refused, only discouraged
  },
  signal(initial) {
    const s = toy.signal(initial);
    const read = () => s();
    read.set = (next) => s.set(next);
    read.update = (fn) => s.update(fn);
    // The third member, and the one that is easy to miss: it is declared on `MdyWritableSignal`
    // rather than on the reactivity, so an author who reads the reactivity interface alone writes an
    // adapter that crashes while the form is being constructed rather than when the value is used.
    read.asReadonly = () => () => s();
    return read;
  },
  computed(fn) {
    const out = toy.signal(fn());
    toy.watch(() => out.set(fn()));
    return () => out();
  },
  effect(fn) {
    const stop = toy.watch(() => fn(() => undefined));
    return { destroy: stop };
  },
  untracked(fn) { const held = depth; depth = 0; try { return fn(); } finally { depth = held; } },
};

export function makeForm() {
  return createForm({ email: field("", [required()]) }, { reactivity: toyReactivity });
}
