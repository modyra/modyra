/**
 * @modyra/preact — Preact binding for the Modyra form engine.
 *
 * This host has no fine-grained signal of its own, so the engine runs on the core's
 * `vanillaReactivity()` and components subscribe through `useSyncExternalStore` — which arrives
 * here via `preact/compat` rather than natively in `preact/hooks`.
 */
import {
  createForm,
  getFieldHandleOwner,
  handleFormOf,
  type MdyFieldConstraints,
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
import { errorsVisible, shownErrors, showsAsInvalid } from "@modyra/widgets";
import { useSyncExternalStore } from "preact/compat";
import { useEffect, useMemo } from "preact/hooks";

/**
 * `vanillaReactivity()` tagged `kind: "preact"`.
 *
 * `useMdyForm` already runs on the vanilla graph by default; this exists so the capability matrix
 * (`scripts/reactivity-capability-matrix.mjs`) has a named export to introspect, and so a diagnostic
 * can say which host it came from.
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
 * {@link observerFor}) instead of a fresh, unrelated instance. A fresh runtime over another form's
 * handle works by accident — vanilla's tracking is global to the module — and stops working with no
 * error the moment the handle belongs elsewhere: nothing re-renders, and nothing says so.
 */
export function createFieldStore(
  handle: MdyFieldHandle<unknown>,
): MdyStore & { destroy(): void } {
  const store = createStore(
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

  // The form's teardown reaches this one. A component's cleanup and the form's destroy race on
  // unmount, and the consumer does not get to order them: a store still notifying after the form
  // ended re-renders a component against a form that is gone. Tearing down twice is harmless — the
  // second call finds the effect already destroyed — and `destroy()` stops answering to the form so
  // a store the consumer ended is not held by it.
  // `handleFormOf` is deliberately loose about what a form is — the registry predates any one
  // form type and a hand-built handle answers nothing — so the affordance is asked for rather than
  // assumed: a form from a version without it simply does not reach this store.
  const form = handleFormOf(handle) as { onDestroy?: (teardown: () => void) => () => void } | undefined;
  const release = form?.onDestroy?.(() => store.destroy());
  if (!release) return store;
  return {
    ...store,
    destroy: () => {
      release();
      store.destroy();
    },
  };
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
  /**
   * The errors this field **shows**, which is not always the errors it holds.
   *
   * A field the form is not asking about — disabled by a binding, or inside a section a condition
   * has closed — is not validated by the form, so painting it as failing shows a verdict its own
   * form does not hold. `heldErrors` is what it still carries, for a debugging view: the model, as
   * against what the person is being asked.
   */
  readonly errors: ReadonlyArray<{ readonly kind: string; readonly message: string }>;
  readonly heldErrors: ReadonlyArray<{ readonly kind: string; readonly message: string }>;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly valid: boolean;
  /** Whether the field paints as failing: it is failing **and** the form is asking about it. */
  readonly showsAsInvalid: boolean;
  /** Whether the error text belongs on screen: failing, in play, and the person has had a turn. */
  readonly errorsVisible: boolean;
  readonly pending: boolean;
  readonly disabled: boolean;
  /** Whether a rule marks this field required — for `aria-required` on your own control. */
  readonly required: boolean;
  /**
   * What the field's rules state that an input can carry: `min`, `max`, `step`, lengths, `pattern`
   * and the keyboard hint. You are writing the control here, so this is where a constraint declared
   * once reaches it — see the typed-forms guide.
   */
  readonly constraints: MdyFieldConstraints;
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
  const flags = { disabled: handle.disabled(), touched: handle.touched(), valid: handle.valid() };
  const held = handle.errors();
  return {
    value: handle.value(),
    errors: shownErrors(flags, held),
    heldErrors: held,
    touched: handle.touched(),
    dirty: handle.dirty(),
    valid: handle.valid(),
    showsAsInvalid: showsAsInvalid(flags),
    errorsVisible: errorsVisible(flags, held),
    pending: handle.pending(),
    disabled: handle.disabled(),
    required: handle.required(),
    constraints: handle.constraints(),
    set: handle.set,
    markAsTouched: handle.markAsTouched,
  };
}

export * from "@modyra/core";
export * from "./widgets/index.js";
