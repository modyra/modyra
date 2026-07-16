/**
 * @modyra/react — React binding for the Modyra form engine.
 *
 * React has no signal primitive, so the engine runs on the core's
 * `vanillaReactivity()` and components subscribe through
 * `useSyncExternalStore`-compatible stores.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createForm,
  MdyCoreFormOptions,
  MdyFieldHandle,
  MdyFormSchema,
  MdyFormValue,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";

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
 */
export function createStore(
  signals: ReadonlyArray<MdySignal<unknown>>,
): MdyStore & { destroy(): void } {
  const rx = vanillaReactivity();
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

/** Store over everything a field row usually renders. */
export function createFieldStore(
  handle: MdyFieldHandle<unknown>,
): MdyStore & { destroy(): void } {
  return createStore([
    handle.value,
    handle.errors,
    handle.touched,
    handle.dirty,
    handle.valid,
    handle.pending,
    handle.disabled,
  ]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createForm(schema(), options), []);
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
