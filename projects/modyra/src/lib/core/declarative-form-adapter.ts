import { Injector, Signal, signal } from "@angular/core";
import { MdyFormEngine } from "@modyra/core";
import { angularReactivity } from "./reactivity-angular";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdySubmitMode,
  ValidatorFn,
} from "./types";

declare const ngDevMode: boolean | undefined;

// The draft persistence contract lives in the framework-agnostic engine —
// re-exported here so existing import sites keep working.
export type { MdyDraftOptions, MdyDraftStorage } from "@modyra/core";

// ─── Registry interface ───────────────────────────────────────────────────────

/**
 * The flat path protocol controls and validator directives speak — the
 * Angular-typed view of the engine's registry.
 */
export interface MdyDeclarativeRegistry {
  /**
   * Registers type-specific validators for a named field.
   * Validators added through this method cannot be updated or removed later;
   * directives should prefer {@link upsertValidators} with a stable key.
   */
  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired?: boolean,
  ): void;
  /**
   * Registers (or replaces) the validators owned by `key` for a named field.
   * Re-invoking with the same key swaps the previous set, so directives can
   * react to input changes. `marksRequired` flags the field as required for
   * as long as the key is registered with it set.
   */
  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired?: boolean,
  ): void;
  /** Removes the sync and async validators owned by `key` from a named field. */
  removeValidators(name: string, key: string): void;
  /**
   * Registers (or replaces) async validators owned by `key`.
   * While they run, the field's `pending` signal is true; results follow
   * last-wins semantics (stale runs are discarded).
   */
  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: MdyAsyncValidatorOptions,
  ): void;
  setInitialValue(name: string, value: unknown): void;
  setDisabled(name: string, disabled: Signal<boolean>): void;
  setReadonly(name: string, readonly: Signal<boolean>): void;
  /**
   * Declares that a control instance owns the named field.
   * Claims are reference-counted: the field state is dropped only when the
   * last claiming control calls {@link removeField}. A second claim on the
   * same name logs a dev-mode warning (two controls sharing state is almost
   * always an authoring mistake).
   */
  claimField(name: string): void;
  removeField(name: string): void;
}

// ─── Declarative Adapter ──────────────────────────────────────────────────────

/**
 * Adapter used when `<mdy-form>` runs without an explicit [adapter] input,
 * and the engine underneath `mdyForm()`.
 *
 * Since the domain-model extraction this class is a thin Angular binding of
 * the framework-agnostic {@link MdyFormEngine} from `@modyra/core`: it feeds
 * the engine Angular's native signal primitives (via `angularReactivity`),
 * so every piece of form state is a real Angular signal that participates
 * in change detection — zoneless included. All semantics (lazy fields,
 * keyed validators, async last-wins, drafts, history, server-error
 * snapshots) live in the engine.
 */
export class MdyDeclarativeAdapter
  extends MdyFormEngine
  implements MdyFormAdapter<Record<string, unknown>>, MdyDeclarativeRegistry
{
  constructor(
    formValue: Signal<Record<string, unknown> | undefined>,
    submitMode: Signal<MdySubmitMode> = signal("valid-only"),
    /** Needed to run async validators, drafts and history. */
    injector?: Injector,
  ) {
    super(angularReactivity(injector), formValue, submitMode, {
      devWarnings: typeof ngDevMode !== "undefined" && !!ngDevMode,
    });
  }

  // The engine's members are created through `angularReactivity`, so at
  // runtime they ARE Angular signals — these declarations (and the two
  // overrides below) just narrow the abstract reactive types back to the
  // Angular-branded ones the rest of the library is typed against.
  declare readonly state: MdyFormState;
  declare readonly value: Signal<Record<string, unknown>>;
  declare readonly fieldNames: Signal<readonly string[]>;
  declare readonly hasDraft: Signal<boolean>;
  declare readonly canUndo: Signal<boolean>;
  declare readonly canRedo: Signal<boolean>;

  override getField(name: string): MdyFieldRef<unknown> | null {
    return super.getField(name) as unknown as MdyFieldRef<unknown> | null;
  }

  override errorsFor(path: string): Signal<ReadonlyArray<MdyFormError>> {
    return super.errorsFor(path) as unknown as Signal<
      ReadonlyArray<MdyFormError>
    >;
  }
}
