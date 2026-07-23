/**
 * @modyra/preact — Preact binding for the Modyra form engine.
 *
 * A thin variant of `@modyra/react`: Preact has no signal primitive either,
 * so the engine runs on the core's `vanillaReactivity()` and components
 * subscribe through `useSyncExternalStore` — Preact ships this via
 * `preact/compat`, its React-compatibility layer, rather than natively in
 * `preact/hooks`.
 */
import {
  createForm,
  getFieldHandleOwner,
  MdyBatchingCapability,
  MdyCoreFormOptions,
  MdyFieldHandle,
  MdyFlushCapability,
  MdyFormSchema,
  MdyFormValue,
  MdyObserveCapability,
  MdyReactivity,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";
import { useSyncExternalStore } from "preact/compat";
import { useEffect, useMemo } from "preact/hooks";

/**
 * `vanillaReactivity()` tagged `kind: "preact"` — same reasoning as
 * `@modyra/react`'s `reactReactivity()`: `useMdyForm` already runs on the
 * vanilla graph by default, this just gives the capability matrix
 * (`scripts/reactivity-capability-matrix.mjs`) a named export to introspect.
 */
export function preactReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
  return { ...vanillaReactivity(), kind: "preact" };
}

/** A `useSyncExternalStore`-compatible view over reactive Modyra state. */
export interface MdyStore {
  subscribe(onChange: () => void): () => void;
  /** Monotonic version — bumps whenever any tracked signal changes. */
  getSnapshot(): number;
}

/**
 * Builds a store that notifies whenever any of the given signals change.
 * Framework-free (testable in Node); the Preact hooks below are thin
 * wrappers over it.
 *
 * `reactivity` must be the runtime that actually owns `signals` — observing
 * them from an unrelated instance is the cross-runtime bug
 * piano-modyra-reactivity-adapter-api.md §10.1 forbids. Defaults to a fresh
 * `vanillaReactivity()` only for direct callers that don't have a handle to
 * resolve an owner from (matches this function's pre-M5 behavior).
 */
export function createStore(
  signals: ReadonlyArray<MdySignal<unknown>>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyStore & { destroy(): void } {
  const rx = reactivity;
  const listeners = new Set<() => void>();
  let version = 0;
  let first = true;
  const ref = rx.effect(() => {
    for (const signal of signals) signal();
    if (first) {
      first = false; // the initial run only collects dependencies
      return;
    }
    version++;
    for (const listener of [...listeners]) listener();
  });
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => version,
    destroy: () => ref.destroy(),
  };
}

/**
 * Store over everything a field row usually renders. Observes through the
 * reactivity that actually created `handle` (resolved via
 * {@link getFieldHandleOwner}) instead of a fresh, unrelated instance — see
 * `@modyra/react`'s equivalent for the cross-runtime bug this fixes.
 */
export function createFieldStore(
  handle: MdyFieldHandle<unknown>,
): MdyStore & { destroy(): void } {
  return createStore(
    [
      handle.value,
      handle.errors,
      handle.touched,
      handle.dirty,
      handle.valid,
      handle.pending,
      handle.disabled,
    ],
    getFieldHandleOwner(handle),
  );
}

/**
 * Creates (once) a typed form running on the vanilla graph.
 *
 * ```tsx
 * const form = useMdyForm(() => ({ email: field("", [required()]) }));
 * const email = useMdyField(form.f.email);
 * <input value={email.value} onChange={(e) => form.f.email.set(e.currentTarget.value)} />
 * ```
 *
 * Construction stays pure (`autoActivate: false` — piano §10.5/§10.7): no
 * timer, storage read or network call happens until the component actually
 * mounts. `useEffect` calls `form.activate()` on mount and `form.deactivate()`
 * on cleanup instead of `form.destroy()` — this makes the hook tolerant of
 * Preact's own Strict-Mode-equivalent double-invoke checks (activate/
 * deactivate are idempotent and preserve all state) and safe during SSR
 * (the server-rendered pass never runs `useEffect`, so nothing client-only
 * ever starts). `form.destroy()` remains available for a hard, final
 * teardown — call it yourself; the hook no longer does.
 */
export function useMdyForm<S extends MdyFormSchema>(
  schema: () => S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  // Intentional empty deps: one form per component instance.
  const form = useMemo(
    () => createForm(schema(), { ...options, autoActivate: false }),
    [],
  );
  useEffect(() => {
    form.activate();
    return () => form.deactivate();
  }, [form]);
  return form;
}

/** Subscribes the component to one field and returns its current state. */
export function useMdyField<T>(handle: MdyFieldHandle<T>): {
  readonly value: T;
  readonly errors: ReadonlyArray<{ readonly kind: string; readonly message: string }>;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly valid: boolean;
  readonly pending: boolean;
  readonly disabled: boolean;
  set(value: T): void;
  markAsTouched(): void;
} {
  const store = useMemo(
    () => createFieldStore(handle as MdyFieldHandle<unknown>),
    [handle],
  );
  // The tracking effect must not outlive the component.
  useEffect(() => () => store.destroy(), [store]);
  // Preact's `useSyncExternalStore` (via preact/compat) takes no
  // getServerSnapshot argument, unlike React's.
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    value: handle.value(),
    errors: handle.errors(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    valid: handle.valid(),
    pending: handle.pending(),
    disabled: handle.disabled(),
    set: handle.set,
    markAsTouched: handle.markAsTouched,
  };
}

export * from "@modyra/core";
export * from "./widgets/index.js";
