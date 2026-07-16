import { MdyReactivity, MdySignal } from "./reactivity.js";
import { MdyAsyncValidatorFn, MdyAsyncValidatorOptions, MdyFieldRef, MdyFormAdapter, MdyFormError, MdyFormState, MdyFormSubmitEvent, MdyFormValidatorFn, MdySubmitMode, ValidatorFn } from "./types.js";
export interface MdyFormRegistry {
    /**
     * Registers type-specific validators for a named field.
     * Validators added through this method cannot be updated or removed later;
     * prefer {@link upsertValidators} with a stable key.
     */
    addValidators<T>(name: string, validators: ReadonlyArray<ValidatorFn<T>>, isRequired?: boolean): void;
    /**
     * Registers (or replaces) the validators owned by `key` for a named field.
     * Re-invoking with the same key swaps the previous set. `marksRequired`
     * flags the field as required while the key is registered with it set.
     */
    upsertValidators<T>(name: string, key: string, validators: ReadonlyArray<ValidatorFn<T>>, marksRequired?: boolean): void;
    /** Removes the sync and async validators owned by `key` from a field. */
    removeValidators(name: string, key: string): void;
    /**
     * Registers (or replaces) async validators owned by `key`. While they run
     * the field is `pending`; results follow last-wins semantics.
     */
    upsertAsyncValidators<T>(name: string, key: string, validators: ReadonlyArray<MdyAsyncValidatorFn<T>>, options?: MdyAsyncValidatorOptions): void;
    setInitialValue(name: string, value: unknown): void;
    setDisabled(name: string, disabled: MdySignal<boolean>): void;
    setReadonly(name: string, readonly: MdySignal<boolean>): void;
    /**
     * Declares that a control instance owns the named field. Claims are
     * reference-counted: the field state is dropped only when the last
     * claiming control calls {@link removeField}.
     */
    claimField(name: string): void;
    removeField(name: string): void;
}
/** Pluggable storage for {@link MdyFormEngine.enableDraft}. */
export interface MdyDraftStorage {
    read(key: string): string | null;
    write(key: string, value: string): void;
    remove(key: string): void;
}
export interface MdyDraftOptions {
    /** Storage key the draft is persisted under. */
    readonly key: string;
    /** Defaults to `localStorage` (inert when unavailable: SSR, Node). */
    readonly storage?: MdyDraftStorage;
    /** Milliseconds of inactivity before the draft is written. Default 400. */
    readonly debounceMs?: number;
    /**
     * Field paths never persisted (nor restored) — use for passwords, tokens,
     * card numbers and any other sensitive value. The default storage is
     * `localStorage`, which is plain-text and shared by every script on the
     * origin: treat everything you persist as readable.
     */
    readonly exclude?: readonly string[];
    /**
     * Drafts older than this many milliseconds are discarded on restore
     * instead of being applied. Omit for no expiry.
     */
    readonly ttlMs?: number;
    /**
     * Schema version of the draft (default 1). A stored draft with a different
     * version is discarded on restore — bump it when the form's shape changes
     * incompatibly.
     */
    readonly version?: number;
}
export interface MdyFormEngineOptions {
    /** Emit console warnings for suspicious usage. Default true. */
    readonly devWarnings?: boolean;
}
/**
 * Framework-agnostic form engine: a flat registry of fields keyed by string
 * paths (dotted for groups), with sync/async/cross-field validation, submit
 * handling with server errors, draft persistence and undo/redo history —
 * everything derived through the {@link MdyReactivity} contract, never
 * through a framework API.
 *
 * Fields are created lazily on first `getField()`/`claimField()` call.
 */
export declare class MdyFormEngine implements MdyFormAdapter<Record<string, unknown>>, MdyFormRegistry {
    protected readonly _rx: MdyReactivity;
    private readonly _formValue;
    private readonly _submitMode;
    private readonly _fields;
    /** Reactive list of field names — drives state.valid computation. */
    private readonly _fieldNames;
    private readonly _initialValues;
    /** Reference count of controls claiming each field name. */
    private readonly _claims;
    /** Form-level (cross-field) validators. */
    private readonly _formValidators;
    /** Errors produced by the form-level validators on the current value. */
    private readonly _crossErrors;
    private readonly _submitting;
    private readonly _submitCount;
    private readonly _lastSubmitErrors;
    /**
     * Form value captured at the moment the last submit reported errors.
     * A field shows its server errors only while its value still matches the
     * snapshot — editing the field clears them.
     */
    private readonly _submitSnapshot;
    private readonly _devWarnings;
    readonly state: MdyFormState;
    /** Reactive signal emitting the current form value on every field change. */
    readonly value: MdySignal<Record<string, unknown>>;
    /** Reactive list of the registered field names (flat, dotted for groups). */
    readonly fieldNames: MdySignal<readonly string[]>;
    constructor(_rx: MdyReactivity, _formValue?: MdySignal<Record<string, unknown> | undefined>, _submitMode?: MdySignal<MdySubmitMode>, options?: MdyFormEngineOptions);
    private _warn;
    claimField(name: string): void;
    /**
     * Releases one claim on the field. The record (value, validators, flags)
     * is destroyed only when no claiming control remains.
     */
    removeField(name: string): void;
    setInitialValue(name: string, value: unknown): void;
    addValidators<T>(name: string, validators: ReadonlyArray<ValidatorFn<T>>, isRequired?: boolean): void;
    upsertValidators<T>(name: string, key: string, validators: ReadonlyArray<ValidatorFn<T>>, marksRequired?: boolean): void;
    removeValidators(name: string, key: string): void;
    upsertAsyncValidators<T>(name: string, key: string, validators: ReadonlyArray<MdyAsyncValidatorFn<T>>, options?: MdyAsyncValidatorOptions): void;
    /**
     * Replaces the form-level (cross-field) validators. Each receives the whole
     * flat form value and returns errors attributed to field paths — or to the
     * form itself with `path: null`. Errors show up in the matching fields'
     * `errors()` and gate `state.valid`.
     */
    setFormValidators(validators: ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>): void;
    setDisabled(name: string, disabled: MdySignal<boolean>): void;
    setReadonly(name: string, readonly: MdySignal<boolean>): void;
    getField(name: string): MdyFieldRef<unknown> | null;
    getValue(): Record<string, unknown>;
    errorsFor(path: string): MdySignal<ReadonlyArray<MdyFormError>>;
    markAllTouched(): void;
    patchValue(partial: Partial<Record<string, unknown>>): void;
    setValue(value: Record<string, unknown>): void;
    reset(): void;
    buildSubmitEvent(value: Record<string, unknown>): MdyFormSubmitEvent<Record<string, unknown>>;
    submit(action: (v: Record<string, unknown>) => Promise<MdyFormError[] | void> | MdyFormError[] | void): Promise<void>;
    private _draftKey;
    private _draftStorage;
    private _draftEffect;
    private _draftTimer;
    private _draftExclude;
    private _draftVersion;
    /** Serialized value at enable time — a pristine form writes no draft. */
    private _draftBaseline;
    private _draftLastWritten;
    private readonly _hasDraft;
    /** True when a stored draft was found and restored by {@link enableDraft}. */
    readonly hasDraft: MdySignal<boolean>;
    /**
     * Persists the form value under `key` on every (debounced) change and
     * restores an existing draft immediately. The draft is cleared
     * automatically after a submit that reports no errors, or manually via
     * {@link clearDraft}. `File` values are skipped (not serializable).
     */
    enableDraft(options: MdyDraftOptions): void;
    /** Removes the stored draft (also called after an error-free submit). */
    clearDraft(): void;
    /**
     * Parses a stored draft, returning its value or `null` when it must be
     * discarded (corrupt JSON, version mismatch, expired TTL). Envelope-less
     * payloads written by pre-versioning releases are still accepted.
     */
    private _parseDraft;
    private _serializeDraft;
    private _writeDraft;
    private readonly _undoStack;
    private readonly _redoStack;
    private _lastSnapshot;
    private _historyEffect;
    private _historyTimer;
    private readonly _canUndo;
    private readonly _canRedo;
    /** True when {@link undo} has state to restore (see {@link enableHistory}). */
    readonly canUndo: MdySignal<boolean>;
    /** True when {@link redo} has state to restore. */
    readonly canRedo: MdySignal<boolean>;
    /**
     * Starts recording value snapshots for {@link undo}/{@link redo}. Idempotent.
     *
     * `debounceMs` batches rapid changes (e.g. keystrokes) into a single
     * history entry — without it every value change becomes an undo step.
     * Only the form **value** is recorded: touched/dirty flags, server errors
     * and validation state are not restored by undo/redo.
     */
    enableHistory(options?: {
        readonly maxEntries?: number;
        readonly debounceMs?: number;
    }): void;
    /**
     * Flushes a pending debounced snapshot so undo/redo act on the latest
     * value instead of the last recorded batch.
     */
    private _flushHistory;
    /** Restores the previous recorded form value (no-op when history is empty). */
    undo(): void;
    /** Re-applies the value undone by the last {@link undo}. */
    redo(): void;
    /**
     * Minimal patch of the form: only the fields whose current value differs
     * (Object.is) from their declared initial value — ready for an API PATCH.
     */
    getChanges(): Record<string, unknown>;
    private _getOrCreate;
    private _createFieldRecord;
    /** Cross-field errors attributed to the named field. */
    private _crossErrorsFor;
    /**
     * Server errors from the last submit, shown only while the field value
     * still equals the value that was submitted.
     */
    private _serverErrorsFor;
    /** Lazily creates the effect that runs async validators for a field. */
    private _ensureAsyncRunner;
}
