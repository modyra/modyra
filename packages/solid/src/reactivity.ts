/**
 * Modyra's reactive contract on solid-js.
 *
 * Its own module rather than the package entry: a widget hook needs the binding, the entry
 * re-exports the hooks, and a binding declared in the entry makes the two import each other.
 */

import {
  MdyBatchingCapability,
  MdyComputedOptions,
  MdyDestroyedScopeError,
  MdyEffectOptions,
  MdyEffectRef,
  MdyFlushCapability,
  MdyObserveCapability,
  MdyObserveOptions,
  MdyOnCleanup,
  MdyReactiveScope,
  MdyReactivity,
  vanillaReactivity,
  MdyScopeOptions,
  MdySignal,
  MdySignalOptions,
  MdyWritableSignal,
} from "@modyra/core";
import {
  batch as solidBatch,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
  type Owner,
} from "solid-js";

/**
 * Builds one effect as its own disposable `createRoot` — the engine calls
 * `effect(...).destroy()` outside any component lifecycle (async
 * validators/drafts/history), and Solid has no other way to hand back a
 * destroyable handle for a single `createEffect`. Shared by `effect()` and
 * `observe()` below.
 */
function makeEffectRef(
  fn: (onCleanup: MdyOnCleanup) => void,
  onError?: (error: unknown) => void,
): MdyEffectRef {
  let dispose!: () => void;
  let destroyed = false;
  createRoot((disposeRoot) => {
    dispose = disposeRoot;
    createEffect(() => {
      try {
        fn((cleanup) => onCleanup(cleanup));
      } catch (error) {
        if (onError) onError(error);
        else throw error;
      }
    });
  });
  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      dispose();
    },
    get destroyed() {
      return destroyed;
    },
  };
}

/**
 * Whether the Solid build this process resolved has a live graph.
 *
 * Node without the `browser` export condition resolves `solid-js/dist/server.cjs` — the build a
 * **server render** uses. There `createMemo` computes once and never again and `createEffect` never
 * runs, so every derived value in a form freezes at the state it was created in: a form with an
 * empty `required` field reports `valid: true` and `canSubmit: true`, and keeps reporting it after a
 * write.
 *
 * That is the dangerous direction. A server consulting the form to decide whether to accept a
 * submission is told yes about a form that is not valid, and nothing raises.
 *
 * Probed rather than sniffed for a filename: the question is whether a computation re-runs, and
 * asking it directly answers for any build, bundler or future version. One signal and one memo, once
 * per call.
 */
function graphRecomputes(): boolean {
  const value = createSignal(0);
  const doubled = createMemo(() => value[0]() * 2);
  value[1](1);
  return doubled() === 2;
}

let inertGraphReported = false;

/** Modyra's reactive contract implemented on Solid's native signals. */
export function solidReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
  if (!graphRecomputes()) {
    // The vanilla graph, wearing this runtime's name. A server render reads each value once and
    // emits markup, which vanilla does correctly and this build cannot do at all — so falling back
    // renders a form that tells the truth, where refusing would render nothing and continuing would
    // render a form claiming to be valid. The client build has a live graph and never reaches here,
    // so hydration runs on Solid's own signals as always.
    if (!inertGraphReported) {
      inertGraphReported = true;
      console.warn(
        "[modyra] @modyra/solid: this process resolved Solid's server build, whose computations " +
        "never re-run — a form on it would freeze at its initial state and report itself valid. " +
        "Falling back to the framework-agnostic graph for this render; the client build is " +
        "unaffected.",
      );
    }
    return { ...vanillaReactivity(), kind: "solid" } as MdyReactivity &
      MdyBatchingCapability &
      MdyFlushCapability &
      MdyObserveCapability;
  }
  return {
    id: Symbol("solid"),
    kind: "solid",
    capabilities: {
      effects: true,
      effectOwnership: true,
      // createSignal/createMemo both accept a real `equals` comparator,
      // and — verified directly, not assumed — a memo's own equals stops
      // staleness from propagating to its downstream consumers too (a
      // stronger guarantee than vanilla's own `computedEquality: false`,
      // where the propagation-before-check caveat applies).
      signalEquality: true,
      computedEquality: true,
      // Solid's own batch() is real: multiple writes inside it settle
      // synchronously by the time it returns, including chained
      // effect-triggers-effect cascades (verified directly) — not a
      // custom scheduler bolted on, this is Solid's native behavior.
      batching: true,
      // Effects (initial run included) are natively microtask-deferred;
      // one microtask reliably settles even a multi-hop chain (verified
      // directly), so flush() needs no manual drain loop the way
      // vanilla's/Vue's do.
      deterministicFlush: true,
      directObservation: true,
      // Solid's createMemo does not refuse a write from inside; the rule still holds for code that
      // must run under every adapter, this graph just will not notice the breach.
      pureComputeds: false,
      graphInspection: false,
      serverSnapshots: false,
    },
    signal<T>(initial: T, options?: MdySignalOptions<T>): MdyWritableSignal<T> {
      // `equals: false` is a special Solid sentinel meaning "always treat
      // as changed" -- omitting the option entirely (not passing `false`)
      // is what keeps Solid's own default (Object.is-like) equality when
      // no custom comparator is given.
      const [get, set] = createSignal(
        initial,
        options?.equal ? { equals: options.equal } : undefined,
      );
      const read = (() => get()) as MdyWritableSignal<T>;
      // Wrapped in `() => value`: Solid's setter calls a function argument
      // as an updater, which would misfire for field values that happen
      // to be functions themselves.
      read.set = (value: T) => set(() => value);
      read.update = (fn: (value: T) => T) => set((prev) => fn(prev as T));
      read.asReadonly = () => () => get();
      return read;
    },
    computed<T>(fn: () => T, options?: MdyComputedOptions<T>): MdySignal<T> {
      const memo = createMemo(
        fn,
        undefined,
        options?.equal ? { equals: options.equal } : undefined,
      );
      return () => memo();
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
      const ref = makeEffectRef(fn, options?.onError);
      options?.scope?.onCleanup(() => ref.destroy());
      return ref;
    },
    untracked<T>(fn: () => T): T {
      return untrack(fn);
    },
    createScope(options?: MdyScopeOptions): MdyReactiveScope {
      return new SolidScope(options?.debugName, options?.parent as SolidScope | undefined);
    },
    batch<T>(fn: () => T): T {
      return solidBatch(fn);
    },
    flush(): Promise<void> {
      // Solid's own scheduler settles a pending effect chain within one
      // microtask (verified directly, including multi-hop chains) — no
      // manual drain loop needed here the way vanilla's/Vue's require.
      return Promise.resolve().then(() => {});
    },
    observe<T>(
      selector: () => T,
      listener: (value: T, previous: T) => void,
      options?: MdyObserveOptions<T>,
    ): MdyEffectRef {
      // `options.timing` is accepted but not differentiated: this adapter
      // only has one timing model (Solid's own effect scheduling).
      const equal = options?.equal ?? Object.is;
      let hasPrevious = false;
      let previous: T;
      return makeEffectRef(() => {
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
    },
  };
}

// ─── Scope: an explicit parent/child tree over Solid's own disposal roots
// (piano §5) ─────────────────────────────────────────────────────────────
//
// createRoot() always creates an independent root, not nested under
// whatever owner is currently active — unlike Vue's effectScope(), Solid
// has no "create this nested under the current scope" primitive. So
// cascade-on-destroy is managed explicitly here (same bookkeeping as
// vanillaReactivity()'s own VanillaScope), while runWithOwner() still
// makes `run()` use Solid's owner tree for whatever it creates.

class SolidScope implements MdyReactiveScope {
  readonly id: symbol;
  private _destroyed = false;
  private _cleanups: Array<() => void> = [];
  private readonly _children = new Set<SolidScope>();
  private readonly _owner: Owner | null;
  private readonly _disposeRoot: () => void;

  constructor(
    debugName: string | undefined,
    private readonly _parent?: SolidScope,
  ) {
    this.id = Symbol(debugName ?? "scope");
    if (_parent) {
      if (_parent.destroyed) throw new MdyDestroyedScopeError(_parent.id);
      _parent._children.add(this);
    }
    let owner: Owner | null = null;
    let dispose!: () => void;
    createRoot((disposeRoot) => {
      dispose = disposeRoot;
      owner = getOwner();
    });
    this._owner = owner;
    this._disposeRoot = dispose;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  run<T>(fn: () => T): T {
    if (this._destroyed) throw new MdyDestroyedScopeError(this.id);
    return runWithOwner(this._owner, fn) as T;
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
    this._disposeRoot();
  }
}
