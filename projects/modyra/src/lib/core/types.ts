import { Signal, WritableSignal } from "@angular/core";

// ─── Validator ───────────────────────────────────────────────────────────────

/**
 * Pure validator function type.
 * Receives the current field value and returns an array of error strings
 * (empty array = valid).
 */
export type ValidatorFn<TValue = unknown> = (
  value: TValue,
) => readonly string[];

/**
 * Async validator function type.
 * Receives the current field value and resolves to an array of error strings
 * (empty array = valid). While it runs, the field's `pending` signal is true.
 * Results follow last-wins semantics: if the value changes mid-flight, the
 * stale result is discarded.
 */
export type MdyAsyncValidatorFn<TValue = unknown> = (
  value: TValue,
) => Promise<readonly string[]>;

/** Options for a field's async validators. */
export interface MdyAsyncValidatorOptions {
  /**
   * Milliseconds to wait after the last value change before running the
   * async validators. The field is `pending` for the whole debounce+run
   * window, so `canSubmit` stays false while a check is outstanding.
   */
  readonly debounceMs?: number;
}

/**
 * Form-level validator: receives the whole form value and returns errors
 * attributed to fields via `path` (dotted for nested groups) or to the whole
 * form (`path: null`). Used for cross-field rules.
 */
export type MdyFormValidatorFn<TValue = Record<string, unknown>> = (
  value: TValue,
) => ReadonlyArray<MdyFormError>;

// ─── Field State ─────────────────────────────────────────────────────────────

/**
 * Mirrors the FieldState exposed by @angular/forms/signals.
 * Stable public contract — isolated from upstream API changes.
 */
export interface MdyFieldState<TValue> {
  readonly value: WritableSignal<TValue>;
  readonly valid: Signal<boolean>;
  readonly touched: WritableSignal<boolean>;
  readonly dirty: WritableSignal<boolean>;
  readonly disabled: Signal<boolean>;
  readonly readonly: Signal<boolean>;
  readonly pending: Signal<boolean>;
  readonly required: Signal<boolean>;
  readonly errors: Signal<ReadonlyArray<MdyFieldError>>;
}

/** Callable that returns the FieldState for a field. */
export type MdyFieldRef<TValue> = () => MdyFieldState<TValue>;

/**
 * Maps a form model type `T` to a tree of field refs, mirroring the model shape.
 * Each key of `T` becomes an `MdyFieldRef` for its corresponding value type.
 */
export type MdyFieldTree<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: MdyFieldRef<T[K]>;
};

// ─── Errors ───────────────────────────────────────────────────────────────────
export interface MdyFieldError {
  readonly kind: string;
  readonly message: string;
  readonly payload?: unknown;
}

export interface MdyFormError {
  /** Field path (e.g. 'email') — null means global form error */
  readonly path: string | null;
  readonly kind: string;
  readonly message: string;
  readonly payload?: unknown;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
export type MdySubmitMode =
  | "valid-only" // submit blocked if form is invalid
  | "always" // submit fires even if invalid
  | "manual"; // library never auto-submits

export interface MdyFormSubmitEvent<T extends object> {
  readonly value: T;
  readonly valid: boolean;
  readonly errors: ReadonlyArray<MdyFormError>;
}

// ─── Control Options ─────────────────────────────────────────────────────────
export interface MdyControlOption<TValue = string> {
  readonly value: TValue;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Alias for MdyControlOption — used by select/multiselect renderers. */
export type MdySelectOption<TValue = string> = MdyControlOption<TValue>;

/**
 * Interface for components that support options override (e.g. Select, Multiselect).
 * Used by conditional directives to avoid circular dependencies.
 */
export interface MdyOptionsControl<TValue = unknown> {
  readonly overrideOptions: WritableSignal<
    readonly MdySelectOption<TValue>[] | null
  >;
  readonly options: Signal<readonly MdySelectOption<TValue>[]>;
  readonly loading: Signal<boolean>;
  readonly loadingOverride: WritableSignal<boolean | null>;
  /** Current search query typed in the control's search input. */
  readonly searchQuery: Signal<string>;
  resetSelection(): void;
}

// ─── Renderer Config ─────────────────────────────────────────────────────────
export interface MdyControlRendererConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<MdyControlOption<unknown>>;
}

// ─── Form State & Adapter ─────────────────────────────────────────────────────
export interface MdyFormState {
  readonly valid: Signal<boolean>;
  readonly pending: Signal<boolean>;
  readonly submitting: Signal<boolean>;
  readonly submitCount: Signal<number>;
  readonly canSubmit: Signal<boolean>;
  readonly lastSubmitErrors: Signal<ReadonlyArray<MdyFormError>>;
}

export interface MdyFormAdapter<T extends object> {
  readonly state: MdyFormState;
  /** Reactive signal that emits the current form value on every change. */
  readonly value: Signal<T>;
  getValue(): T;
  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null;
  errorsFor(path: keyof T | string): Signal<ReadonlyArray<MdyFormError>>;
  submit(
    action: (
      value: T,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void>;
  markAllTouched(): void;
  buildSubmitEvent(value: T): MdyFormSubmitEvent<T>;
  /** Merge partial values into the form without touching other fields. */
  patchValue(partial: Partial<T>): void;
  /** Replace the entire form value. */
  setValue(value: T): void;
  /**
   * Resets all fields to their declared initial values and clears touched/dirty state.
   *
   * Reset semantics:
   * - Fields with an explicit `[initialValue]` binding reset to that value.
   * - Fields seeded only via `[formValue]` (no `[initialValue]`) reset to `null`.
   *   `[formValue]` is a prefill seed, not a persistent reset target.
   * - All `touched` and `dirty` states are cleared to `false`.
   */
  reset(): void;
}

// ─── Form Context (provided to child controls via DI) ─────────────────────────
export interface MdyFormContext {
  readonly valid: Signal<boolean>;
  readonly submitting: Signal<boolean>;
  readonly submitCount: Signal<number>;
  readonly lastSubmitErrors: Signal<ReadonlyArray<MdyFormError>>;
}

// ─── Field Config ─────────────────────────────────────────────────────────────
export interface MdyFieldConfig<TValue = unknown> {
  readonly name: string;
  readonly validators?: ReadonlyArray<ValidatorFn<TValue>>;
  readonly initialValue?: TValue;
  readonly disabled?: boolean;
}

// ─── Date Range ───────────────────────────────────────────────────────────────

/**
 * Represents a date range as two ISO `YYYY-MM-DD` strings.
 * Both `start` and `end` may be `null` while the user is mid-selection.
 */
export interface MdyDateRange {
  readonly start: string | null;
  readonly end: string | null;
}

// ─── Control State (internal signal state per field) ─────────────────────────
