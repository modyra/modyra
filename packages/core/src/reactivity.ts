/**
 * Reactive contract the form engine is written against.
 *
 * The engine never imports a framework: it only needs something that can
 * create writable signals, derived computations and effects. Adapters bind
 * these to their host framework (Angular passes its native signals, so the
 * engine's state integrates with change detection); `vanillaReactivity()`
 * is a dependency-tracked implementation for Node, CLIs and plain unit
 * tests.
 *
 * See `.modyra/piano-modyra-reactivity-adapter-api.md` for the full protocol
 * spec this contract is being migrated towards. `capabilities`, `createScope`,
 * `id` and `kind` are optional on the type for now so existing adapters
 * (Vue/Solid/Angular) keep compiling unmodified — they become load-bearing
 * once each adapter is migrated (Milestones 2-4 of that plan).
 */
import { MdyDestroyedScopeError } from "./reactivity-errors.js";

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
 * Garanzie osservabili di un adapter (Livello B, piano §4.3) — devono
 * riflettere comportamento reale, mai la sola presenza di un metodo
 * (§8.1 "nessuna capability fittizia").
 */
/**
 * Optional Level-B capability (piano §6.1): a real runtime-coalescing
 * `batch()`, distinct from `MdyFormEngine.mutate()`'s domain-level
 * coalescing (history/notifications) — `mutate()` delegates to this when
 * an adapter reports `capabilities.batching: true`, and works correctly
 * without it otherwise. No shipped adapter implements this yet.
 */
export interface MdyBatchingCapability {
  batch<T>(fn: () => T): T;
}

/** Optional Level-B capability (piano §6.2): a deterministic settle point. */
export interface MdyFlushCapability {
  flush(): void | Promise<void>;
}

export interface MdyObserveOptions<T> {
  equal?: MdyEqualityFn<T>;
  timing?: "sync" | "runtime";
}

/**
 * Optional Level-B capability (piano §6.3): a selector-based subscription
 * that only notifies on an actual change (per `equal`), skipping the
 * initial run. Must be executed by the runtime that owns the observed
 * signals — never bridged through an unrelated reactivity instance
 * (piano §10.1's cross-runtime rule applies here too).
 */
export interface MdyObserveCapability {
  observe<T>(
    selector: () => T,
    listener: (value: T, previous: T) => void,
    options?: MdyObserveOptions<T>,
  ): MdyEffectRef;
}

export interface MdyReactivityCapabilities {
  readonly effects: boolean;
  readonly effectOwnership: boolean;
  readonly signalEquality: boolean;
  readonly computedEquality: boolean;
  readonly batching: boolean;
  readonly deterministicFlush: boolean;
  readonly directObservation: boolean;
  readonly writableComputed: boolean;
  readonly graphInspection: boolean;
  readonly serverSnapshots: boolean;
}

export interface MdyScopeOptions {
  debugName?: string;
  parent?: MdyReactiveScope;
}

/** Ownership/lifecycle boundary — see piano §5. */
export interface MdyReactiveScope {
  readonly id: symbol;
  readonly destroyed: boolean;
  run<T>(fn: () => T): T;
  onCleanup(cleanup: () => void): void;
  destroy(): void;
}

export interface MdyReactivity {
  /** Optional until every adapter is migrated (piano Milestone 4-5). */
  readonly id?: symbol;
  /** e.g. "vanilla", "vue", "solid", "angular". Optional during migration. */
  readonly kind?: string;
  /** Optional until every adapter reports real capabilities (piano Milestone 1). */
  readonly capabilities?: MdyReactivityCapabilities;

  signal<T>(initial: T, options?: MdySignalOptions<T>): MdyWritableSignal<T>;
  computed<T>(fn: () => T, options?: MdyComputedOptions<T>): MdySignal<T>;
  effect(
    fn: (onCleanup: MdyOnCleanup) => void,
    options?: MdyEffectOptions,
  ): MdyEffectRef;
  untracked<T>(fn: () => T): T;

  /** Optional until every adapter implements ownership (piano Milestone 2-4). */
  createScope?(options?: MdyScopeOptions): MdyReactiveScope;

  /**
   * @deprecated use `capabilities.effects` instead. Kept as a temporary
   * alias so existing adapters/callers keep compiling during the migration
   * (piano §4.4). False when this reactivity cannot run effects (e.g. an
   * Angular adapter constructed without an Injector) — effect-dependent
   * features (async validators, drafts, history) are skipped with a warning.
   */
  readonly canEffect: boolean;
}

// ─── Vanilla implementation ───────────────────────────────────────────────────

interface Consumer {
  markStale(): void;
  readonly producers: Set<ProducerNode>;
}

interface ProducerNode {
  readonly consumers: Set<Consumer>;
}

let activeConsumer: Consumer | null = null;

// ─── Shared effect scheduler (piano §6.1/§6.2: batch()/flush()) ───────────────
//
// Every VanillaEffect schedules itself into one shared pending set instead of
// queueing its own microtask. This is what makes batch() and flush() real:
// batch() suppresses the drain while its callback runs and then drains once,
// synchronously, before returning; flush() drains synchronously too. Neither
// changes the default (non-batch, non-flush) timing — the first effect to go
// stale still queues exactly one microtask, same as before this milestone.

const pendingEffects = new Set<VanillaEffect>();
let drainScheduled = false;
let batchDepth = 0;

function scheduleEffect(effectNode: VanillaEffect): void {
  pendingEffects.add(effectNode);
  if (batchDepth > 0 || drainScheduled) return;
  drainScheduled = true;
  queueMicrotask(() => {
    drainScheduled = false;
    if (batchDepth === 0) drainPendingEffects();
  });
}

/** Runs every pending effect, looping until none remain (settles chained re-triggers too). */
function drainPendingEffects(): void {
  while (pendingEffects.size > 0) {
    const snapshot = [...pendingEffects];
    pendingEffects.clear();
    for (const effectNode of snapshot) effectNode.runIfPending();
  }
}

function track(producer: ProducerNode): void {
  if (activeConsumer) {
    producer.consumers.add(activeConsumer);
    activeConsumer.producers.add(producer);
  }
}

function dropDependencies(consumer: Consumer): void {
  for (const producer of consumer.producers) {
    producer.consumers.delete(consumer);
  }
  consumer.producers.clear();
}

class VanillaSignal<T> implements ProducerNode {
  readonly consumers = new Set<Consumer>();
  private readonly _equal: MdyEqualityFn<T>;
  constructor(private _value: T, equal?: MdyEqualityFn<T>) {
    this._equal = equal ?? Object.is;
  }

  read(): T {
    track(this);
    return this._value;
  }

  write(value: T): void {
    if (this._equal(this._value, value)) return;
    this._value = value;
    for (const consumer of [...this.consumers]) consumer.markStale();
  }
}

class VanillaComputed<T> implements ProducerNode, Consumer {
  readonly consumers = new Set<Consumer>();
  readonly producers = new Set<ProducerNode>();
  private readonly _equal: MdyEqualityFn<T>;
  private _value!: T;
  private _dirty = true;

  constructor(private readonly _fn: () => T, equal?: MdyEqualityFn<T>) {
    this._equal = equal ?? Object.is;
  }

  markStale(): void {
    if (this._dirty) return;
    this._dirty = true;
    for (const consumer of [...this.consumers]) consumer.markStale();
  }

  read(): T {
    track(this);
    if (this._dirty) {
      dropDependencies(this);
      const prev = activeConsumer;
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- subscriber stack: save/restore around recompute
      activeConsumer = this;
      const previousValue = this._value;
      const hadValue = !this._isInitial;
      try {
        this._value = this._fn();
      } finally {
        activeConsumer = prev;
      }
      // Re-apply equality after recompute so an unchanged derived value does
      // not propagate staleness to its own consumers (mirrors what a
      // native-signal framework's `computed({ equal })` guarantees).
      if (hadValue && this._equal(previousValue, this._value)) {
        this._value = previousValue;
      }
      this._isInitial = false;
      this._dirty = false;
    }
    return this._value;
  }

  private _isInitial = true;
}

class VanillaEffect implements Consumer {
  readonly producers = new Set<ProducerNode>();
  private _destroyed = false;
  private _cleanups: Array<() => void> = [];

  constructor(
    private readonly _fn: (onCleanup: MdyOnCleanup) => void,
    private readonly _onError?: (error: unknown) => void,
  ) {
    this._run();
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  markStale(): void {
    if (this._destroyed) return;
    scheduleEffect(this);
  }

  /** Called only from the shared drain — set membership was the schedule marker. */
  runIfPending(): void {
    if (this._destroyed) return;
    this._run();
  }

  private _run(): void {
    this._runCleanups();
    dropDependencies(this);
    const prev = activeConsumer;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- subscriber stack: save/restore around recompute
    activeConsumer = this;
    try {
      this._fn((cleanup) => this._cleanups.push(cleanup));
    } catch (error) {
      if (this._onError) this._onError(error);
      else throw error;
    } finally {
      activeConsumer = prev;
    }
  }

  private _runCleanups(): void {
    const cleanups = this._cleanups;
    this._cleanups = [];
    for (const cleanup of cleanups) cleanup();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    pendingEffects.delete(this);
    this._runCleanups();
    dropDependencies(this);
  }
}

class VanillaScope implements MdyReactiveScope {
  readonly id: symbol;
  private _destroyed = false;
  private _cleanups: Array<() => void> = [];
  private readonly _children = new Set<VanillaScope>();

  constructor(
    debugName: string | undefined,
    private readonly _parent?: VanillaScope,
  ) {
    this.id = Symbol(debugName ?? "scope");
    if (_parent) {
      if (_parent.destroyed) throw new MdyDestroyedScopeError(_parent.id);
      _parent._children.add(this);
    }
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  run<T>(fn: () => T): T {
    if (this._destroyed) throw new MdyDestroyedScopeError(this.id);
    return fn();
  }

  onCleanup(cleanup: () => void): void {
    if (this._destroyed) throw new MdyDestroyedScopeError(this.id);
    this._cleanups.push(cleanup);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._parent?._children.delete(this);
    for (const child of [...this._children]) child.destroy();
    this._children.clear();
    const cleanups = this._cleanups;
    this._cleanups = [];
    for (const cleanup of cleanups) cleanup();
  }
}

/**
 * Standalone reactive engine: dependency-tracked signals, lazy cached
 * computeds and microtask-batched effects. Enough to run the whole form
 * engine outside any framework — the "decisive test":
 *
 * ```ts
 * const form = createForm({ email: field("") });
 * form.f.email.set("foo@bar.com");
 * console.log(form.f.email.errors());
 * ```
 *
 * works in Node with no framework installed. Await a microtask
 * (`await Promise.resolve()`) after writes when asserting on
 * effect-driven state (async validators, drafts, history).
 */
export function vanillaReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
  return {
    id: Symbol("vanilla"),
    kind: "vanilla",
    // writableComputed/graphInspection/serverSnapshots are not implemented
    // (out of scope per piano §6.4-§6.5/§10.7 — reporting them true would
    // be exactly the "fictitious capability" the plan's §8.1 forbids).
    capabilities: {
      effects: true,
      effectOwnership: true,
      signalEquality: true,
      // A recomputed value that's equal to the previous one is reused (so a
      // consumer's `Object.is` on the returned value still short-circuits),
      // but staleness already propagated synchronously at write time before
      // the equality check runs — this does NOT stop a downstream
      // computed/effect from re-running. Best-effort per piano §4.2, not a
      // full glitch-free guarantee, so this stays false.
      computedEquality: false,
      batching: true,
      deterministicFlush: true,
      directObservation: true,
      writableComputed: false,
      graphInspection: false,
      serverSnapshots: false,
    },
    canEffect: true,
    signal<T>(initial: T, options?: MdySignalOptions<T>): MdyWritableSignal<T> {
      const node = new VanillaSignal(initial, options?.equal);
      const read = (() => node.read()) as MdyWritableSignal<T>;
      read.set = (value: T) => node.write(value);
      read.update = (fn: (value: T) => T) =>
        node.write(fn(untrackedRead(() => node.read())));
      read.asReadonly = () => () => node.read();
      return read;
    },
    computed<T>(fn: () => T, options?: MdyComputedOptions<T>): MdySignal<T> {
      const node = new VanillaComputed(fn, options?.equal);
      return () => node.read();
    },
    effect(
      fn: (onCleanup: MdyOnCleanup) => void,
      options?: MdyEffectOptions,
    ): MdyEffectRef {
      if (options?.scope?.destroyed) {
        throw new MdyDestroyedScopeError(
          (options.scope as { id?: symbol }).id,
        );
      }
      const node = new VanillaEffect(fn, options?.onError);
      const ref: MdyEffectRef = {
        destroy: () => node.destroy(),
        get destroyed() {
          return node.destroyed;
        },
      };
      options?.scope?.onCleanup(() => ref.destroy());
      return ref;
    },
    untracked: untrackedRead,
    createScope(options?: MdyScopeOptions): MdyReactiveScope {
      return new VanillaScope(
        options?.debugName,
        options?.parent as VanillaScope | undefined,
      );
    },
    batch<T>(fn: () => T): T {
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) drainPendingEffects();
      }
    },
    flush(): Promise<void> {
      // Deterministic, not "wait one tick": drainPendingEffects() loops
      // until settled, so a chain of effects each triggering the next all
      // resolve within this one flush() rather than needing N awaits.
      return Promise.resolve().then(() => {
        drainPendingEffects();
      });
    },
    observe<T>(
      selector: () => T,
      listener: (value: T, previous: T) => void,
      options?: MdyObserveOptions<T>,
    ): MdyEffectRef {
      // `options.timing` is accepted but not differentiated: vanilla only
      // has one timing model (microtask-scheduled, same as effect()) —
      // best-effort per piano §4.2 rather than rejecting the option.
      const equal = options?.equal ?? Object.is;
      let hasPrevious = false;
      let previous: T;
      const node = new VanillaEffect(() => {
        const current = selector();
        if (!hasPrevious) {
          hasPrevious = true;
          previous = current;
          return; // no "previous" to report yet — only fire on later changes
        }
        if (equal(previous, current)) return;
        const prev = previous;
        previous = current;
        listener(current, prev);
      });
      return {
        destroy: () => node.destroy(),
        get destroyed() {
          return node.destroyed;
        },
      };
    },
  };
}

function untrackedRead<T>(fn: () => T): T {
  const prev = activeConsumer;
  activeConsumer = null;
  try {
    return fn();
  } finally {
    activeConsumer = prev;
  }
}
