/**
 * @modyra/vue — binds the Modyra form engine to Vue's reactivity.
 *
 * Form state becomes @vue/reactivity state (shallowRef/computed), so
 * templates and watchers react to it natively. `effect()` runs on a real
 * scheduler (piano §6.1/§6.2, same shared-drain design as vanilla's own
 * Milestone 3), so `batch()`/`flush()` are real, not aliases for
 * `Promise.resolve()`; `createScope()` wraps Vue's own `effectScope()`
 * rather than a hand-rolled tree, so nesting/cascade-on-dispose is Vue's
 * own, native behavior.
 */
import {
  MdyBatchingCapability,
  MdyComputedOptions,
  createForm,
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
  effectScope,
  getCurrentScope,
  onScopeDispose,
  pauseTracking,
  resetTracking,
  shallowRef,
  stop,
  computed as vueComputed,
  effect as vueEffect,
  type EffectScope,
  type ReactiveEffectRunner,
} from "@vue/reactivity";

// ─── Shared effect scheduler (mirrors vanillaReactivity()'s own Milestone 3
// design in packages/core/src/reactivity.ts) ────────────────────────────────
//
// Vue's own `effect(fn, { scheduler })` hook is what makes this possible:
// without a scheduler, @vue/reactivity re-runs an effect synchronously on
// every dependency write (no batching at all). With one, Vue calls the
// scheduler instead of re-running directly, so *when* the effect actually
// re-executes is entirely up to us — same shared pending-set +
// queueMicrotask drain as vanilla, so batch()/flush() are real here too,
// not just delegated to `Promise.resolve()`.

const pendingEffects = new Set<VueScheduledEffect>();
let drainScheduled = false;
let batchDepth = 0;

function scheduleEffect(node: VueScheduledEffect): void {
  pendingEffects.add(node);
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
    for (const node of snapshot) {
      try {
        node.runIfPending();
      } catch (error) {
        // Mirrors vanilla's own reasoning exactly: a rethrow here would
        // become an unhandled microtask exception with no global handler.
        console.error("[modyra] Uncaught error in effect:", error);
      }
    }
  }
}

class VueScheduledEffect {
  private _destroyed = false;
  private _cleanups: Array<() => void> = [];
  private readonly _runner: ReactiveEffectRunner;

  constructor(
    fn: (onCleanup: MdyOnCleanup) => void,
    private readonly _onError?: (error: unknown) => void,
  ) {
    this._runner = vueEffect(
      () => {
        this._runCleanups();
        fn((cleanup) => this._cleanups.push(cleanup));
      },
      { scheduler: () => scheduleEffect(this) },
    );
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  /** Called only from the shared drain — set membership was the schedule marker. */
  runIfPending(): void {
    if (this._destroyed) return;
    try {
      this._runner();
    } catch (error) {
      if (this._onError) this._onError(error);
      else throw error;
    }
  }

  private _runCleanups(): void {
    const list = this._cleanups;
    this._cleanups = [];
    for (const cleanup of list) cleanup();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    pendingEffects.delete(this);
    this._runCleanups();
    stop(this._runner);
  }
}

// ─── Scope: wraps Vue's own effectScope() (piano §5) ───────────────────────
//
// A child created via `parent.run(() => effectScope())` is automatically
// captured by Vue's own scope tree, so `parent.destroy()` cascading to it is
// native Vue behavior, not something this wrapper has to reimplement.

class VueScope implements MdyReactiveScope {
  readonly id: symbol;
  private readonly _scope: EffectScope;

  constructor(debugName: string | undefined, parent?: VueScope) {
    this.id = Symbol(debugName ?? "scope");
    if (parent) {
      if (parent.destroyed) throw new MdyDestroyedScopeError(parent.id);
      this._scope = parent._scope.run(() => effectScope())!;
    } else {
      this._scope = effectScope();
    }
  }

  get destroyed(): boolean {
    return !this._scope.active;
  }

  run<T>(fn: () => T): T {
    if (this.destroyed) throw new MdyDestroyedScopeError(this.id);
    return this._scope.run(fn) as T;
  }

  onCleanup(cleanup: () => void): void {
    if (this.destroyed) throw new MdyDestroyedScopeError(this.id);
    // onScopeDispose() registers on whichever scope is "current" — running
    // it through this._scope.run() makes that unambiguously this scope,
    // not whatever happened to be active at the call site.
    this._scope.run(() => onScopeDispose(cleanup));
  }

  destroy(): void {
    this._scope.stop();
  }
}

/** Modyra's reactive contract implemented on @vue/reactivity. */
export function vueReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
  return {
    id: Symbol("vue"),
    kind: "vue",
    capabilities: {
      effects: true,
      effectOwnership: true,
      // shallowRef's own setter already skips a same-value write; wrapped
      // below so a *custom* `options.equal` is genuinely honored too, not
      // silently ignored (piano §4.2's rule on accepted-but-unhonored options).
      signalEquality: true,
      // @vue/reactivity's computed() has no public custom-comparator hook —
      // unlike Angular's native computed(), which does. Declaring this
      // false rather than reimplementing computed() by hand around a raw
      // effect(), which would stop being "native Vue reactivity" at all.
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
      // shallowRef: the engine owns immutability (it always replaces
      // records/maps), deep proxying would change semantics.
      const r = shallowRef(initial);
      const equal = options?.equal ?? Object.is;
      const read = (() => r.value) as MdyWritableSignal<T>;
      read.set = (value: T) => {
        if (equal(r.value as T, value)) return;
        r.value = value;
      };
      read.update = (fn: (value: T) => T) => {
        const next = fn(r.value as T);
        if (equal(r.value as T, next)) return;
        r.value = next;
      };
      read.asReadonly = () => () => r.value;
      return read;
    },
    computed<T>(fn: () => T, _options?: MdyComputedOptions<T>): MdySignal<T> {
      const c = vueComputed(fn);
      return () => c.value;
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
      const node = new VueScheduledEffect(fn, options?.onError);
      const ref: MdyEffectRef = {
        destroy: () => node.destroy(),
        get destroyed() {
          return node.destroyed;
        },
      };
      options?.scope?.onCleanup(() => ref.destroy());
      return ref;
    },
    untracked<T>(fn: () => T): T {
      pauseTracking();
      try {
        return fn();
      } finally {
        resetTracking();
      }
    },
    createScope(options?: MdyScopeOptions): MdyReactiveScope {
      return new VueScope(options?.debugName, options?.parent as VueScope | undefined);
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
      // `options.timing` is accepted but not differentiated: this adapter
      // only has one timing model (microtask-scheduled, same as effect()).
      const equal = options?.equal ?? Object.is;
      let hasPrevious = false;
      let previous: T;
      const node = new VueScheduledEffect(() => {
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

/**
 * `createForm` preconfigured with Vue reactivity:
 *
 * ```ts
 * const form = createVueForm({ email: field("", [required()]) });
 * // form.f.email.value() participates in Vue reactivity
 * ```
 */
export function createVueForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: vueReactivity() });
}

/**
 * Vue composable variant of {@link createVueForm}: when called inside an
 * active effect scope, the form is automatically destroyed on scope dispose.
 */
export function useVueForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  const form = createVueForm(schema, options);
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => form.destroy());
  }
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";
