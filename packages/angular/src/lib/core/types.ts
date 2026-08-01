import { Signal, WritableSignal } from "@angular/core";
import type {
  MdyControlOption,
  MdyFieldState as CoreFieldState,
  MdyFormAdapter as CoreFormAdapter,
  MdyFormError,
  MdyFormState as CoreFormState,
  MdySelectOption,
  MdySignal,
  MdyWritableSignal,
  ValidatorFn,
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
  MdySanitizer,
  MdySanitizeProfile,
  MdySecurityPolicy,
  MdySecurityViolation,
  MdySecurityViolationKind,
  MdySelectOption,
  MdySubmitMode,
  ValidatorFn
} from "@modyra/core";

// ─── Validators (framework-agnostic, re-exported from @modyra/core) ─────────

// ─── Field State ─────────────────────────────────────────────────────────────

/**
 * Re-brands the engine's structural signals as Angular's own.
 *
 * The engine describes reactivity through a minimal contract whose signal type is a bare `(): T`.
 * At runtime these controls are built on Angular's primitives, so the branded types are accurate —
 * and derived rather than restated, so a member added to the engine's state arrives here with no
 * edit and the two cannot describe different shapes.
 *
 * Only sound for a type whose members are all signals: a zero-argument method is structurally a
 * signal too and would be re-branded into one.
 */
export type AsAngularSignals<T> = {
  readonly [K in keyof T]: T[K] extends MdyWritableSignal<infer V>
  ? WritableSignal<V>
  : T[K] extends MdySignal<infer V>
  ? Signal<V>
  : T[K];
};

/** Reactive state of a single field, with Angular-branded signals. */
export type MdyFieldState<TValue> = AsAngularSignals<CoreFieldState<TValue>>;

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

/** Reactive state of the whole form, with Angular-branded signals. */
export type MdyFormState = AsAngularSignals<CoreFormState>;

/**
 * The engine's adapter contract with Angular-branded reactive members.
 *
 * Extends the engine's rather than repeating it, so every method — and every method the engine
 * gains — is inherited. {@link AsAngularSignals} cannot be applied wholesale here: `getValue(): T`
 * is structurally a signal and would be re-branded into one, so the two genuinely reactive members
 * are overridden by name and nothing else is touched.
 *
 * Reset semantics, which the engine's own documentation does not fix:
 * - Fields with an explicit `[initialValue]` binding reset to that value.
 * - Fields seeded only via `[formValue]` reset to `null`; `[formValue]` is a prefill seed, not a
 *   persistent reset target.
 * - All `touched` and `dirty` states are cleared.
 */
export interface MdyFormAdapter<T extends object, TSubmit = Partial<T>>
  extends Omit<CoreFormAdapter<T, TSubmit>, "state" | "value" | "getField"> {
  readonly state: MdyFormState;
  /** Reactive signal that emits the current form value on every change. */
  readonly value: Signal<T>;
  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null;
  errorsFor(path: keyof T | string): Signal<ReadonlyArray<MdyFormError>>;
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
