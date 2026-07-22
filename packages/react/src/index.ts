/**
 * @modyra/react — React binding for the Modyra form engine.
 *
 * React has no signal primitive, so the engine runs on the core's
 * `vanillaReactivity()` and components subscribe through
 * `useSyncExternalStore`-compatible stores.
 */
import {
  createForm,
  getFieldHandleOwner,
  MdyCoreFormOptions,
  MdyFieldHandle,
  MdyFormSchema,
  MdyFormValue,
  MdyReactivity,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";
import { useEffect, useMemo, useSyncExternalStore } from "react";

/** A `useSyncExternalStore`-compatible view over reactive Modyra state. */
export interface MdyStore {
  subscribe(onChange: () => void): () => void;
  /** Monotonic version — bumps whenever any tracked signal changes. */
  getSnapshot(): number;
}

/**
 * Builds a store that notifies whenever any of the given signals change.
 * Framework-free (testable in Node); the React hooks below are thin
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
 * {@link getFieldHandleOwner}) instead of a fresh, unrelated instance — the
 * fix for the cross-runtime observation trap noted in §10.1: this makes it
 * safe to pass a handle from ANY Modyra adapter's form (Vue, Solid,
 * Angular, vanilla), not just one created by this package's own
 * `useMdyForm`.
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
 * <input value={email.value} onChange={(e) => form.f.email.set(e.target.value)} />
 * ```
 */
export function useMdyForm<S extends MdyFormSchema>(
  schema: () => S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  // Intentional empty deps: one form per component instance.
  const form = useMemo(() => createForm(schema(), options), []);
  // The form owns effects/timers (draft/history/async validators), so the
  // component unmount must release them.
  useEffect(() => () => form.destroy(), [form]);
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
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
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
