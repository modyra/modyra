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
  MdyCoreFormOptions,
  MdyFieldHandle,
  MdyFormSchema,
  MdyFormValue,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";
import { useSyncExternalStore } from "preact/compat";
import { useEffect, useMemo } from "preact/hooks";

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
 * <input value={email.value} onChange={(e) => form.f.email.set(e.currentTarget.value)} />
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
