import { Signal, WritableSignal } from "@angular/core";
import type {
  MdyControlOption,
  MdyFieldError,
  MdyFormError,
  MdyFormSubmitEvent,
  MdySelectOption,
  ValidatorFn
} from "@modyra/core";

export type {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyControlOption,
  MdyDateRange,
  MdyFieldError,
  MdyFormError,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySelectOption,
  MdySubmitMode,
  ValidatorFn
} from "@modyra/core";

// ─── Validators (framework-agnostic, re-exported from @modyra/core) ─────────

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

// ─── Errors / Submit / Options (framework-agnostic, from @modyra/core) ─────

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

// ─── Date range (framework-agnostic, from @modyra/core) ─────────────────────

// ─── Control State (internal signal state per field) ─────────────────────────
