/**
 * @modyra/preact — Preact binding for the Modyra form engine.
 *
 * This host has no fine-grained signal of its own, so the engine runs on the core's
 * `vanillaReactivity()` and components subscribe through `useSyncExternalStore` — which arrives
 * here via `preact/compat` rather than natively in `preact/hooks`.
 */
import {
  createForm,
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
import { createFieldSignalStore, createSignalStore, errorsVisible, shownErrors, showsAsInvalid } from "@modyra/widgets";
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
 * them from an unrelated instance is the cross-runtime observation bug.
 * Defaults to a fresh
 * `vanillaReactivity()` only for direct callers that don't have a handle to
 * resolve an owner from (matches this function's pre-M5 behavior).
 *
 * Subscription lifetime, resumption and `destroy()` follow {@link createSignalStore}.
 */
export function createStore(
  signals: ReadonlyArray<MdySignal<unknown>>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyStore & { destroy(): void } {
  return createSignalStore(signals, reactivity);
}

/**
 * Store over everything a field row usually renders; see {@link createFieldSignalStore}.
 */
export function createFieldStore(
  handle: MdyFieldHandle<unknown>,
): MdyStore & { destroy(): void } {
  return createFieldSignalStore(handle);
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
 * Construction stays pure (`autoActivate: false`): no
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
  // No cleanup of its own: the store tracks while it has a subscriber and stops when the last one
  // leaves, so unmounting ends the tracking and a remount resumes it.
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
