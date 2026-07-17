import {
  MdyDraftOptions,
  MdyFormEngine,
  MdyFormRegistry,
} from "./form-engine.js";
import { MdyReactivity, MdySignal, vanillaReactivity } from "./reactivity.js";
import {
  collectSchemaPaths,
  flattenPatch,
  hasRequiredMarker,
  isFieldHandleTree,
  isSchemaPatch,
  isSchemaValue,
  pathGet,
  unflatten,
  walkSchema,
} from "./schema-utils.js";
import {
  MdyAsyncValidatorFn,
  MdyFieldError,
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySubmitMode,
  ValidatorFn,
} from "./types.js";

// ─── Schema descriptors ───────────────────────────────────────────────────────

/** Leaf descriptor produced by {@link field}. */
export interface MdyFieldDescriptor<TValue> {
  readonly kind: "field";
  readonly initial: TValue;
  readonly validators: ReadonlyArray<ValidatorFn<TValue>>;
  readonly asyncValidators: ReadonlyArray<MdyAsyncValidatorFn<TValue>>;
  readonly asyncDebounceMs: number;
}

/** Group descriptor produced by {@link group}. */
export interface MdyGroupDescriptor<TChildren extends MdyFormSchema> {
  readonly kind: "group";
  readonly children: TChildren;
}

/**
 * Widest field shape, used as the schema constraint. Validators are typed
 * contravariantly (`never`) so any `MdyFieldDescriptor<T>` is assignable.
 */
export interface MdyAnyFieldDescriptor {
  readonly kind: "field";
  readonly initial: unknown;
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly asyncValidators: ReadonlyArray<MdyAsyncValidatorFn<never>>;
  readonly asyncDebounceMs: number;
}

export interface MdyAnyGroupDescriptor {
  readonly kind: "group";
  readonly children: MdyFormSchema;
}

/** A form schema: field descriptors and (arbitrarily nested) groups. */
export interface MdyFormSchema {
  readonly [key: string]: MdyAnyFieldDescriptor | MdyAnyGroupDescriptor;
}

// ─── Inferred model types ─────────────────────────────────────────────────────

/** The value type a schema produces — `form.getValue()` returns this. */
export type MdyFormValue<S extends MdyFormSchema> = {
  [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormValue<C>
  : never;
};

/** Deep partial of the schema value — accepted by `patch`. */
export type MdyFormPatch<S extends MdyFormSchema> = {
  readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormPatch<C>
  : never;
};

// ─── Field handles ────────────────────────────────────────────────────────────

/**
 * Typed handle for a single field, exposed on `form.f` — a typo on the
 * handle path is a compile error, unlike a stringly name.
 */
export interface MdyFieldHandle<TValue> {
  /** Flat engine path of the field (dot-separated for nested groups). */
  readonly path: string;
  readonly value: MdySignal<TValue>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
  readonly touched: MdySignal<boolean>;
  readonly dirty: MdySignal<boolean>;
  readonly valid: MdySignal<boolean>;
  readonly pending: MdySignal<boolean>;
  readonly required: MdySignal<boolean>;
  readonly disabled: MdySignal<boolean>;
  set(value: TValue): void;
  markAsTouched(): void;
  markAsDirty(): void;
}

/** The typed handle tree mirroring the schema shape (`form.f.address.city`). */
export type MdyFieldHandleTree<S extends MdyFormSchema> = {
  readonly [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? MdyFieldHandle<V>
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFieldHandleTree<C>
  : never;
};

// ─── Factories ────────────────────────────────────────────────────────────────

export interface MdyFieldOptions<TValue> {
  readonly asyncValidators?: ReadonlyArray<MdyAsyncValidatorFn<TValue>>;
  /**
   * Milliseconds to wait after the last change before running the async
   * validators (the field stays `pending` for the whole window).
   */
  readonly asyncDebounceMs?: number;
}

/**
 * Widens literal primitives so `field("")` infers `string`, not `""`.
 * Unions distribute (`number | null` stays `number | null`); intentional
 * literal-union fields should annotate the descriptor type explicitly.
 */
export type MdyWiden<T> = T extends string
  ? string
  : T extends number
  ? number
  : T extends boolean
  ? boolean
  : T;

/** Declares a typed leaf field of a {@link createForm} schema. */
export function field<TValue>(
  initial: MdyWiden<TValue>,
  validators: ReadonlyArray<ValidatorFn<MdyWiden<TValue>>> = [],
  options?: MdyFieldOptions<MdyWiden<TValue>>,
): MdyFieldDescriptor<MdyWiden<TValue>> {
  return {
    kind: "field",
    initial,
    validators,
    asyncValidators: options?.asyncValidators ?? [],
    asyncDebounceMs: options?.asyncDebounceMs ?? 0,
  };
}

/** Declares a nested group of fields (`address.city` paths on the engine). */
export function group<TChildren extends MdyFormSchema>(
  children: TChildren,
): MdyGroupDescriptor<TChildren> {
  return { kind: "group", children };
}

export interface MdyCoreFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly submitMode?: MdySubmitMode;
  /**
   * Reactive implementation the form runs on. Defaults to the built-in
   * {@link vanillaReactivity} (Node/CLI/tests); framework adapters pass
   * their own so form state integrates with the host's change detection.
   */
  readonly reactivity?: MdyReactivity;
  /**
   * Form-level (cross-field) validators. Each receives the whole typed value
   * and returns errors attributed to field paths (dotted for nested groups)
   * or to the form itself (`path: null`). Build them with `crossField()`.
   */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
  /**
   * Records value snapshots for `undo()`/`redo()`.
   * Pass `true` or `{ maxEntries, debounceMs }` (defaults: 100 entries,
   * no debounce).
   */
  readonly history?:
  | boolean
  | { readonly maxEntries?: number; readonly debounceMs?: number };
  /**
   * Autosaves the form value under `key` and restores an existing draft on
   * creation. Cleared automatically after an error-free submit. Use
   * `exclude` to keep sensitive fields out of storage, `ttlMs` for expiry
   * and `version` for schema migrations.
   */
  readonly draft?: string | MdyDraftOptions;
}

/**
 * Creates a typed, reactive form model from a schema — the framework-free
 * heart of Modyra. Runs anywhere JavaScript runs:
 *
 * ```ts
 * const form = createForm({
 *   email: field("", [required(), email()]),
 *   address: group({ city: field("Rome") }),
 * });
 *
 * form.f.email.set("foo@bar.com");
 * form.f.email.errors();   // []
 * form.getValue().address.city; // "Rome" — typos do not compile
 * ```
 */
export function createForm<S extends MdyFormSchema>(
  schema: S,
  options?: MdyCoreFormOptions<MdyFormValue<S>>,
): MdyTypedForm<S> {
  return new MdyTypedForm(schema, options);
}

// ─── Typed form ───────────────────────────────────────────────────────────────

/** Owner key for validators registered from the schema. */
const SCHEMA_KEY = "mdy-schema";

/**
 * Options shared by every typed-form specialization (core and adapters).
 * Framework-specific constructors supply their own reactivity / submit-mode
 * handling, then forward the rest to {@link MdyTypedFormBase}.
 */
export interface MdyTypedFormBaseOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
  readonly history?:
  | boolean
  | { readonly maxEntries?: number; readonly debounceMs?: number };
  readonly draft?: string | MdyDraftOptions;
}

/**
 * Framework-agnostic typed form implementation shared by core and Angular.
 *
 * The base owns the schema registration, handle-tree building, nested value
 * mapping and the flat-path delegation surface. Subclasses only provide:
 * - the underlying {@link MdyFormEngine} (or an Angular-branded extension);
 * - a `_buildHandle` factory matching their signal type;
 * - the public `value` / `f` declarations with the correct signal/handle types.
 */
export abstract class MdyTypedFormBase<
  S extends MdyFormSchema,
  THandle,
  TBooleanSignal extends MdySignal<boolean> = MdySignal<boolean>,
> implements MdyFormAdapter<MdyFormValue<S>>, MdyFormRegistry<TBooleanSignal> {
  protected readonly _schema: S;
  protected readonly _adapter: MdyFormEngine;
  /** Leaf paths in schema order. */
  protected readonly _leafPaths: readonly string[];
  /** Group prefixes — used to flatten nested patches. */
  protected readonly _groupPaths: ReadonlySet<string>;

  /**
   * Concrete handle tree type is declared by subclasses (core uses
   * {@link MdyFieldHandleTree}, Angular uses Signal-based handles).
   */
  abstract readonly f: unknown;
  abstract readonly state: MdyFormState;
  abstract readonly value: MdySignal<MdyFormValue<S>>;

  constructor(
    schema: S,
    adapter: MdyFormEngine,
    options?: MdyTypedFormBaseOptions<MdyFormValue<S>>,
  ) {
    this._schema = schema;
    this._adapter = adapter;

    const paths = collectSchemaPaths(schema);
    this._leafPaths = paths.leafPaths;
    this._groupPaths = paths.groupPaths;
    this._registerSchema(schema);

    const history = options?.history;
    if (history === true) {
      this._adapter.enableHistory();
    } else if (history) {
      this._adapter.enableHistory(history);
    }

    const draft = options?.draft;
    if (typeof draft === "string") {
      this._adapter.enableDraft({ key: draft });
    } else if (draft) {
      this._adapter.enableDraft(draft);
    }

    const formValidators = options?.validators ?? [];
    if (formValidators.length > 0) {
      // Cross-field validators see the nested typed value; the errors they
      // return use the same dotted paths the flat adapter stores fields under.
      this._adapter.setFormValidators(
        formValidators.map(
          (fn) => (flat: Record<string, unknown>) =>
            fn(this._flatToValue(flat)),
        ),
      );
    }
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getValue(): MdyFormValue<S> {
    return this._flatToValue(this._adapter.getValue());
  }

  getField<K extends keyof MdyFormValue<S>>(
    name: K,
  ): MdyFieldRef<MdyFormValue<S>[K]> | null;
  getField(name: string): MdyFieldRef<unknown> | null;
  getField(name: string): MdyFieldRef<unknown> | null {
    return this._adapter.getField(name);
  }

  errorsFor(
    path: keyof MdyFormValue<S> | string,
  ): MdySignal<ReadonlyArray<MdyFormError>> {
    return this._adapter.errorsFor(String(path));
  }

  async submit(
    action: (
      value: MdyFormValue<S>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._adapter.submit((flat) =>
      action(this._flatToValue(flat)),
    );
  }

  markAllTouched(): void {
    this._adapter.markAllTouched();
  }

  buildSubmitEvent(value: MdyFormValue<S>): MdyFormSubmitEvent<MdyFormValue<S>> {
    return {
      value,
      valid: this.state.valid(),
      errors: [...this.state.lastSubmitErrors()],
    };
  }

  patchValue(partial: Partial<MdyFormValue<S>>): void {
    this._adapter.patchValue(this._flattenPatch(partial));
  }

  /** Deeply-typed variant of {@link patchValue} for nested groups. */
  patch(partial: MdyFormPatch<S>): void {
    this._adapter.patchValue(this._flattenPatch(partial));
  }

  setValue(value: MdyFormValue<S>): void {
    const flat: Record<string, unknown> = {};
    for (const path of this._leafPaths) {
      flat[path] = this._pathGet(value, path);
    }
    this._adapter.setValue(flat);
  }

  reset(): void {
    this._adapter.reset();
  }

  // ── History and change tracking ─────────────────────────────────────────────

  /** True when {@link undo} has state to restore (requires `history` option). */
  get canUndo(): MdySignal<boolean> {
    return this._adapter.canUndo;
  }

  /** True when {@link redo} has state to restore. */
  get canRedo(): MdySignal<boolean> {
    return this._adapter.canRedo;
  }

  /** Restores the previous recorded form value. */
  undo(): void {
    this._adapter.undo();
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._adapter.redo();
  }

  /**
   * Minimal nested patch: only the fields whose value differs from the
   * schema's initial values — ready for an API PATCH request.
   */
  getChanges(): MdyFormPatch<S> {
    return this._flatToPatch(this._adapter.getChanges());
  }

  /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
  get fieldNames(): MdySignal<readonly string[]> {
    return this._adapter.fieldNames;
  }

  /** The reactive implementation this form runs on (adapters, devtools). */
  get reactivity() {
    return this._adapter.reactivity;
  }

  /** True when a stored draft was restored (requires the `draft` option). */
  get hasDraft(): MdySignal<boolean> {
    return this._adapter.hasDraft;
  }

  /** Removes the stored draft (also happens after an error-free submit). */
  clearDraft(): void {
    this._adapter.clearDraft();
  }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._adapter.destroyed;
  }

  /**
   * Releases every resource the form owns (async runners, draft/history
   * effects, timers, field records). Idempotent — call it when the owning
   * scope goes away (unmount, dispose, disconnect).
   */
  destroy(): void {
    this._adapter.destroy();
  }

  // ── MdyFormRegistry (bindings speaking the flat path protocol) ──────────────

  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired?: boolean,
  ): void {
    this._adapter.addValidators(name, validators, isRequired);
  }

  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired?: boolean,
  ): void {
    this._adapter.upsertValidators(name, key, validators, marksRequired);
  }

  removeValidators(name: string, key: string): void {
    this._adapter.removeValidators(name, key);
  }

  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: { readonly debounceMs?: number },
  ): void {
    this._adapter.upsertAsyncValidators(name, key, validators, options);
  }

  setInitialValue(name: string, value: unknown): void {
    this._adapter.setInitialValue(name, value);
  }

  setDisabled(name: string, disabled: TBooleanSignal): void {
    this._adapter.setDisabled(name, disabled);
  }

  setReadonly(name: string, readonly: TBooleanSignal): void {
    this._adapter.setReadonly(name, readonly);
  }

  claimField(name: string): void {
    this._adapter.claimField(name);
  }

  removeField(name: string): void {
    this._adapter.removeField(name);
  }

  // ── Protected helpers ───────────────────────────────────────────────────────

  protected _registerSchema(nodes: MdyFormSchema): void {
    walkSchema(nodes, "", (path, node) => {
      this._adapter.setInitialValue(path, node.initial);
      this._adapter.getField(path);
      const marksRequired = node.validators.some((fn) => hasRequiredMarker(fn));
      this._adapter.upsertValidators(
        path,
        SCHEMA_KEY,
        node.validators,
        marksRequired,
      );
      if (node.asyncValidators.length > 0) {
        this._adapter.upsertAsyncValidators(
          path,
          SCHEMA_KEY,
          node.asyncValidators,
          { debounceMs: node.asyncDebounceMs },
        );
      }
    });
  }

  protected _buildHandleTree(
    nodes: MdyFormSchema,
    prefix: string,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(nodes)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out[key] =
        node.kind === "field"
          ? this._buildHandle(path)
          : this._buildHandleTree(node.children, path);
    }
    if (isFieldHandleTree(out, nodes)) {
      return out;
    }
    throw new Error("[modyra] Failed to build typed handle tree");
  }

  protected abstract _buildHandle(path: string): THandle;

  /** Rebuilds the nested value shape from the adapter's flat dotted paths. */
  protected _flatToValue(flat: Record<string, unknown>): MdyFormValue<S> {
    return unflatten(flat) as MdyFormValue<S>;
  }

  protected _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    return unflatten(flat) as MdyFormPatch<S>;
  }

  /** Flattens a (possibly nested) patch object into dotted adapter paths. */
  protected _flattenPatch(
    partial: Partial<MdyFormValue<S>> | MdyFormPatch<S>,
  ): Record<string, unknown> {
    return flattenPatch(partial as Record<string, unknown>, this._groupPaths);
  }

  protected _pathGet(value: unknown, path: string): unknown {
    return pathGet(value, path);
  }
}

/**
 * Typed form model over the flat {@link MdyFormEngine}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyFormRegistry`, so bindings that speak the flat path protocol keep
 * working next to the typed handle tree.
 */
export class MdyTypedForm<S extends MdyFormSchema>
  extends MdyTypedFormBase<S, MdyFieldHandle<unknown>>
  implements MdyFormAdapter<MdyFormValue<S>>, MdyFormRegistry {
  readonly state: MdyFormState;
  readonly f: MdyFieldHandleTree<S>;
  readonly value: MdySignal<MdyFormValue<S>>;

  constructor(schema: S, options?: MdyCoreFormOptions<MdyFormValue<S>>) {
    const rx = options?.reactivity ?? vanillaReactivity();
    const engine = new MdyFormEngine(
      rx,
      () => undefined,
      () => options?.submitMode ?? "valid-only",
    );
    super(schema, engine, options);
    this.state = engine.state;
    this.value = rx.computed(
      () => this._flatToValue(this._adapter.getValue()),
    );
    this.f = this._buildHandleTree(schema, "") as MdyFieldHandleTree<S>;
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
      disabled: state.disabled,
      set: (v: unknown): void => state.value.set(v),
      markAsTouched: (): void => state.touched.set(true),
      markAsDirty: (): void => state.dirty.set(true),
    };
  }

  /** Core validates the unflattened value against the schema shape. */
  protected override _flatToValue(flat: Record<string, unknown>): MdyFormValue<S> {
    const nested = unflatten(flat);
    if (isSchemaValue(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat value does not match schema shape");
  }

  /** Core validates the unflattened patch against the schema shape. */
  protected override _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    const nested = unflatten(flat);
    if (isSchemaPatch(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat patch does not match schema shape");
  }
}
