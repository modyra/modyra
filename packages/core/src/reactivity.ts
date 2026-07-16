/**
 * Reactive contract the form engine is written against.
 *
 * The engine never imports a framework: it only needs something that can
 * create writable signals, derived computations and effects. Adapters bind
 * these to their host framework (Angular passes its native signals, so the
 * engine's state integrates with change detection); `vanillaReactivity()`
 * is a dependency-tracked implementation for Node, CLIs and plain unit
 * tests.
 */

/** Read-only reactive value — call it to read (and track) the value. */
export interface MdySignal<T> {
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
}

/** Registers a callback run before the next effect run (or on destroy). */
export type MdyOnCleanup = (cleanup: () => void) => void;

export interface MdyReactivity {
  signal<T>(initial: T): MdyWritableSignal<T>;
  computed<T>(fn: () => T): MdySignal<T>;
  effect(fn: (onCleanup: MdyOnCleanup) => void): MdyEffectRef;
  untracked<T>(fn: () => T): T;
  /**
   * False when this reactivity cannot run effects (e.g. an Angular adapter
   * constructed without an Injector). Effect-dependent features (async
   * validators, drafts, history) are skipped with a warning.
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
  constructor(private _value: T) {}

  read(): T {
    track(this);
    return this._value;
  }

  write(value: T): void {
    if (Object.is(this._value, value)) return;
    this._value = value;
    for (const consumer of [...this.consumers]) consumer.markStale();
  }
}

class VanillaComputed<T> implements ProducerNode, Consumer {
  readonly consumers = new Set<Consumer>();
  readonly producers = new Set<ProducerNode>();
  private _value!: T;
  private _dirty = true;

  constructor(private readonly _fn: () => T) {}

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
      activeConsumer = this;
      try {
        this._value = this._fn();
      } finally {
        activeConsumer = prev;
      }
      this._dirty = false;
    }
    return this._value;
  }
}

class VanillaEffect implements Consumer {
  readonly producers = new Set<ProducerNode>();
  private _scheduled = false;
  private _destroyed = false;
  private _cleanups: Array<() => void> = [];

  constructor(private readonly _fn: (onCleanup: MdyOnCleanup) => void) {
    this._run();
  }

  markStale(): void {
    if (this._scheduled || this._destroyed) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      if (!this._destroyed) this._run();
    });
  }

  private _run(): void {
    this._runCleanups();
    dropDependencies(this);
    const prev = activeConsumer;
    activeConsumer = this;
    try {
      this._fn((cleanup) => this._cleanups.push(cleanup));
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
    this._runCleanups();
    dropDependencies(this);
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
export function vanillaReactivity(): MdyReactivity {
  return {
    canEffect: true,
    signal<T>(initial: T): MdyWritableSignal<T> {
      const node = new VanillaSignal(initial);
      const read = (() => node.read()) as MdyWritableSignal<T>;
      read.set = (value: T) => node.write(value);
      read.update = (fn: (value: T) => T) =>
        node.write(fn(untrackedRead(() => node.read())));
      read.asReadonly = () => () => node.read();
      return read;
    },
    computed<T>(fn: () => T): MdySignal<T> {
      const node = new VanillaComputed(fn);
      return () => node.read();
    },
    effect(fn: (onCleanup: MdyOnCleanup) => void): MdyEffectRef {
      const node = new VanillaEffect(fn);
      return { destroy: () => node.destroy() };
    },
    untracked: untrackedRead,
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
