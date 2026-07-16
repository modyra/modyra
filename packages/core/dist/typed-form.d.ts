import { MdyReactivity, MdySignal } from "./reactivity.js";
import { MdyDraftOptions, MdyFormRegistry } from "./form-engine.js";
import { MdyAsyncValidatorFn, MdyFieldError, MdyFieldRef, MdyFormAdapter, MdyFormError, MdyFormState, MdyFormSubmitEvent, MdyFormValidatorFn, MdySubmitMode, ValidatorFn } from "./types.js";
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
/** The value type a schema produces — `form.getValue()` returns this. */
export type MdyFormValue<S extends MdyFormSchema> = {
    [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V> ? V : S[K] extends MdyGroupDescriptor<infer C> ? MdyFormValue<C> : never;
};
/** Deep partial of the schema value — accepted by `patch`. */
export type MdyFormPatch<S extends MdyFormSchema> = {
    readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V> ? V : S[K] extends MdyGroupDescriptor<infer C> ? MdyFormPatch<C> : never;
};
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
    readonly [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V> ? MdyFieldHandle<V> : S[K] extends MdyGroupDescriptor<infer C> ? MdyFieldHandleTree<C> : never;
};
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
export type MdyWiden<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;
/** Declares a typed leaf field of a {@link createForm} schema. */
export declare function field<TValue>(initial: TValue, validators?: ReadonlyArray<ValidatorFn<MdyWiden<TValue>>>, options?: MdyFieldOptions<MdyWiden<TValue>>): MdyFieldDescriptor<MdyWiden<TValue>>;
/** Declares a nested group of fields (`address.city` paths on the engine). */
export declare function group<TChildren extends MdyFormSchema>(children: TChildren): MdyGroupDescriptor<TChildren>;
export interface MdyCoreFormOptions<TValue extends Record<string, unknown> = Record<string, unknown>> {
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
    readonly history?: boolean | {
        readonly maxEntries?: number;
        readonly debounceMs?: number;
    };
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
export declare function createForm<S extends MdyFormSchema>(schema: S, options?: MdyCoreFormOptions<MdyFormValue<S>>): MdyTypedForm<S>;
/**
 * Typed form model over the flat {@link MdyFormEngine}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyFormRegistry`, so bindings that speak the flat path protocol keep
 * working next to the typed handle tree.
 */
export declare class MdyTypedForm<S extends MdyFormSchema> implements MdyFormAdapter<MdyFormValue<S>>, MdyFormRegistry {
    private readonly _engine;
    /** Leaf paths in schema order. */
    private readonly _leafPaths;
    /** Group prefixes — used to flatten nested patches. */
    private readonly _groupPaths;
    /** Typed handle tree mirroring the schema (`form.f.address.city`). */
    readonly f: MdyFieldHandleTree<S>;
    readonly state: MdyFormState;
    readonly value: MdySignal<MdyFormValue<S>>;
    constructor(schema: S, options?: MdyCoreFormOptions<MdyFormValue<S>>);
    getValue(): MdyFormValue<S>;
    getField<K extends keyof MdyFormValue<S>>(name: K): MdyFieldRef<MdyFormValue<S>[K]> | null;
    getField(name: string): MdyFieldRef<unknown> | null;
    errorsFor(path: keyof MdyFormValue<S> | string): MdySignal<ReadonlyArray<MdyFormError>>;
    submit(action: (value: MdyFormValue<S>) => Promise<MdyFormError[] | void> | MdyFormError[] | void): Promise<void>;
    markAllTouched(): void;
    buildSubmitEvent(value: MdyFormValue<S>): MdyFormSubmitEvent<MdyFormValue<S>>;
    patchValue(partial: Partial<MdyFormValue<S>>): void;
    /** Deeply-typed variant of {@link patchValue} for nested groups. */
    patch(partial: MdyFormPatch<S>): void;
    setValue(value: MdyFormValue<S>): void;
    reset(): void;
    /** True when {@link undo} has state to restore (requires `history` option). */
    get canUndo(): MdySignal<boolean>;
    /** True when {@link redo} has state to restore. */
    get canRedo(): MdySignal<boolean>;
    /** Restores the previous recorded form value. */
    undo(): void;
    /** Re-applies the value undone by the last {@link undo}. */
    redo(): void;
    /**
     * Minimal nested patch: only the fields whose value differs from the
     * schema's initial values — ready for an API PATCH request.
     */
    getChanges(): MdyFormPatch<S>;
    /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
    get fieldNames(): MdySignal<readonly string[]>;
    /** True when a stored draft was restored (requires the `draft` option). */
    get hasDraft(): MdySignal<boolean>;
    /** Removes the stored draft (also happens after an error-free submit). */
    clearDraft(): void;
    addValidators<T>(name: string, validators: ReadonlyArray<ValidatorFn<T>>, isRequired?: boolean): void;
    upsertValidators<T>(name: string, key: string, validators: ReadonlyArray<ValidatorFn<T>>, marksRequired?: boolean): void;
    removeValidators(name: string, key: string): void;
    upsertAsyncValidators<T>(name: string, key: string, validators: ReadonlyArray<MdyAsyncValidatorFn<T>>, options?: {
        readonly debounceMs?: number;
    }): void;
    setInitialValue(name: string, value: unknown): void;
    setDisabled(name: string, disabled: MdySignal<boolean>): void;
    setReadonly(name: string, readonly: MdySignal<boolean>): void;
    claimField(name: string): void;
    removeField(name: string): void;
    private _registerSchema;
    private _buildHandleTree;
    private _buildHandle;
    /** Rebuilds the nested value shape from the engine's flat dotted paths. */
    private _unflatten;
    /** Flattens a (possibly nested) patch object into dotted engine paths. */
    private _flattenPatch;
    private _pathGet;
}
