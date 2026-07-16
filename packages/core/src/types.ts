import { MdySignal, MdyWritableSignal } from "./reactivity.js";

// ─── Validators ───────────────────────────────────────────────────────────────

/** Pure validator: current value → error messages (empty = valid). */
export type ValidatorFn<TValue = unknown> = (
  value: TValue,
) => readonly string[];

/**
 * Async validator: current value → promise of error messages. While it runs,
 * the field's `pending` signal is true; results follow last-wins semantics.
 */
export type MdyAsyncValidatorFn<TValue = unknown> = (
  value: TValue,
) => Promise<readonly string[]>;

export interface MdyAsyncValidatorOptions {
  /**
   * Milliseconds to wait after the last value change before running the
   * async validators. The field is `pending` for the whole debounce+run
   * window, so `canSubmit` stays false while a check is outstanding.
   */
  readonly debounceMs?: number;
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

export interface MdyFieldState<TValue> {
  readonly value: MdyWritableSignal<TValue>;
  readonly valid: MdySignal<boolean>;
  readonly touched: MdyWritableSignal<boolean>;
  readonly dirty: MdyWritableSignal<boolean>;
  readonly disabled: MdySignal<boolean>;
  readonly readonly: MdySignal<boolean>;
  readonly pending: MdySignal<boolean>;
  readonly required: MdySignal<boolean>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
}

/** Callable returning the state of a field. */
export type MdyFieldRef<TValue> = () => MdyFieldState<TValue>;

// ─── Submit ───────────────────────────────────────────────────────────────────

export type MdySubmitMode = "valid-only" | "always" | "manual";

export interface MdyFormSubmitEvent<T extends object> {
  readonly value: T;
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

export interface MdyFormAdapter<T extends object> {
  readonly state: MdyFormState;
  readonly value: MdySignal<T>;
  getValue(): T;
  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null;
  errorsFor(path: keyof T | string): MdySignal<ReadonlyArray<MdyFormError>>;
  submit(
    action: (
      value: T,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void>;
  markAllTouched(): void;
  buildSubmitEvent(value: T): MdyFormSubmitEvent<T>;
  patchValue(partial: Partial<T>): void;
  setValue(value: T): void;
  reset(): void;
}
