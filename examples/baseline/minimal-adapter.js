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
 *
 * **The slope, measured rather than guessed.** This adapter was driven through the differential
 * suite's own operation log against vanilla — the same comparison every published runtime answers —
 * and it agrees completely. So the contract is teachable from zero: a reactive system of ten lines
 * carries a form with keyed collections, validation and submission, and differs from vanilla in
 * nothing the suite compares.
 *
 * Three things had to be right, and the order in which they went wrong is the useful part:
 *
 *   asReadonly        crashes during construction. Found by crashing.
 *   computed          a computed that caches without tracking returns a stale answer, and the
 *                     engine reports it as a value that does not match the schema's shape.
 *   effect cleanup    **the one that looks like tidiness and is correctness.** The engine registers
 *                     teardown for work in flight — a superseded async validation among it — so an
 *                     effect that drops the callback leaves runs nobody cancelled: `activeAsyncRuns`
 *                     four where vanilla has two, and a form that is otherwise identical.
 *
 * And one that turned out not to matter: `batching`. Declaring it true while doing nothing changed
 * no observable, and implementing it changed none either. On this path the engine neither trusts the
 * flag nor needs the behaviour — which is worth knowing before anybody treats ten capability
 * booleans as ten things that must be right.
 */
import { createForm, field, required } from "@modyra/core";

/**
 * The reactive system being adapted. Deliberately tiny and written here, because the scenario is
 * about what the *contract* asks for — an adapter for a real library answers the same questions.
 */
const listeners = new Set();
let depth = 0;
// A microtask flush, so a burst of writes notifies once instead of once each.
const queued = new Set();
let flushing = false;
const queue = (fn) => {
  queued.add(fn);
  if (flushing) return;
  flushing = true;
  queueMicrotask(() => { flushing = false; const due = [...queued]; queued.clear(); for (const one of due) one(); });
};
const toy = {
  signal(initial) {
    let value = initial;
    const subscribers = new Set();
    const read = () => { if (depth > 0) subscribers.add(current); return value; };
    read.set = (next) => { if (Object.is(next, value)) return; value = next; for (const s of subscribers) queue(s); };
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
export const toyReactivity = {
  id: Symbol("toy"),
  kind: "toy",
  capabilities: {
    effects: true,
    effectOwnership: false,     // no scope to own them: `createScope` is not implemented below
    signalEquality: true,       // `Object.is` above, and nothing lets a caller change it
    computedEquality: false,    // computeds here recompute and re-notify without comparing
    batching: true,             // a microtask flush coalesces a burst of writes
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
  // Recomputed on every read rather than cached. Wasteful and correct — and correctness is what the
  // engine needs: a computed that caches without tracking its inputs returns a stale answer, which
  // is the difference between a form that is slow and a form that is wrong.
  computed(fn) {
    return () => fn();
  },
  // The cleanup is the part an adapter forgets, and it is not a tidiness feature: the engine
  // registers teardown for work in flight — a superseded async validation among it — so an effect
  // that drops the callback leaves runs nobody cancelled.
  effect(fn) {
    let cleanups = [];
    const runCleanups = () => { const due = cleanups; cleanups = []; for (const one of due) one(); };
    const stop = toy.watch(() => {
      runCleanups();
      fn((onCleanup) => { if (typeof onCleanup === "function") cleanups.push(onCleanup); });
    });
    return { destroy: () => { runCleanups(); stop(); } };
  },
  untracked(fn) { const held = depth; depth = 0; try { return fn(); } finally { depth = held; } },
};

export function makeForm() {
  return createForm({ email: field("", [required()]) }, { reactivity: toyReactivity });
}
