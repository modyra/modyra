import { computed, inject, Injector, signal, Signal } from "@angular/core";
import {
  MdyDeclarativeAdapter,
  MdyDeclarativeRegistry,
  MdyDraftOptions,
} from "./declarative-form-adapter";
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
} from "./types";
import { MDY_MARKS_REQUIRED } from "./validators";

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

/** Deep partial of the schema value — accepted by `patchValue`. */
export type MdyFormPatch<S extends MdyFormSchema> = {
  readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V>
    ? V
    : S[K] extends MdyGroupDescriptor<infer C>
      ? MdyFormPatch<C>
      : never;
};

// ─── Field handles ────────────────────────────────────────────────────────────

/**
 * Typed handle for a single field, exposed on `form.f`.
 * Bind it to a renderer with `[field]="form.f.email"` — a typo on the
 * handle path is a compile error, unlike the stringly `name` attribute.
 */
export interface MdyFieldHandle<TValue> {
  /** Flat adapter path of the field (dot-separated for nested groups). */
  readonly path: string;
  readonly value: Signal<TValue>;
  readonly errors: Signal<ReadonlyArray<MdyFieldError>>;
  readonly touched: Signal<boolean>;
  readonly dirty: Signal<boolean>;
  readonly valid: Signal<boolean>;
  readonly pending: Signal<boolean>;
  readonly required: Signal<boolean>;
  readonly disabled: Signal<boolean>;
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

/** Declares a typed leaf field of a {@link mdyForm} schema. */
export function field<TValue>(
  initial: TValue,
  validators: ReadonlyArray<ValidatorFn<MdyWiden<TValue>>> = [],
  options?: MdyFieldOptions<MdyWiden<TValue>>,
): MdyFieldDescriptor<MdyWiden<TValue>> {
  return {
    kind: "field",
    initial: initial as MdyWiden<TValue>,
    validators,
    asyncValidators: options?.asyncValidators ?? [],
    asyncDebounceMs: options?.asyncDebounceMs ?? 0,
  };
}

/** Declares a nested group of fields (`address.city` paths on the adapter). */
export function group<TChildren extends MdyFormSchema>(
  children: TChildren,
): MdyGroupDescriptor<TChildren> {
  return { kind: "group", children };
}

export interface MdyFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly submitMode?: MdySubmitMode;
  /**
   * Needed only for async validators when `mdyForm()` is called outside an
   * injection context; inside a field initializer it is resolved automatically.
   */
  readonly injector?: Injector;
  /**
   * Form-level (cross-field) validators. Each receives the whole typed value
   * and returns errors attributed to field paths (dotted for nested groups)
   * or to the form itself (`path: null`). Build them with `crossField()`.
   */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
  /**
   * Records value snapshots for `undo()`/`redo()`.
   * Pass `true` or `{ maxEntries, debounceMs }` (defaults: 100 entries,
   * no debounce). `debounceMs` batches rapid keystrokes into one undo step.
   * Only the value is recorded — touched/dirty/errors are not restored.
   */
  readonly history?:
    | boolean
    | { readonly maxEntries?: number; readonly debounceMs?: number };
  /**
   * Autosaves the form value under `key` (localStorage by default) and
   * restores an existing draft on creation. Cleared automatically after an
   * error-free submit. Pass a string key or full `MdyDraftOptions` —
   * use `exclude` to keep passwords and other sensitive fields out of
   * storage, `ttlMs` for expiry and `version` for schema migrations.
   */
  readonly draft?: string | MdyDraftOptions;
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
  getField(name: string): MdyFieldRef<unknown> | null;
  errorsFor(path: string): Signal<ReadonlyArray<MdyFormError>>;
  submit(
    action: (
      value: Record<string, unknown>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void>;
  markAllTouched(): void;
  buildSubmitEvent(value: never): MdyFormSubmitEvent<Record<string, unknown>>;
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
  return new MdyTypedForm(schema, {
    ...(options?.submitMode !== undefined && { submitMode: options.submitMode }),
    ...(options?.validators !== undefined && { validators: options.validators }),
    ...(options?.history !== undefined && { history: options.history }),
    ...(options?.draft !== undefined && { draft: options.draft }),
    ...(injector !== undefined && { injector }),
  });
}

// ─── Typed form ───────────────────────────────────────────────────────────────

/** Owner key for validators registered from the schema. */
const SCHEMA_KEY = "mdy-schema";

/**
 * Typed form model over the flat {@link MdyDeclarativeAdapter}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyDeclarativeRegistry`, so it plugs into `<mdy-form [form]>` and keeps
 * working with validator directives and `name`-based controls side by side.
 */
export class MdyTypedForm<S extends MdyFormSchema>
  implements MdyFormAdapter<MdyFormValue<S>>, MdyDeclarativeRegistry
{
  private readonly _adapter: MdyDeclarativeAdapter;
  /** Leaf paths in schema order. */
  private readonly _leafPaths: readonly string[];
  /** Group prefixes — used to flatten nested patches. */
  private readonly _groupPaths: ReadonlySet<string>;

  /** Typed handle tree mirroring the schema (`form.f.address.city`). */
  readonly f: MdyFieldHandleTree<S>;
  readonly state: MdyFormState;
  readonly value: Signal<MdyFormValue<S>>;

  constructor(schema: S, options?: MdyFormOptions<MdyFormValue<S>>) {
    this._adapter = new MdyDeclarativeAdapter(
      signal(undefined),
      signal(options?.submitMode ?? "valid-only"),
      options?.injector,
    );

    const leafPaths: string[] = [];
    const groupPaths = new Set<string>();
    this._registerSchema(schema, "", leafPaths, groupPaths);
    this._leafPaths = leafPaths;
    this._groupPaths = groupPaths;

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
            fn(this._unflatten(flat) as MdyFormValue<S>),
        ),
      );
    }

    // The cast is the single typed/stringly boundary: the tree is built to
    // mirror the schema shape walked above.
    this.f = this._buildHandleTree(schema, "") as MdyFieldHandleTree<S>;
    this.state = this._adapter.state;
    this.value = computed(
      () => this._unflatten(this._adapter.value()) as MdyFormValue<S>,
    );
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getValue(): MdyFormValue<S> {
    return this._unflatten(this._adapter.getValue()) as MdyFormValue<S>;
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
  ): Signal<ReadonlyArray<MdyFormError>> {
    return this._adapter.errorsFor(String(path));
  }

  async submit(
    action: (
      value: MdyFormValue<S>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._adapter.submit((flat) =>
      action(this._unflatten(flat) as MdyFormValue<S>),
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
    this._adapter.patchValue(
      this._flattenPatch(partial as Record<string, unknown>),
    );
  }

  /** Deeply-typed variant of {@link patchValue} for nested groups. */
  patch(partial: MdyFormPatch<S>): void {
    this._adapter.patchValue(
      this._flattenPatch(partial as Record<string, unknown>),
    );
  }

  setValue(value: MdyFormValue<S>): void {
    const flat: Record<string, unknown> = {};
    for (const path of this._leafPaths) {
      flat[path] = this._pathGet(value as Record<string, unknown>, path);
    }
    this._adapter.setValue(flat);
  }

  reset(): void {
    this._adapter.reset();
  }

  // ── History and change tracking ─────────────────────────────────────────────

  /** True when {@link undo} has state to restore (requires `history` option). */
  get canUndo(): Signal<boolean> {
    return this._adapter.canUndo;
  }

  /** True when {@link redo} has state to restore. */
  get canRedo(): Signal<boolean> {
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
    return this._unflatten(this._adapter.getChanges()) as MdyFormPatch<S>;
  }

  /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
  get fieldNames(): Signal<readonly string[]> {
    return this._adapter.fieldNames;
  }

  /** True when a stored draft was restored (requires the `draft` option). */
  get hasDraft(): Signal<boolean> {
    return this._adapter.hasDraft;
  }

  /** Removes the stored draft (also happens after an error-free submit). */
  clearDraft(): void {
    this._adapter.clearDraft();
  }

  // ── MdyDeclarativeRegistry (controls and directives inside [form]) ─────────

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

  setDisabled(name: string, disabled: Signal<boolean>): void {
    this._adapter.setDisabled(name, disabled);
  }

  setReadonly(name: string, readonly: Signal<boolean>): void {
    this._adapter.setReadonly(name, readonly);
  }

  claimField(name: string): void {
    this._adapter.claimField(name);
  }

  removeField(name: string): void {
    this._adapter.removeField(name);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _registerSchema(
    nodes: MdyFormSchema,
    prefix: string,
    leafPaths: string[],
    groupPaths: Set<string>,
  ): void {
    for (const [key, node] of Object.entries(nodes)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (node.kind === "field") {
        leafPaths.push(path);
        this._adapter.setInitialValue(path, node.initial);
        this._adapter.getField(path);
        const marksRequired = node.validators.some(
          (fn) =>
            (fn as { readonly [MDY_MARKS_REQUIRED]?: boolean })[
              MDY_MARKS_REQUIRED
            ] === true,
        );
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
      } else {
        groupPaths.add(path);
        this._registerSchema(node.children, path, leafPaths, groupPaths);
      }
    }
  }

  private _buildHandleTree(
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
    return out;
  }

  private _buildHandle(path: string): MdyFieldHandle<unknown> {
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

  /** Rebuilds the nested value shape from the adapter's flat dotted paths. */
  private _unflatten(flat: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [path, v] of Object.entries(flat)) {
      const parts = path.split(".");
      let target = out;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === undefined) continue;
        const existing = target[part];
        if (existing !== null && typeof existing === "object") {
          target = existing as Record<string, unknown>;
        } else {
          const next: Record<string, unknown> = {};
          target[part] = next;
          target = next;
        }
      }
      const leaf = parts[parts.length - 1];
      if (leaf !== undefined) target[leaf] = v;
    }
    return out;
  }

  /** Flattens a (possibly nested) patch object into dotted adapter paths. */
  private _flattenPatch(partial: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    const walk = (node: Record<string, unknown>, prefix: string): void => {
      for (const [key, v] of Object.entries(node)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (
          this._groupPaths.has(path) &&
          v !== null &&
          typeof v === "object"
        ) {
          walk(v as Record<string, unknown>, path);
        } else {
          flat[path] = v;
        }
      }
    };
    walk(partial, "");
    return flat;
  }

  private _pathGet(value: Record<string, unknown>, path: string): unknown {
    let current: unknown = value;
    for (const part of path.split(".")) {
      if (current === null || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[part];
    }
    return current === undefined ? null : current;
  }
}
