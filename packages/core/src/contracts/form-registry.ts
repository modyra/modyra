/**
 * What a control needs from the form that holds it, and the gate a collection answers through.
 *
 * Lifted out of the engine's own file. It was declared beside its only implementation, which is how
 * an interface comes to be read as a description of that class instead of a contract with it — the
 * two collection managers imported the concrete engine and nothing objected.
 */
import type { MdySignal } from "../reactivity-contract.js";
import type {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  ValidatorFn,
} from "../types.js";
import type { MdySanitizer } from "../security.js";

export interface MdyPathGate {
  isOpen?(path: string): boolean;
  onRefusedWrite?(path: string, value: unknown): void;
  /**
   * A whole-value write landed: these are every path it carried below this prefix.
   *
   * `setValue` means *this is the value now*, so a collection prunes what the write does not
   * mention. Without it a restored draft brings back a row the user deleted before saving it —
   * the deletion is expressible as an absence, and an absence has to be read as one.
   */
  onReplace?(paths: ReadonlySet<string>): void;
}

export interface MdyFormRegistry<
  TBooleanSignal = MdySignal<boolean>,
> {
  /**
   * Registers type-specific validators for a named field.
   * Validators added through this method cannot be updated or removed later;
   * prefer {@link upsertValidators} with a stable key.
   */
  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired?: boolean,
  ): void;
  /**
   * Registers (or replaces) the validators owned by `key` for a named field.
   * Re-invoking with the same key swaps the previous set. `marksRequired`
   * flags the field as required while the key is registered with it set.
   */
  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired?: boolean,
  ): void;
  /** Removes the sync and async validators owned by `key` from a field. */
  removeValidators(name: string, key: string): void;
  /**
   * Registers (or replaces) async validators owned by `key`. While they run
   * the field is `pending`; results follow last-wins semantics. Each run
   * gets an `AbortSignal` (aborted on supersede/re-debounce/destroy),
   * `dependsOn` fields retrigger the run, `timeoutMs` bounds pending, and
   * `when` gates the call before pending turns on.
   */
  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: MdyAsyncValidatorOptions,
  ): void;
  setInitialValue(name: string, value: unknown): void;
  /**
   * Overrides the form-level sanitizer for a single field
   * (`field(initial, validators, { sanitize })`). Resolution happens on
   * every write, so it can be registered before or after the field record
   * is created.
   */
  setSanitizer(name: string, sanitizer: MdySanitizer): void;
  /**
   * Declares that a field holds a secret (`field(initial, validators, { sensitive: true })`).
   *
   * Optional, so a registry written against an earlier version of this contract still satisfies it:
   * a form whose adapter does not implement it keeps the behaviour it had, which is the name
   * heuristic and an explicit `exclude`.
   */
  markSensitive?(name: string): void;
  /** The paths declared through {@link markSensitive}. */
  sensitivePaths?(): readonly string[];
  setDisabled(name: string, disabled: TBooleanSignal): void;
  /** Declares that a field is only in play while the signal says so. */
  setInactive(name: string, inactive: TBooleanSignal): void;
  setReadonly(name: string, readonly: TBooleanSignal): void;
  /**
   * Declares that a control instance owns the named field. Claims are
   * reference-counted: the field state is dropped only when the last
   * claiming control calls {@link removeField}.
   */
  claimField(name: string): void;
  removeField(name: string): void;
}
