/**
 * @modyra/solid — binds the Modyra form engine to Solid's reactivity.
 *
 * Solid's primitives map almost 1:1 onto the engine's reactive contract:
 * `createSignal` → signal, `createMemo` → computed, `createEffect` →
 * effect. The one gap is a manually-destroyable effect handle (the engine
 * calls `effect(...).destroy()` outside any component lifecycle, e.g. for
 * async validators/drafts/history) — each effect runs inside its own
 * `createRoot` so `destroy()` disposes it independent of the caller's own
 * owner.
 *
 * Testing/SSR note: solid-js's `package.json` maps the plain Node import
 * condition to `dist/server.js`, a non-reactive SSR stub (signals/effects
 * run once, never notify). Any Node process consuming this package —
 * `node --test`, a server-rendered handler, ts-node, etc. — must be run
 * with `--conditions=browser` (see this package's own `test` script) or
 * every signal in this file silently becomes inert.
 */
import {
  createForm,
  MdyBatchingCapability,
  MdyComputedOptions,
  MdyCoreFormOptions,
  MdyDestroyedScopeError,
  MdyEffectOptions,
  MdyEffectRef,
  MdyFlushCapability,
  MdyFormSchema,
  MdyFormValue,
  MdyObserveCapability,
  MdyObserveOptions,
  MdyOnCleanup,
  MdyReactiveScope,
  MdyReactivity,
  MdyScopeOptions,
  MdySignal,
  MdySignalOptions,
  MdyTypedForm,
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

/** Modyra's reactive contract implemented on Solid's native signals. */
export function solidReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
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
      writableComputed: false,
      graphInspection: false,
      serverSnapshots: false,
    },
    canEffect: true,
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
// makes `run()` use Solid's real owner tree for whatever it creates.

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

/**
 * `createForm` preconfigured with Solid reactivity:
 *
 * ```ts
 * const form = createSolidForm({ email: field("", [required()]) });
 * // form.f.email.value() participates in Solid's reactive graph
 * ```
 */
export function createSolidForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: solidReactivity() });
}

/**
 * Solid variant of {@link createSolidForm}: when called inside an active
 * owner (a component or `createRoot`), the form is automatically destroyed
 * on owner cleanup.
 */
export function useSolidForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  const form = createSolidForm(schema, options);
  if (getOwner() !== null) {
    onCleanup(() => form.destroy());
  }
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";
