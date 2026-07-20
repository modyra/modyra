import {
  MdyDraftOptions,
  MdyFormEngine,
  MdyFormRegistry,
} from "./form-engine.js";
import { MdyReactivity, MdySignal, vanillaReactivity } from "./reactivity.js";
import { MdyArrayManager } from "./array-manager.js";
import {
  collectSchemaPaths,
  flattenPatch,
  hasRequiredMarker,
  isFieldHandleTree,
  isSchemaPatch,
  isSchemaValue,
  numericKeysToArrays,
  pathGet,
  unflatten,
  walkSchema,
} from "./schema-utils.js";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
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
import { MdySanitizer, MdySecurityPolicy } from "./security.js";

// ─── Schema descriptors ───────────────────────────────────────────────────────

/** Leaf descriptor produced by {@link field}. */
export interface MdyFieldDescriptor<TValue> {
  readonly kind: "field";
  readonly initial: TValue;
  readonly validators: ReadonlyArray<ValidatorFn<TValue>>;
  readonly asyncValidators: ReadonlyArray<MdyAsyncValidatorFn<TValue>>;
  readonly asyncDebounceMs: number;
  readonly asyncDependsOn: ReadonlyArray<string>;
  readonly asyncTimeoutMs: number;
  readonly asyncWhen: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  /** Per-field sanitizer override; null → the form-level policy applies. */
  readonly sanitize: MdySanitizer | null;
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
  readonly asyncDependsOn: ReadonlyArray<string>;
  readonly asyncTimeoutMs: number;
  readonly asyncWhen: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  readonly sanitize: MdySanitizer | null;
}

export interface MdyAnyGroupDescriptor {
  readonly kind: "group";
  readonly children: MdyFormSchema;
}

/** Array descriptor produced by {@link array}. Rows follow the value — see array-manager.ts. */
export interface MdyArrayDescriptor<TItem> {
  readonly kind: "array";
  /** Item schema: a group descriptor (rows are objects) or a field descriptor (rows are leaves). */
  readonly item: TItem;
  readonly initial: ReadonlyArray<unknown>;
  readonly validators: ReadonlyArray<ValidatorFn<readonly unknown[]>>;
}

export interface MdyAnyArrayDescriptor {
  readonly kind: "array";
  readonly item: MdyAnyFieldDescriptor | MdyAnyGroupDescriptor;
  readonly initial: ReadonlyArray<unknown>;
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
}

/** A form schema: field descriptors and (arbitrarily nested) groups or arrays. */
export type MdyFormSchema = Readonly<
  Record<
    string,
    MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor
  >
>;

// ─── Inferred model types ─────────────────────────────────────────────────────

/** The value an array item descriptor produces — a row of {@link MdyFormValue} or a leaf. */
export type MdyArrayItemValue<I> = I extends MdyGroupDescriptor<infer C>
  ? MdyFormValue<C>
  : I extends MdyFieldDescriptor<infer V>
  ? V
  : never;

/** The value type a schema produces — `form.getValue()` returns this. */
export type MdyFormValue<S extends MdyFormSchema> = {
  [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormValue<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? MdyArrayItemValue<I>[]
  : never;
};

/** Deep partial of the schema value — accepted by `patch`. */
export type MdyFormPatch<S extends MdyFormSchema> = {
  readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormPatch<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? ReadonlyArray<MdyArrayItemValue<I>>
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

/** Typed handle for a repeatable array item, exposed on `form.f` (`form.f.items`). */
export interface MdyArrayHandle<TItemHandle, TItemValue> {
  readonly path: string;
  readonly length: MdySignal<number>;
  readonly rows: MdySignal<ReadonlyArray<TItemHandle>>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
  readonly valid: MdySignal<boolean>;
  push(value: TItemValue): void;
  insert(index: number, value: TItemValue): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  setAll(values: ReadonlyArray<TItemValue>): void;
  at(index: number): TItemHandle | null;
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
  /** Dotted paths whose changes re-run the async validators (cross-field server checks). */
  readonly asyncDependsOn?: ReadonlyArray<string>;
  /** After N ms the run fails with kind "async-timeout" and pending settles. */
  readonly asyncTimeoutMs?: number;
  /** Precondition evaluated before pending turns on; false → skip the server call. */
  readonly asyncWhen?: (value: TValue, formValue: Record<string, unknown>) => boolean;
  /**
   * Per-field sanitizer override (see `MdySecurityPolicy.sanitize`). Use
   * `"off"` to exempt a field from the form-level policy (e.g. a code
   * editor), or a function for custom allow-listing (e.g. DOMPurify).
   */
  readonly sanitize?: MdySanitizer;
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
    asyncDependsOn: options?.asyncDependsOn ?? [],
    asyncTimeoutMs: options?.asyncTimeoutMs ?? 0,
    asyncWhen: (options?.asyncWhen as MdyFieldDescriptor<MdyWiden<TValue>>["asyncWhen"]) ?? null,
    sanitize: options?.sanitize ?? null,
  };
}

/** Declares a nested group of fields (`address.city` paths on the engine). */
export function group<TChildren extends MdyFormSchema>(
  children: TChildren,
): MdyGroupDescriptor<TChildren> {
  return { kind: "group", children };
}

/**
 * Declares a repeatable array of fields or groups (`items.0.name` paths on
 * the engine). Rows follow the value: structure is rebuilt whenever the
 * array changes shape (`push`/`insert`/`remove`/`move`/`setAll`, or a
 * `patch`/`setValue`/`reset` that touches this path) — touched/dirty/errors
 * of affected rows reset on structural changes (v1 semantics, see docs).
 */
export function array<TItem extends MdyAnyGroupDescriptor | MdyAnyFieldDescriptor>(
  item: TItem,
  options?: {
    readonly initial?: ReadonlyArray<unknown>;
    readonly validators?: ReadonlyArray<ValidatorFn<readonly unknown[]>>;
  },
): MdyArrayDescriptor<TItem> {
  return {
    kind: "array",
    item,
    initial: options?.initial ?? [],
    validators: options?.validators ?? [],
  };
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
  /**
   * Injection-prevention policy for field values: sanitization profiles
   * (`"text"`/`"strict"` or a custom function), string length caps and a
   * violation telemetry hook. Opt-in in 0.x (`sanitize` defaults to
   * `"off"`); the structural checks (draft shape, server-error paths) are
   * always on. See docs/guides/security.md.
   */
  readonly security?: MdySecurityPolicy;
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
export const SCHEMA_KEY = "mdy-schema";

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
  /** Injection-prevention policy — see {@link MdyCoreFormOptions.security}. */
  readonly security?: MdySecurityPolicy;
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
  /** Array prefixes — used to flatten patches and unflatten values. */
  protected readonly _arrayPaths: ReadonlySet<string>;
  /** One {@link MdyArrayManager} per array node, keyed by dotted path. */
  protected readonly _arrays: ReadonlyMap<string, MdyArrayManager>;

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
    this._arrayPaths = paths.arrayPaths;

    const arrays = new Map<string, MdyArrayManager>();
    walkSchema(
      schema,
      "",
      () => { /* fields registered below, by _registerSchema */ },
      undefined,
      (path, node) => {
        arrays.set(
          path,
          new MdyArrayManager(
            { rx: adapter.reactivity, engine: adapter, path, item: node.item },
            node.initial,
          ),
        );
      },
    );
    this._arrays = arrays;

    this._registerSchema(schema);

    const arrayValidators = this._buildArrayValidators(schema);

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
    if (formValidators.length > 0 || arrayValidators.length > 0) {
      // Cross-field validators see the nested typed value; the errors they
      // return use the same dotted paths the flat adapter stores fields under.
      // Array-level validators (e.g. minLength on the array itself) are
      // merged in here too — setFormValidators replaces the whole list.
      this._adapter.setFormValidators([
        ...formValidators.map(
          (fn) => (flat: Record<string, unknown>) =>
            fn(this._flatToValue(flat)),
        ),
        ...arrayValidators,
      ]);
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
    this._applyFlatWithArrays(this._flattenPatch(partial));
  }

  /** Deeply-typed variant of {@link patchValue} for nested groups. */
  patch(partial: MdyFormPatch<S>): void {
    this._applyFlatWithArrays(this._flattenPatch(partial));
  }

  setValue(value: MdyFormValue<S>): void {
    const flat: Record<string, unknown> = {};
    for (const path of this._leafPaths) {
      flat[path] = this._pathGet(value, path);
    }
    // Plain fields first — replace semantics null out stale array rows too,
    // which the array setAll below then rebuilds with the new values.
    this._adapter.setValue(flat);
    for (const [path, manager] of this._arrays) {
      const arr = this._pathGet(value, path);
      manager.setAll(Array.isArray(arr) ? arr : []);
    }
  }

  reset(): void {
    this._adapter.reset();
    for (const manager of this._arrays.values()) {
      manager.resetToInitial();
    }
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
    for (const manager of this._arrays.values()) manager.destroy();
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
    options?: MdyAsyncValidatorOptions,
  ): void {
    this._adapter.upsertAsyncValidators(name, key, validators, options);
  }

  setInitialValue(name: string, value: unknown): void {
    this._adapter.setInitialValue(name, value);
  }

  setSanitizer(name: string, sanitizer: MdySanitizer): void {
    this._adapter.setSanitizer(name, sanitizer);
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
      if (node.sanitize !== null) {
        this._adapter.setSanitizer(path, node.sanitize);
      }
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
          {
            debounceMs: node.asyncDebounceMs,
            dependsOn: node.asyncDependsOn,
            timeoutMs: node.asyncTimeoutMs,
            when: node.asyncWhen ?? undefined,
          },
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
      if (node.kind === "field") {
        out[key] = this._buildHandle(path);
      } else if (node.kind === "array") {
        out[key] = this._buildArrayHandle(path, node);
      } else {
        out[key] = this._buildHandleTree(node.children, path);
      }
    }
    if (isFieldHandleTree(out, nodes)) {
      return out;
    }
    throw new Error("[modyra] Failed to build typed handle tree");
  }

  protected abstract _buildHandle(path: string): THandle;

  private _buildArrayHandle(
    path: string,
    node: MdyAnyArrayDescriptor,
  ): MdyArrayHandle<unknown, unknown> {
    const manager = this._arrays.get(path);
    if (!manager) {
      throw new Error(`[modyra] Array "${path}" was not registered`);
    }
    const rx = this._adapter.reactivity;
    const rows = rx.computed(() =>
      Array.from({ length: manager.rowCount() }, (_, i) =>
        node.item.kind === "field"
          ? this._buildHandle(`${path}.${i}`)
          : this._buildHandleTree(node.item.children, `${path}.${i}`),
      ),
    );
    const errors = this._adapter.errorsFor(path);
    return {
      path,
      length: manager.rowCount,
      rows,
      errors,
      valid: rx.computed(() => errors().length === 0),
      push: (value: unknown) => manager.push(value),
      insert: (index: number, value: unknown) => manager.insert(index, value),
      remove: (index: number) => manager.remove(index),
      move: (from: number, to: number) => manager.move(from, to),
      setAll: (values: ReadonlyArray<unknown>) => manager.setAll(values),
      at: (index: number) => rows()[index] ?? null,
    };
  }

  /** Rebuilds the nested value shape from the adapter's flat dotted paths. */
  protected _flatToValue(flat: Record<string, unknown>): MdyFormValue<S> {
    return numericKeysToArrays(unflatten(flat), this._arrayPaths) as MdyFormValue<S>;
  }

  protected _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    return numericKeysToArrays(unflatten(flat), this._arrayPaths) as MdyFormPatch<S>;
  }

  /** Flattens a (possibly nested) patch object into dotted adapter paths. */
  protected _flattenPatch(
    partial: Partial<MdyFormValue<S>> | MdyFormPatch<S>,
  ): Record<string, unknown> {
    return flattenPatch(
      partial as Record<string, unknown>,
      this._groupPaths,
      this._arrayPaths,
    );
  }

  /** Routes array-path entries to their manager, the rest to the flat adapter. */
  protected _applyFlatWithArrays(flat: Record<string, unknown>): void {
    const plain: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(flat)) {
      const manager = this._arrays.get(key);
      if (manager) {
        manager.setAll(Array.isArray(v) ? v : []);
      } else {
        plain[key] = v;
      }
    }
    if (Object.keys(plain).length > 0) {
      this._adapter.patchValue(plain);
    }
  }

  /** Wraps each array node's own validators as a form-level validator (A.6). */
  private _buildArrayValidators(
    schema: MdyFormSchema,
  ): ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>> {
    const out: Array<MdyFormValidatorFn<Record<string, unknown>>> = [];
    walkSchema(
      schema,
      "",
      () => { /* fields are not array-level */ },
      undefined,
      (path, node) => {
        if (node.validators.length === 0) return;
        out.push((flat) => {
          const nested = numericKeysToArrays(unflatten(flat), this._arrayPaths);
          const value = this._pathGet(nested, path);
          const arr = Array.isArray(value) ? value : [];
          // Cast at the storage boundary, like upsertValidators does for
          // fields: node.validators is erased to ValidatorFn<never> in the
          // schema union, but the runtime value always matches the array.
          return node.validators.flatMap((fn) =>
            (fn as ValidatorFn<unknown[]>)(arr).map((message) => ({
              path,
              kind: "array",
              message,
            })),
          );
        });
      },
    );
    return out;
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
      { security: options?.security },
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
    const nested = numericKeysToArrays(unflatten(flat), this._arrayPaths);
    if (isSchemaValue(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat value does not match schema shape");
  }

  /** Core validates the unflattened patch against the schema shape. */
  protected override _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    const nested = numericKeysToArrays(unflatten(flat), this._arrayPaths);
    if (isSchemaPatch(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat patch does not match schema shape");
  }
}
