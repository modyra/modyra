import {
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
  Signal,
} from "@angular/core";
import {
  array as coreArray,
  record as coreRecord,
  field as coreField,
  group as coreGroup,
  MdyTypedFormBase,
  type MdyTypedFormBaseOptions,
  type MdySubmittedValue,
  type MdyFieldHandle as CoreFieldHandle,
  type MdyRecordDescriptor,
} from "@modyra/core";
import {
  MdyDeclarativeAdapter,
  MdyDeclarativeRegistry,
} from "./declarative-form-adapter";
import {
  type AsAngularSignals,
  MdyFieldError,
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdySubmitMode,
  ValidatorFn,
} from "./types";

// Re-export core descriptor/model types through local aliases so the Angular
// package surface stays self-contained and stable.
import type {
  MdyAnyArrayDescriptor as CoreAnyArrayDescriptor,
  MdyAnyFieldDescriptor as CoreAnyFieldDescriptor,
  MdyAnyGroupDescriptor as CoreAnyGroupDescriptor,
  MdyArrayDescriptor as CoreArrayDescriptor,
  MdyArrayItemValue as CoreArrayItemValue,
  MdyFieldDescriptor as CoreFieldDescriptor,
  MdyFieldOptions as CoreFieldOptions,
  MdyFormPatch as CoreFormPatch,
  MdyFormSchema as CoreFormSchema,
  MdyFormValue as CoreFormValue,
  MdyGroupDescriptor as CoreGroupDescriptor,
  MdyWiden as CoreWiden,
} from "@modyra/core";

export type MdyAnyArrayDescriptor = CoreAnyArrayDescriptor;
export type MdyAnyFieldDescriptor = CoreAnyFieldDescriptor;
export type MdyAnyGroupDescriptor = CoreAnyGroupDescriptor;
export type MdyArrayDescriptor<TItem> = CoreArrayDescriptor<TItem>;
export type MdyArrayItemValue<I> = CoreArrayItemValue<I>;
export type MdyFieldDescriptor<TValue> = CoreFieldDescriptor<TValue>;
export type MdyFieldOptions<TValue> = CoreFieldOptions<TValue>;
export type MdyFormPatch<S extends CoreFormSchema> = CoreFormPatch<S>;
export type MdyFormSchema = CoreFormSchema;
export type MdyFormValue<S extends CoreFormSchema> = CoreFormValue<S>;
export type MdyGroupDescriptor<TChildren extends CoreFormSchema> =
  CoreGroupDescriptor<TChildren>;
export type MdyWiden<T> = CoreWiden<T>;

// ─── Field handles ────────────────────────────────────────────────────────────

/**
 * Typed handle for a single field, exposed on `form.f`.
 * Bind it to a renderer with `[field]="form.f.email"` — a typo on the
 * handle path is a compile error, unlike the stringly `name` attribute.
 */
/**
 * Typed handle for a single field, with Angular-branded signals.
 *
 * Derived from the engine's handle rather than restated. Written out member by member it drifted the
 * moment the engine gained one: `interactivity` and `readonly` arrived in the contract and not in
 * the copy, so a handle built here satisfied this file's idea of the type, compiled, and threw
 * `handle.readonly is not a function` the first time a widget controller asked.
 */
export type MdyFieldHandle<TValue> =
  // The signal members re-branded, the commands passed through. `markAsTouched(): void` is
  // structurally a zero-argument accessor, so a blanket mapping would rewrite it as `Signal<void>`.
  AsAngularSignals<Omit<CoreFieldHandle<TValue>, MdyFieldHandleCommands>>
  & Pick<CoreFieldHandle<TValue>, MdyFieldHandleCommands>;

/** The handle's imperative half: what a renderer calls, as against what it reads. */
type MdyFieldHandleCommands = "set" | "markAsTouched" | "markAsDirty";

/** Typed handle for a repeatable array item, exposed on `form.f` (`form.f.items`). */
export interface MdyArrayHandle<TItemHandle, TItemValue> {
  readonly path: string;
  readonly length: Signal<number>;
  readonly rows: Signal<ReadonlyArray<TItemHandle>>;
  readonly errors: Signal<ReadonlyArray<MdyFieldError>>;
  readonly valid: Signal<boolean>;
  push(value: TItemValue): void;
  insert(index: number, value: TItemValue): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  setAll(values: ReadonlyArray<TItemValue>): void;
  at(index: number): TItemHandle | null;
}

/**
 * Typed handle for a collection keyed by data, exposed on `form.f` (`form.f.rows`).
 *
 * The core's shape with this framework's signal type — the members are the core's, and their meaning
 * is documented there.
 */
export interface MdyRecordHandle<TItemHandle, TItemValue> {
  readonly path: string;
  readonly keys: Signal<ReadonlyArray<string>>;
  readonly value: Signal<Readonly<Record<string, TItemValue>>>;
  readonly errors: Signal<ReadonlyArray<MdyFieldError>>;
  readonly valid: Signal<boolean>;
  has(key: string): boolean;
  row(key: string): TItemHandle;
  cell<TCell = unknown>(key: string, path?: string): MdyFieldHandle<TCell>;
  upsert(key: string, value?: TItemValue): void;
  remove(key: string): void;
  setAll(values: Readonly<Record<string, TItemValue>>): void;
  patch(values: Readonly<Record<string, unknown>>): void;
  rename(from: string, to: string): void;
  validOf(key: string): boolean;
}

/** The handle tree for a single array item — a field handle or nested group tree. */
export type MdyItemHandleTree<I> = I extends MdyGroupDescriptor<infer C>
  ? MdyFieldHandleTree<C>
  : I extends MdyFieldDescriptor<infer V>
  ? MdyFieldHandle<V>
  : never;

/** The typed handle tree mirroring the schema shape (`form.f.address.city`). */
export type MdyFieldHandleTree<S extends MdyFormSchema> = {
  readonly [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? MdyFieldHandle<V>
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFieldHandleTree<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? MdyArrayHandle<MdyItemHandleTree<I>, MdyArrayItemValue<I>>
  : S[K] extends MdyRecordDescriptor<infer I>
  ? MdyRecordHandle<MdyItemHandleTree<I>, MdyArrayItemValue<I>>
  : never;
};

// ─── Factories ────────────────────────────────────────────────────────────────

/** Declares a typed leaf field of a {@link mdyForm} schema. */
export function field<TValue>(
  initial: MdyWiden<TValue>,
  validators: ReadonlyArray<ValidatorFn<MdyWiden<TValue>>> = [],
  options?: MdyFieldOptions<MdyWiden<TValue>>,
): MdyFieldDescriptor<MdyWiden<TValue>> {
  return coreField(initial, validators, options);
}

/** Declares a nested group of fields (`address.city` paths on the adapter). */
export function group<TChildren extends MdyFormSchema>(
  children: TChildren,
): MdyGroupDescriptor<TChildren> {
  return coreGroup(children);
}

/** Declares a repeatable array of fields or groups (`items.0.name` paths on the adapter). */
export function array<TItem extends MdyAnyGroupDescriptor | MdyAnyFieldDescriptor>(
  item: TItem,
  options?: {
    readonly initial?: ReadonlyArray<unknown>;
    readonly validators?: ReadonlyArray<ValidatorFn<readonly unknown[]>>;
  },
): MdyArrayDescriptor<TItem> {
  return coreArray(item, options);
}

/** Declares a collection keyed by data (`rows.a3f9.name` paths on the adapter). */
export function record<TItem extends MdyAnyGroupDescriptor | MdyAnyFieldDescriptor>(
  item: TItem,
  options?: {
    readonly initial?: Readonly<Record<string, unknown>>;
    readonly validators?: ReadonlyArray<ValidatorFn<Readonly<Record<string, unknown>>>>;
  },
): MdyRecordDescriptor<TItem> {
  return coreRecord(item, options);
}

export interface MdyFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> extends MdyTypedFormBaseOptions<TValue> {
  readonly submitMode?: MdySubmitMode;
  /**
   * Needed only for async validators when `mdyForm()` is called outside an
   * injection context; inside a field initializer it is resolved automatically.
   */
  readonly injector?: Injector;
}

/**
 * Structural supertype of every `MdyTypedForm<S>` — what `<mdy-form [form]>`
 * accepts without caring about the concrete schema type. Mirrors
 * `MdyFormAdapter` with schema-agnostic value types.
 */
export interface MdyTypedFormLike extends MdyDeclarativeRegistry {
  readonly state: MdyFormState;
  readonly value: Signal<Record<string, unknown>>;
  getValue(): Record<string, unknown>;
  /** Every field except the disabled ones — what a submit actually sends. */
  submitValue(): Partial<Record<string, unknown>>;
  getField(name: string): MdyFieldRef<unknown> | null;
  errorsFor(path: string): Signal<ReadonlyArray<MdyFormError>>;
  submit(
    action: (
      value: Partial<Record<string, unknown>>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void>;
  markAllTouched(): void;
  buildSubmitEvent(
    value: never,
  ): MdyFormSubmitEvent<Record<string, unknown>, Partial<Record<string, unknown>>>;
  patchValue(partial: never): void;
  setValue(value: never): void;
  reset(): void;
}

/**
 * Creates a typed, signal-based form model from a schema.
 *
 * ```ts
 * const form = mdyForm({
 *   email: field("", [required(), email()]),
 *   age: field<number | null>(null, [min(18)]),
 *   address: group({ city: field(""), zip: field("") }),
 * });
 *
 * form.f.email.value();        // Signal<string>
 * form.f.address.city.set("Rome");
 * form.getValue().age;         // number | null — typos do not compile
 * ```
 * ```html
 * <mdy-form [form]="form" (submitted)="onSubmit($event)">
 *   <mdy-control-text [field]="form.f.email" label="Email" />
 * </mdy-form>
 * ```
 */
export function mdyForm<S extends MdyFormSchema>(
  schema: S,
  options?: MdyFormOptions<MdyFormValue<S>>,
): MdyTypedForm<S> {
  let injector = options?.injector;
  if (!injector) {
    try {
      injector = inject(Injector);
    } catch {
      injector = undefined; // outside injection context: sync validation only
    }
  }
  const form = new MdyTypedForm(schema, {
    ...(options?.submitMode !== undefined && { submitMode: options.submitMode }),
    ...(options?.validators !== undefined && { validators: options.validators }),
    ...(options?.history !== undefined && { history: options.history }),
    ...(options?.draft !== undefined && { draft: options.draft }),
    ...(options?.security !== undefined && { security: options.security }),
    ...(injector !== undefined && { injector }),
  });
  // Tie the form's resources (async runners, draft/history timers) to the
  // owning scope so a destroyed component cannot leak them.
  injector?.get(DestroyRef).onDestroy(() => form.destroy());
  return form;
}

// ─── Typed form ───────────────────────────────────────────────────────────────

/**
 * Typed form model over the flat {@link MdyDeclarativeAdapter}.
 *
 * Inherits all framework-agnostic behavior from {@link MdyTypedFormBase} in
 * `@modyra/core`; this class only adds Angular signal narrowing and the
 * injector-aware constructor.
 */
export class MdyTypedForm<S extends MdyFormSchema>
  extends MdyTypedFormBase<S, MdyFieldHandle<unknown>, Signal<boolean>>
  implements MdyFormAdapter<MdyFormValue<S>, MdySubmittedValue<S>>, MdyDeclarativeRegistry {
  declare protected readonly _adapter: MdyDeclarativeAdapter;

  override readonly state: MdyFormState;
  override readonly f: MdyFieldHandleTree<S>;
  override readonly value: Signal<MdyFormValue<S>>;

  constructor(schema: S, options?: MdyFormOptions<MdyFormValue<S>>) {
    const adapter = new MdyDeclarativeAdapter(
      signal(undefined),
      signal(options?.submitMode ?? "valid-only"),
      options?.injector,
      options?.security,
    );
    super(schema, adapter, options);
    this.state = adapter.state;
    this.value = computed(
      () => this._flatToValue(this._adapter.value()),
    ) as Signal<MdyFormValue<S>>;
    this.f = this._buildHandleTree(schema, "") as MdyFieldHandleTree<S>;
  }

  // ── Angular-branded signal narrowing ────────────────────────────────────────

  override getField<K extends keyof MdyFormValue<S>>(
    name: K,
  ): MdyFieldRef<MdyFormValue<S>[K]> | null;
  override getField(name: string): MdyFieldRef<unknown> | null;
  override getField(name: string): MdyFieldRef<unknown> | null {
    return this._adapter.getField(name);
  }

  override errorsFor(
    path: keyof MdyFormValue<S> | string,
  ): Signal<ReadonlyArray<MdyFormError>> {
    return this._adapter.errorsFor(String(path)) as Signal<
      ReadonlyArray<MdyFormError>
    >;
  }

  override get canUndo(): Signal<boolean> {
    return this._adapter.canUndo as Signal<boolean>;
  }

  override get canRedo(): Signal<boolean> {
    return this._adapter.canRedo as Signal<boolean>;
  }

  override get hasDraft(): Signal<boolean> {
    return this._adapter.hasDraft as Signal<boolean>;
  }

  override get fieldNames(): Signal<readonly string[]> {
    return this._adapter.fieldNames as Signal<readonly string[]>;
  }

  protected _buildHandle(path: string): MdyFieldHandle<unknown> {
    const ref = this._adapter.getField(path);
    if (!ref) {
      throw new Error(`[modyra] Field "${path}" was not registered`);
    }
    const state = ref();
    return {
      path,
      value: state.value,
      errors: state.errors,
      touched: state.touched,
      dirty: state.dirty,
      valid: state.valid,
      pending: state.pending,
      required: state.required,
      bounds: state.bounds,
      // What the user may do, and its two derived halves. These were missing: the handle satisfied
      // this file's own copy of the type, and threw the moment a widget controller read them.
      interactivity: state.interactivity,
      disabled: state.disabled,
      readonly: state.readonly,
      set: (v: unknown): void => state.value.set(v),
      markAsTouched: (): void => state.touched.set(true),
      markAsDirty: (): void => state.dirty.set(true),
    };
  }
}
