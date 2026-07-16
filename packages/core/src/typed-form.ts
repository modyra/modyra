import { MdyReactivity, MdySignal, vanillaReactivity } from "./reactivity.js";
import {
  MdyDraftOptions,
  MdyFormEngine,
  MdyFormRegistry,
} from "./form-engine.js";
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
import { MDY_MARKS_REQUIRED } from "./validators.js";

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
 * Typed form model over the flat {@link MdyFormEngine}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyFormRegistry`, so bindings that speak the flat path protocol keep
 * working next to the typed handle tree.
 */
export class MdyTypedForm<S extends MdyFormSchema>
  implements MdyFormAdapter<MdyFormValue<S>>, MdyFormRegistry
{
  private readonly _engine: MdyFormEngine;
  /** Leaf paths in schema order. */
  private readonly _leafPaths: readonly string[];
  /** Group prefixes — used to flatten nested patches. */
  private readonly _groupPaths: ReadonlySet<string>;

  /** Typed handle tree mirroring the schema (`form.f.address.city`). */
  readonly f: MdyFieldHandleTree<S>;
  readonly state: MdyFormState;
  readonly value: MdySignal<MdyFormValue<S>>;

  constructor(schema: S, options?: MdyCoreFormOptions<MdyFormValue<S>>) {
    const rx = options?.reactivity ?? vanillaReactivity();
    this._engine = new MdyFormEngine(
      rx,
      () => undefined,
      () => options?.submitMode ?? "valid-only",
    );

    const leafPaths: string[] = [];
    const groupPaths = new Set<string>();
    this._registerSchema(schema, "", leafPaths, groupPaths);
    this._leafPaths = leafPaths;
    this._groupPaths = groupPaths;

    const history = options?.history;
    if (history === true) {
      this._engine.enableHistory();
    } else if (history) {
      this._engine.enableHistory(history);
    }

    const draft = options?.draft;
    if (typeof draft === "string") {
      this._engine.enableDraft({ key: draft });
    } else if (draft) {
      this._engine.enableDraft(draft);
    }

    const formValidators = options?.validators ?? [];
    if (formValidators.length > 0) {
      // Cross-field validators see the nested typed value; the errors they
      // return use the same dotted paths the flat engine stores fields under.
      this._engine.setFormValidators(
        formValidators.map(
          (fn) => (flat: Record<string, unknown>) =>
            fn(this._unflatten(flat) as MdyFormValue<S>),
        ),
      );
    }

    // The cast is the single typed/stringly boundary: the tree is built to
    // mirror the schema shape walked above.
    this.f = this._buildHandleTree(schema, "") as MdyFieldHandleTree<S>;
    this.state = this._engine.state;
    this.value = rx.computed(
      () => this._unflatten(this._engine.value()) as MdyFormValue<S>,
    );
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getValue(): MdyFormValue<S> {
    return this._unflatten(this._engine.getValue()) as MdyFormValue<S>;
  }

  getField<K extends keyof MdyFormValue<S>>(
    name: K,
  ): MdyFieldRef<MdyFormValue<S>[K]> | null;
  getField(name: string): MdyFieldRef<unknown> | null;
  getField(name: string): MdyFieldRef<unknown> | null {
    return this._engine.getField(name);
  }

  errorsFor(
    path: keyof MdyFormValue<S> | string,
  ): MdySignal<ReadonlyArray<MdyFormError>> {
    return this._engine.errorsFor(String(path));
  }

  async submit(
    action: (
      value: MdyFormValue<S>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._engine.submit((flat) =>
      action(this._unflatten(flat) as MdyFormValue<S>),
    );
  }

  markAllTouched(): void {
    this._engine.markAllTouched();
  }

  buildSubmitEvent(value: MdyFormValue<S>): MdyFormSubmitEvent<MdyFormValue<S>> {
    return {
      value,
      valid: this.state.valid(),
      errors: [...this.state.lastSubmitErrors()],
    };
  }

  patchValue(partial: Partial<MdyFormValue<S>>): void {
    this._engine.patchValue(
      this._flattenPatch(partial as Record<string, unknown>),
    );
  }

  /** Deeply-typed variant of {@link patchValue} for nested groups. */
  patch(partial: MdyFormPatch<S>): void {
    this._engine.patchValue(
      this._flattenPatch(partial as Record<string, unknown>),
    );
  }

  setValue(value: MdyFormValue<S>): void {
    const flat: Record<string, unknown> = {};
    for (const path of this._leafPaths) {
      flat[path] = this._pathGet(value as Record<string, unknown>, path);
    }
    this._engine.setValue(flat);
  }

  reset(): void {
    this._engine.reset();
  }

  // ── History and change tracking ─────────────────────────────────────────────

  /** True when {@link undo} has state to restore (requires `history` option). */
  get canUndo(): MdySignal<boolean> {
    return this._engine.canUndo;
  }

  /** True when {@link redo} has state to restore. */
  get canRedo(): MdySignal<boolean> {
    return this._engine.canRedo;
  }

  /** Restores the previous recorded form value. */
  undo(): void {
    this._engine.undo();
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._engine.redo();
  }

  /**
   * Minimal nested patch: only the fields whose value differs from the
   * schema's initial values — ready for an API PATCH request.
   */
  getChanges(): MdyFormPatch<S> {
    return this._unflatten(this._engine.getChanges()) as MdyFormPatch<S>;
  }

  /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
  get fieldNames(): MdySignal<readonly string[]> {
    return this._engine.fieldNames;
  }

  /** True when a stored draft was restored (requires the `draft` option). */
  get hasDraft(): MdySignal<boolean> {
    return this._engine.hasDraft;
  }

  /** Removes the stored draft (also happens after an error-free submit). */
  clearDraft(): void {
    this._engine.clearDraft();
  }

  // ── MdyFormRegistry (bindings speaking the flat path protocol) ──────────────

  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired?: boolean,
  ): void {
    this._engine.addValidators(name, validators, isRequired);
  }

  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired?: boolean,
  ): void {
    this._engine.upsertValidators(name, key, validators, marksRequired);
  }

  removeValidators(name: string, key: string): void {
    this._engine.removeValidators(name, key);
  }

  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: { readonly debounceMs?: number },
  ): void {
    this._engine.upsertAsyncValidators(name, key, validators, options);
  }

  setInitialValue(name: string, value: unknown): void {
    this._engine.setInitialValue(name, value);
  }

  setDisabled(name: string, disabled: MdySignal<boolean>): void {
    this._engine.setDisabled(name, disabled);
  }

  setReadonly(name: string, readonly: MdySignal<boolean>): void {
    this._engine.setReadonly(name, readonly);
  }

  claimField(name: string): void {
    this._engine.claimField(name);
  }

  removeField(name: string): void {
    this._engine.removeField(name);
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
        this._engine.setInitialValue(path, node.initial);
        this._engine.getField(path);
        const marksRequired = node.validators.some(
          (fn) =>
            (fn as { readonly [MDY_MARKS_REQUIRED]?: boolean })[
              MDY_MARKS_REQUIRED
            ] === true,
        );
        this._engine.upsertValidators(
          path,
          SCHEMA_KEY,
          node.validators,
          marksRequired,
        );
        if (node.asyncValidators.length > 0) {
          this._engine.upsertAsyncValidators(
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
    const ref = this._engine.getField(path);
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

  /** Rebuilds the nested value shape from the engine's flat dotted paths. */
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

  /** Flattens a (possibly nested) patch object into dotted engine paths. */
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
