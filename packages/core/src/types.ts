import { MdySignal, MdyWritableSignal } from "./reactivity.js";

// ─── Validators ───────────────────────────────────────────────────────────────

/** Pure validator: current value → error messages (empty = valid). */
export type ValidatorFn<TValue = unknown> = (
  value: TValue,
) => readonly string[];

/**
 * Context passed as the second argument to an async validator: cancellation
 * signal, the field's own path, and read-only access to the owning form.
 */
export interface MdyAsyncValidationContext {
  /** Aborted when the run is superseded (last-wins), re-debounced, or the form is destroyed. */
  readonly signal: AbortSignal;
  /** Dotted path of the field under validation. */
  readonly path: string;
  /** Read-only live view of the owning form. */
  readonly form: {
    /** Whole flat form value (dotted keys). */
    value(): Record<string, unknown>;
    /** Current value of any field by dotted path; undefined if the field doesn't exist yet. */
    fieldValue(path: string): unknown;
  };
}

/**
 * Async validator: current value → promise of error messages. While it runs,
 * the field's `pending` signal is true; results follow last-wins semantics.
 * The second `ctx` argument is optional to keep single-argument validators
 * assignable to this type.
 */
export type MdyAsyncValidatorFn<TValue = unknown> = (
  value: TValue,
  ctx: MdyAsyncValidationContext,
) => Promise<readonly string[]>;

export interface MdyAsyncValidatorOptions {
  /**
   * Milliseconds to wait after the last value change before running the
   * async validators. The field is `pending` for the whole debounce+run
   * window, so `canSubmit` stays false while a check is outstanding.
   */
  readonly debounceMs?: number;
  /** Dotted paths whose changes re-run the async validators (cross-field server checks). */
  readonly dependsOn?: ReadonlyArray<string>;
  /** After N ms the run fails with kind "async-timeout" and pending settles. */
  readonly timeoutMs?: number;
  /** Precondition evaluated before pending turns on; false → skip the server call. */
  readonly when?: (value: unknown, formValue: Record<string, unknown>) => boolean;
}

/**
 * Form-level validator: whole form value → errors attributed to fields via
 * `path` (dotted for nested groups) or to the whole form (`path: null`).
 */
export type MdyFormValidatorFn<TValue = Record<string, unknown>> = (
  value: TValue,
) => ReadonlyArray<MdyFormError>;

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface MdyFieldError {
  readonly kind: string;
  readonly message: string;
  readonly payload?: unknown;
}

export interface MdyFormError {
  /** Field path (e.g. 'email') — null means global form error. */
  readonly path: string | null;
  readonly kind: string;
  readonly message: string;
  readonly payload?: unknown;
}

// ─── Field state ─────────────────────────────────────────────────────────────

/**
 * How much a user may do to a field. One value, not two booleans.
 *
 * `disabled` and `readonly` used to be independent flags, which made `disabled && readonly`
 * representable and meaningless and left every call site to invent its own combination of them —
 * fourteen did, and they did not agree. The states are ordered by how much they permit, and they
 * are mutually exclusive by construction:
 *
 * - `"enabled"` — the user may focus it and change it.
 * - `"readonly"` — the user may focus it, select its text and copy it, but not change it. It is
 *   **submitted and validated**, because it holds a real answer the form is asserting.
 * - `"disabled"` — the user may do neither. It is **not submitted and not validated**, because the
 *   form is not asking the question at all. This is what HTML means by the word.
 *
 * Ask {@link MdyInteractivity} what it permits through the predicates in `@modyra/widgets` rather
 * than comparing strings at a call site; that is how the fourteen disagreed.
 */
export type MdyInteractivity = "enabled" | "readonly" | "disabled";

export interface MdyFieldState<TValue> {
  readonly value: MdyWritableSignal<TValue>;
  readonly valid: MdySignal<boolean>;
  readonly touched: MdyWritableSignal<boolean>;
  readonly dirty: MdyWritableSignal<boolean>;
  /**
   * The single source of truth for what the user may do. {@link MdyFieldState.disabled} and
   * {@link MdyFieldState.readonly} are derived from it and cannot disagree with it or each other.
   */
  readonly interactivity: MdySignal<MdyInteractivity>;
  /** Derived from {@link MdyFieldState.interactivity}. Kept so existing renderers keep working. */
  readonly disabled: MdySignal<boolean>;
  /** Derived from {@link MdyFieldState.interactivity}. Kept so existing renderers keep working. */
  readonly readonly: MdySignal<boolean>;
  readonly pending: MdySignal<boolean>;
  readonly required: MdySignal<boolean>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
}

/** Callable returning the state of a field. */
export type MdyFieldRef<TValue> = () => MdyFieldState<TValue>;

// ─── Submit ───────────────────────────────────────────────────────────────────

export type MdySubmitMode = "valid-only" | "always" | "manual";

export interface MdyFormSubmitEvent<T extends object, TSubmit = Partial<T>> {
  /**
   * What was submitted. Not `T`: a disabled field is not sent, and any field may be disabled at
   * runtime. `TSubmit` carries the schema's exact submitted shape where one is known; the default
   * is the widest honest statement for an adapter that does not know its schema.
   */
  readonly value: TSubmit;
  readonly valid: boolean;
  readonly errors: ReadonlyArray<MdyFormError>;
}

// ─── Form state & adapter contract ───────────────────────────────────────────

export interface MdyFormState {
  readonly valid: MdySignal<boolean>;
  readonly pending: MdySignal<boolean>;
  readonly submitting: MdySignal<boolean>;
  readonly submitCount: MdySignal<number>;
  readonly canSubmit: MdySignal<boolean>;
  readonly lastSubmitErrors: MdySignal<ReadonlyArray<MdyFormError>>;
}

/**
 * `TSubmit` is the shape a submit actually produces, kept as its own parameter so a typed form can
 * supply its exact schema-derived type instead of having it flattened to `Partial<T>`. The default
 * is what an adapter can honestly say when it does not know its schema: any field may be missing.
 */
export interface MdyFormAdapter<T extends object, TSubmit = Partial<T>> {
  readonly state: MdyFormState;
  readonly value: MdySignal<T>;
  /** The live editing model: every field, including the disabled ones. */
  getValue(): T;
  /**
   * What a submit would send: every field except the disabled ones.
   *
   * Weaker than {@link MdyFormAdapter.getValue} on purpose — a disabled field is not submitted, and
   * any field may be disabled at runtime.
   */
  submitValue(): TSubmit;
  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null;
  errorsFor(path: keyof T | string): MdySignal<ReadonlyArray<MdyFormError>>;
  /**
   * The action receives {@link MdyFormAdapter.submitValue}, so its parameter is `Partial<T>`: a
   * disabled field is not sent, and any field may be disabled at runtime.
   */
  submit(
    action: (
      value: TSubmit,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void>;
  markAllTouched(): void;
  buildSubmitEvent(value: TSubmit): MdyFormSubmitEvent<T, TSubmit>;
  patchValue(partial: Partial<T>): void;
  setValue(value: T): void;
  reset(): void;
}

// ─── Options (select-like controls and dynamic configs) ─────────────────────

export interface MdyControlOption<TValue = string> {
  readonly value: TValue;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Alias for MdyControlOption — used by select/multiselect surfaces. */
export type MdySelectOption<TValue = string> = MdyControlOption<TValue>;

// ─── Date range ───────────────────────────────────────────────────────────────

/**
 * A date range as two ISO `yyyy-MM-dd` strings; either side may be `null`
 * while the user is mid-selection.
 */
export interface MdyDateRange {
  readonly start: string | null;
  readonly end: string | null;
}
