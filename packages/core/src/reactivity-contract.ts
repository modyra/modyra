/**
 * The reactive contract the form engine is written against, and nothing else.
 *
 * The engine never imports a framework: it needs something that can create writable signals, derived
 * computations and effects. An adapter binds those to its host's own primitives so the engine's
 * state takes part in that host's change detection.
 *
 * The reference implementation lives next door, in `vanilla-reactivity.ts`. It used to live here,
 * which meant importing the interface pulled in four hundred lines of scheduler and its module-level
 * queue — a cost paid by every consumer that only wanted to name the type.
 *
 * `capabilities`, `createScope`, `id` and `kind` are optional for now so adapters keep compiling
 * unmodified; they become load-bearing as each is migrated.
 */

/** Structural equality check used by signals/computeds that support it. */
export type MdyEqualityFn<T> = (previous: T, next: T) => boolean;

/** Read-only reactive value — call it to read (and track) the value. */
export interface MdySignal<T> {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type -- interface form is intentional: MdyWritableSignal extends it
  (): T;
}

/** Writable reactive value. */
export interface MdyWritableSignal<T> extends MdySignal<T> {
  set(value: T): void;
  update(fn: (value: T) => T): void;
  asReadonly(): MdySignal<T>;
}

/** Handle to a running effect. */
export interface MdyEffectRef {
  destroy(): void;
  /** True once {@link destroy} has run (or the effect otherwise stopped). */
  readonly destroyed?: boolean;
}

/** Registers a callback run before the next effect run (or on destroy). */
export type MdyOnCleanup = (cleanup: () => void) => void;

export interface MdySignalOptions<T> {
  equal?: MdyEqualityFn<T>;
  debugName?: string;
}

export interface MdyComputedOptions<T> {
  equal?: MdyEqualityFn<T>;
  debugName?: string;
}

export interface MdyEffectOptions {
  debugName?: string;
  scope?: MdyReactiveScope;
  onError?: (error: unknown) => void;
}

/**
 * Garanzie osservabili di un adapter (Livello B) — devono
 * riflettere comportamento reale, mai la sola presenza di un metodo
 * (nessuna capability fittizia).
 */
/**
 * Optional Level-B capability: a real runtime-coalescing
 * `batch()`, distinct from `MdyFormEngine.mutate()`'s domain-level
 * coalescing (history/notifications) — `mutate()` delegates to this when
 * an adapter reports `capabilities.batching: true`, and works correctly
 * without it otherwise. No shipped adapter implements this yet.
 */
export interface MdyBatchingCapability {
  batch<T>(fn: () => T): T;
}

/** Optional Level-B capability: a deterministic settle point. */
export interface MdyFlushCapability {
  flush(): void | Promise<void>;
}

export interface MdyObserveOptions<T> {
  equal?: MdyEqualityFn<T>;
  timing?: "sync" | "runtime";
}

/**
 * Optional Level-B capability: a selector-based subscription
 * that only notifies on an actual change (per `equal`), skipping the
 * initial run. Must be executed by the runtime that owns the observed
 * signals — never bridged through an unrelated reactivity instance
 * (the cross-runtime rule applies here too).
 */
export interface MdyObserveCapability {
  observe<T>(
    selector: () => T,
    listener: (value: T, previous: T) => void,
    options?: MdyObserveOptions<T>,
  ): MdyEffectRef;
}

/**
 * Narrows to a reactivity that reports (and implements) real runtime batching.
 *
 * Used where a change is one statement made of several writes — a row's cells, a list's rows. A
 * runtime whose computations run eagerly observes each write on its own otherwise, and sees a form
 * that is half-written: a shape its own schema does not describe.
 */
export function reactivityBatches(
  rx: MdyReactivity,
): rx is MdyReactivity & MdyBatchingCapability {
  return (
    rx.capabilities?.batching === true &&
    typeof (rx as Partial<MdyBatchingCapability>).batch === "function"
  );
}

export interface MdyReactivityCapabilities {
  readonly effects: boolean;
  readonly effectOwnership: boolean;
  readonly signalEquality: boolean;
  readonly computedEquality: boolean;
  readonly batching: boolean;
  readonly deterministicFlush: boolean;
  readonly directObservation: boolean;
  readonly graphInspection: boolean;
  readonly serverSnapshots: boolean;
  /**
   * Whether writing a signal inside a computed is **refused**.
   *
   * The rule holds everywhere — a computed is a function of its inputs, and code that runs under
   * more than one reactivity must obey the strictest of them. What differs is whether a graph can
   * see the violation: this says it does, and `false` means it will not notice, never that the
   * write is allowed. See ADR 0032.
   */
  readonly pureComputeds: boolean;
}

/**
 * Whether this reactivity can run effects.
 *
 * `capabilities` is required, so in TypeScript this is just the field. It is asked through a
 * function because the engine is also called from JavaScript, and an adapter object assembled by
 * hand can still arrive without it — in which case the answer is "no effects", exactly what the
 * `canEffect` alias reported before it was removed. The engine then skips async validators, drafts
 * and history with a warning rather than throwing on a missing property.
 */
/**
 * What a reactivity owes the engine, and what a signal it makes owes in turn.
 *
 * An adapter implements `MdyReactivity`, and the compiler checks it — but an adapter written in
 * JavaScript, or handed across a bundle boundary, or assembled by spreading another one, is checked
 * by nothing. The first missing member then arrives from inside the engine: `hasDraft.asReadonly is
 * not a function`, thrown in a file the adapter's author has never opened, naming a local variable
 * that means nothing to them.
 *
 * The second half is the one a type would not have caught anyway. `asReadonly` is declared on
 * `MdyWritableSignal`, a different interface from the one being implemented, so an adapter can
 * satisfy `MdyReactivity` completely and still hand back signals the engine cannot use.
 */
/**
 * The members the engine cannot construct without, measured rather than assumed.
 *
 * `effect` is deliberately not here, and neither is `capabilities`: a reactivity that cannot run
 * reactions is a supported thing — the engine degrades and reports what it could not do through the
 * diagnostics sink — so refusing one here would turn a documented fallback into a crash. What is
 * listed is what the engine calls unconditionally while building a form.
 */
const REACTIVITY_MEMBERS: ReadonlyArray<readonly [string, string]> = [
  ["signal", "make a writable signal"],
  ["computed", "derive a value from other signals"],
  ["untracked", "read a signal without depending on it"],
];

const WRITABLE_SIGNAL_MEMBERS: ReadonlyArray<readonly [string, string]> = [
  ["set", "replace the value"],
  ["update", "derive the next value from the current one"],
  ["asReadonly", "hand out a view that cannot be written through"],
];

/**
 * What this reactivity is missing, in the words its author can act on. Empty when the engine can
 * use it.
 *
 * Reported rather than thrown, so the caller decides where the sentence appears: an engine says it
 * at construction, a test asserts on it.
 */
export function missingReactivityMembers(rx: unknown): ReadonlyArray<string> {
  if (typeof rx !== "object" || rx === null) {
    return [`a reactivity must be an object, and this is ${rx === null ? "null" : typeof rx}`];
  }
  const held = rx as Record<string, unknown>;
  const missing = REACTIVITY_MEMBERS
    .filter(([member]) => typeof held[member] !== "function")
    .map(([member, purpose]) => `${member}() — ${purpose}, required by MdyReactivity`);
  if (missing.length > 0) return missing;

  // The signal is made rather than assumed: what `signal()` returns is the contract, and only
  // calling it can say whether the returned value keeps it.
  let made: unknown;
  try {
    made = (held.signal as (initial: unknown) => unknown)(undefined);
  } catch (error) {
    return [`signal() threw when the engine called it: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (typeof made !== "function") {
    return [`signal() returned ${typeof made}, and a signal is read by calling it`];
  }
  const signal = made as unknown as Record<string, unknown>;
  return WRITABLE_SIGNAL_MEMBERS
    .filter(([member]) => typeof signal[member] !== "function")
    .map(([member, purpose]) => `signal().${member}() — ${purpose}, required by MdyWritableSignal`);
}

export function reactivityRunsEffects(rx: Pick<MdyReactivity, "capabilities">): boolean {
  return rx.capabilities?.effects === true;
}

export interface MdyScopeOptions {
  debugName?: string;
  parent?: MdyReactiveScope;
}

/** Ownership/lifecycle boundary. */
export interface MdyReactiveScope {
  readonly id: symbol;
  readonly destroyed: boolean;
  run<T>(fn: () => T): T;
  onCleanup(cleanup: () => void): void;
  destroy(): void;
}

export interface MdyReactivity {
  /**
   * Which reactivity this is, by identity rather than by name.
   *
   * Two adapters can both call themselves `"react"`; only the symbol says whether they are the same
   * one. The headless adapters share vanilla's symbol deliberately — they *are* vanilla underneath,
   * and pretending otherwise would make an identity check report a difference that does not exist.
   */
  readonly id: symbol;
  /** e.g. `"vanilla"`, `"vue"`, `"solid"`, `"angular"`. What it calls itself, for diagnostics. */
  readonly kind: string;
  /**
   * What this reactivity can actually do. Required: the engine asks it before using a feature, and
   * an adapter that answered nothing left the engine guessing.
   *
   * This is what `canEffect` was for — a guaranteed answer to the one question the engine could not
   * do without, standing in while `capabilities` was still optional. Every adapter declares them
   * now, so there is one way to ask and the alias is gone.
   */
  readonly capabilities: MdyReactivityCapabilities;

  signal<T>(initial: T, options?: MdySignalOptions<T>): MdyWritableSignal<T>;
  computed<T>(fn: () => T, options?: MdyComputedOptions<T>): MdySignal<T>;
  effect(
    fn: (onCleanup: MdyOnCleanup) => void,
    options?: MdyEffectOptions,
  ): MdyEffectRef;
  untracked<T>(fn: () => T): T;

  /** Optional until every adapter implements ownership. */
  createScope?(options?: MdyScopeOptions): MdyReactiveScope;

}
