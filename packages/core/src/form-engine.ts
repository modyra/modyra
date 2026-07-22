import {
  MdyReactivity,
  MdyReactiveScope,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity.js";
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
import { MdyDraftManager, MdyDraftOptions } from "./draft-manager.js";
import {
  createAsyncRunner,
  createFieldRecord,
  type FieldRecord,
} from "./field-record.js";
import { MdyHistoryManager } from "./history-manager.js";
import { isSafeFieldPath } from "./path-utils.js";
import { MDY_DEV } from "./dev-flags.js";
import {
  applyValueSecurity,
  draftShapeMatches,
  MdySanitizer,
  MdySecurityPolicy,
  MdySecurityViolation,
} from "./security.js";

export type {
  MdySanitizer,
  MdySanitizeProfile,
  MdySecurityPolicy,
  MdySecurityViolation,
  MdySecurityViolationKind,
} from "./security.js";

export type { MdyDraftOptions, MdyDraftStorage } from "./draft-manager.js";

// ─── Registry interface ───────────────────────────────────────────────────────

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
  setDisabled(name: string, disabled: TBooleanSignal): void;
  setReadonly(name: string, readonly: TBooleanSignal): void;
  /**
   * Declares that a control instance owns the named field. Claims are
   * reference-counted: the field state is dropped only when the last
   * claiming control calls {@link removeField}.
   */
  claimField(name: string): void;
  removeField(name: string): void;
}

let _legacyValidatorKey = 0;

export interface MdyFormEngineOptions {
  /** Emit console warnings for suspicious usage. Default true. */
  readonly devWarnings?: boolean;
  /**
   * Injection-prevention policy for field values (sanitization, length
   * caps, violation telemetry). Structural checks (draft shape, server
   * error paths) are always on regardless. See security.ts.
   */
  readonly security?: MdySecurityPolicy;
}

// ─── Form engine ─────────────────────────────────────────────────────────────

/**
 * Framework-agnostic form engine: a flat registry of fields keyed by string
 * paths (dotted for groups), with sync/async/cross-field validation, submit
 * handling with server errors, draft persistence and undo/redo history —
 * everything derived through the {@link MdyReactivity} contract, never
 * through a framework API.
 *
 * Fields are created lazily on first `getField()`/`claimField()` call.
 */
export class MdyFormEngine
  implements MdyFormAdapter<Record<string, unknown>>, MdyFormRegistry {
  private readonly _fields = new Map<string, FieldRecord>();
  /** Reactive list of field names — drives state.valid computation. */
  private readonly _fieldNames: MdyWritableSignal<readonly string[]>;
  private readonly _initialValues = new Map<string, unknown>();
  /** Reference count of controls claiming each field name. */
  private readonly _claims = new Map<string, number>();
  /**
   * Cached value record used by the incremental `value` computed. Rebuilt when
   * field names change; otherwise mutated by single-key copy-on-write so a
   * single field update does not re-assemble the whole object.
   */
  private _valueSnapshot: Record<string, unknown> = {};
  private _valueSnapshotNames: readonly string[] = [];

  /** Form-level (cross-field) validators. */
  private readonly _formValidators: MdyWritableSignal<
    ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>
  >;
  /** Errors produced by the form-level validators on the current value. */
  private readonly _crossErrors: MdySignal<ReadonlyArray<MdyFormError>>;

  private readonly _submitting: MdyWritableSignal<boolean>;
  private readonly _submitCount: MdyWritableSignal<number>;
  private readonly _lastSubmitErrors: MdyWritableSignal<
    ReadonlyArray<MdyFormError>
  >;
  /**
   * Form value captured at the moment the last submit reported errors.
   * A field shows its server errors only while its value still matches the
   * snapshot — editing the field clears them.
   */
  private readonly _submitSnapshot: MdyWritableSignal<Record<
    string,
    unknown
  > | null>;

  private readonly _devWarnings: boolean;
  private readonly _security: MdySecurityPolicy;
  /** Per-field sanitizer overrides (schema-level), keyed by dotted path. */
  private readonly _fieldSanitizers = new Map<string, MdySanitizer>();

  readonly state: MdyFormState;

  /** The reactive implementation this form runs on (adapters, devtools). */
  get reactivity(): MdyReactivity {
    return this._rx;
  }

  /** Reactive signal emitting the current form value on every field change. */
  readonly value: MdySignal<Record<string, unknown>>;

  /** Reactive list of the registered field names (flat, dotted for groups). */
  readonly fieldNames: MdySignal<readonly string[]>;

  /** True when a stored draft was found and restored by {@link enableDraft}. */
  readonly hasDraft: MdySignal<boolean>;
  /** True when {@link undo} has state to restore (see {@link enableHistory}). */
  readonly canUndo: MdySignal<boolean>;
  /** True when {@link redo} has state to restore. */
  readonly canRedo: MdySignal<boolean>;

  private readonly _draftManager: MdyDraftManager;
  private readonly _historyManager: MdyHistoryManager;
  /**
   * Root ownership scope for this form (undefined when the adapter hasn't
   * implemented `createScope` yet — piano-modyra-reactivity-adapter-api.md
   * Milestone 2). Draft/history/async-validator effects register with it
   * as a backstop alongside their existing explicit `destroy()` calls.
   */
  private readonly _scope: MdyReactiveScope | undefined;

  constructor(
    protected readonly _rx: MdyReactivity,
    private readonly _formValue: MdySignal<
      Record<string, unknown> | undefined
    > = () => undefined,
    private readonly _submitMode: MdySignal<MdySubmitMode> = () =>
      "valid-only",
    options?: MdyFormEngineOptions,
  ) {
    this._devWarnings = options?.devWarnings ?? true;
    this._security = options?.security ?? {};
    this._scope = _rx.createScope?.({ debugName: "modyra:form" });
    const hasDraft = _rx.signal(false);
    this.hasDraft = hasDraft.asReadonly();
    this._draftManager = new MdyDraftManager({
      rx: _rx,
      getValue: () => this.value(),
      patchValue: (value) => this.patchValue(value),
      hasDraft,
      warn: (message) => this._warn(message),
      filterRestoredEntry: (key, value) => this._draftEntryAllowed(key, value),
      scope: this._scope,
    });
    this._historyManager = new MdyHistoryManager({
      rx: _rx,
      getValue: () => this.value(),
      setValue: (value) => this.setValue(value),
      warn: (message) => this._warn(message),
      scope: this._scope,
    });
    this.canUndo = this._historyManager.canUndo;
    this.canRedo = this._historyManager.canRedo;
    this._fieldNames = _rx.signal<readonly string[]>([]);
    this.fieldNames = this._fieldNames.asReadonly();
    this._formValidators = _rx.signal<
      ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>
    >([]);
    this._submitting = _rx.signal(false);
    this._submitCount = _rx.signal(0);
    this._lastSubmitErrors = _rx.signal<ReadonlyArray<MdyFormError>>([]);
    this._submitSnapshot = _rx.signal<Record<string, unknown> | null>(null);

    this.value = _rx.computed(() => {
      const names = this._fieldNames();
      const namesChanged =
        names.length !== this._valueSnapshotNames.length ||
        names.some((n, i) => n !== this._valueSnapshotNames[i]);
      if (namesChanged) {
        const next: Record<string, unknown> = {};
        for (const n of names) {
          next[n] = this._fields.get(n)?.state.value() ?? null;
        }
        this._valueSnapshot = next;
        this._valueSnapshotNames = names.slice();
        return next;
      }
      let next: Record<string, unknown> | null = null;
      for (const n of names) {
        const v = this._fields.get(n)!.state.value();
        if (next) {
          next[n] = v;
        } else if (!Object.is(this._valueSnapshot[n], v)) {
          next = { ...this._valueSnapshot, [n]: v };
        }
      }
      if (next) {
        this._valueSnapshot = next;
      }
      return this._valueSnapshot;
    });
    this._crossErrors = _rx.computed(() => {
      const fns = this._formValidators();
      if (fns.length === 0) return [];
      const value = this.value();
      return fns.flatMap(fn => fn(value));
    });
    const valid = _rx.computed(
      () =>
        this._fieldNames().every(
          n => this._fields.get(n)?.state.valid() ?? true,
        ) && this._crossErrors().length === 0,
    );
    const pending = _rx.computed(() =>
      this._fieldNames().some(n => this._fields.get(n)?.state.pending() ?? false),
    );
    this.state = {
      valid,
      pending,
      submitting: this._submitting,
      submitCount: this._submitCount,
      canSubmit: _rx.computed(() => {
        if (this._submitting()) return false;
        const mode = this._submitMode();
        if (mode === "valid-only") return valid() && !pending();
        if (mode === "always") return true;
        return false; // manual
      }),
      lastSubmitErrors: this._lastSubmitErrors,
    };
  }

  private _warn(message: string): void {
    if (this._devWarnings) {
      console.warn(`[modyra] ${message}`);
    }
  }

  // ── MdyFormRegistry ─────────────────────────────────────────────────────────

  claimField(name: string): void {
    const count = (this._claims.get(name) ?? 0) + 1;
    this._claims.set(name, count);
    this._getOrCreate(name);
    if (MDY_DEV && count > 1) {
      this._warn(
        `Duplicate control name "${name}": ${count} controls now share the same field state.`,
      );
    }
  }

  /**
   * Releases one claim on the field. The record (value, validators, flags)
   * is destroyed only when no claiming control remains.
   */
  removeField(name: string): void {
    const remaining = (this._claims.get(name) ?? 1) - 1;
    if (remaining > 0) {
      this._claims.set(name, remaining);
      return;
    }
    this._claims.delete(name);
    const rec = this._fields.get(name);
    if (rec) {
      rec.asyncRunner?.destroy();
      this._fields.delete(name);
      this._rx.untracked(() =>
        this._fieldNames.update(names => names.filter(n => n !== name)),
      );
      this._initialValues.delete(name);
      this._fieldSanitizers.delete(name);
    }
  }

  setInitialValue(name: string, value: unknown): void {
    // Sanitized once here so reset()/getChanges() compare against the value
    // the field actually holds; the record write below re-applies the
    // (idempotent) sanitizer harmlessly.
    const sanitized = this._applySecurity(name, value);
    this._initialValues.set(name, sanitized);
    const rec = this._fields.get(name);
    if (rec) {
      rec.state.value.set(sanitized);
    }
  }

  setSanitizer(name: string, sanitizer: MdySanitizer): void {
    this._fieldSanitizers.set(name, sanitizer);
  }

  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired = false,
  ): void {
    this.upsertValidators(name, `__legacy_${_legacyValidatorKey++}`, validators, isRequired);
  }

  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired = false,
  ): void {
    const rec = this._getOrCreate(name);
    // Cast from ValidatorFn<T> to ValidatorFn<unknown> at the storage boundary.
    // Safe: the field value is always of type T at runtime (validator and field
    // are wired together by the field name).
    rec.validators.update(map => {
      const next = new Map(map);
      next.set(key, validators as ReadonlyArray<ValidatorFn<unknown>>);
      return next;
    });
    rec.requiredKeys.update(keys => {
      if (marksRequired === keys.has(key)) return keys;
      const next = new Set(keys);
      if (marksRequired) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  removeValidators(name: string, key: string): void {
    const rec = this._fields.get(name);
    if (!rec) return;
    rec.validators.update(map => {
      if (!map.has(key)) return map;
      const next = new Map(map);
      next.delete(key);
      return next;
    });
    rec.asyncValidators.update(map => {
      if (!map.has(key)) return map;
      const next = new Map(map);
      next.delete(key);
      return next;
    });
    rec.requiredKeys.update(keys => {
      if (!keys.has(key)) return keys;
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
  }

  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: MdyAsyncValidatorOptions,
  ): void {
    const rec = this._getOrCreate(name);
    rec.asyncValidators.update(map => {
      const next = new Map(map);
      next.set(key, {
        fns: validators as ReadonlyArray<MdyAsyncValidatorFn<unknown>>,
        debounceMs: options?.debounceMs ?? 0,
        dependsOn: options?.dependsOn ?? [],
        timeoutMs: options?.timeoutMs ?? 0,
        when: options?.when ?? null,
      });
      return next;
    });
    this._ensureAsyncRunner(name, rec);
  }

  /**
   * Replaces the form-level (cross-field) validators. Each receives the whole
   * flat form value and returns errors attributed to field paths — or to the
   * form itself with `path: null`. Errors show up in the matching fields'
   * `errors()` and gate `state.valid`.
   */
  setFormValidators(
    validators: ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>,
  ): void {
    this._formValidators.set(validators);
  }

  setDisabled(name: string, disabled: MdySignal<boolean>): void {
    this._getOrCreate(name).disabled.set(disabled);
  }

  setReadonly(name: string, readonly: MdySignal<boolean>): void {
    this._getOrCreate(name).readonly.set(readonly);
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getField(name: string): MdyFieldRef<unknown> | null {
    const rec = this._getOrCreate(name);
    return () => rec.state;
  }

  getValue(): Record<string, unknown> {
    return Object.fromEntries(
      Array.from(this._fields.entries()).map(([n, r]) => [n, r.state.value()]),
    );
  }

  errorsFor(path: string): MdySignal<ReadonlyArray<MdyFormError>> {
    return this._rx.computed(() => {
      // Depend on the reactive name list so the computed re-evaluates when
      // the field is created after the first read.
      this._fieldNames();
      const fieldErrors = (this._fields.get(path)?.state.errors() ?? []).map(
        e => ({ ...e, path }),
      );
      // Path "" addresses the form itself: global server errors, cross-field
      // errors not attributed to a specific field, and server errors whose
      // path matches no registered field (they must surface somewhere
      // instead of being silently dropped).
      const globalErrors =
        path === ""
          ? [
            ...this._lastSubmitErrors().filter(
              e => e.path === null || !this._fields.has(e.path),
            ),
            ...this._crossErrors().filter(e => e.path === null),
          ]
          : [];
      return [...fieldErrors, ...globalErrors];
    });
  }

  markAllTouched(): void {
    this._fields.forEach(r => r.state.touched.set(true));
  }

  patchValue(partial: Partial<Record<string, unknown>>): void {
    for (const [key, val] of Object.entries(partial)) {
      const rec = this._getOrCreate(key);
      rec.state.value.set(val);
    }
  }

  setValue(value: Record<string, unknown>): void {
    // Replace semantics: fields absent from the new value are reset to null.
    for (const [key, val] of Object.entries(value)) {
      const rec = this._getOrCreate(key);
      rec.state.value.set(val);
    }
    this._fields.forEach((rec, name) => {
      if (!(name in value)) {
        rec.state.value.set(null);
      }
    });
  }

  reset(): void {
    this._fields.forEach((rec, name) => {
      // Only restore explicit initial values; a seed value is a prefill,
      // not a reset target. Fields without an explicit initial go to null.
      const iv = this._initialValues.has(name)
        ? this._initialValues.get(name)
        : null;
      rec.state.value.set(iv as unknown);
      rec.state.touched.set(false);
      rec.state.dirty.set(false);
    });
    this._lastSubmitErrors.set([]);
    this._submitSnapshot.set(null);
  }

  buildSubmitEvent(
    value: Record<string, unknown>,
  ): MdyFormSubmitEvent<Record<string, unknown>> {
    return {
      value,
      valid: this.state.valid(),
      errors: [...this._lastSubmitErrors()],
    };
  }

  async submit(
    action: (
      v: Record<string, unknown>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    if (!this.state.canSubmit()) {
      this.markAllTouched();
      return;
    }
    this._submitting.set(true);
    this._submitCount.update(n => n + 1);
    const value = this.getValue();
    try {
      const errors = (await action(value)) ?? [];
      // Server-returned errors are untrusted: an unsafe path (__proto__
      // and friends) is dropped instead of being stored and surfaced.
      const checked = errors.filter((e) => {
        if (e.path === null || isSafeFieldPath(e.path)) return true;
        this._report({
          kind: "error-path",
          path: e.path,
          detail: `Server error with unsafe path "${e.path}" dropped.`,
        });
        return false;
      });
      this._lastSubmitErrors.set(checked);
      this._submitSnapshot.set(checked.length > 0 ? value : null);
      if (checked.length === 0) this.clearDraft(); // successful submit: draft done
    } catch (e: unknown) {
      this._lastSubmitErrors.set([{
        path: null,
        kind: 'unknown',
        message: e instanceof Error ? e.message : String(e),
      }]);
      this._submitSnapshot.set(value);
    } finally {
      this._submitting.set(false);
    }
  }

  // ── Draft persistence ────────────────────────────────────────────────────────

  /**
   * Persists the form value under `key` on every (debounced) change and
   * restores an existing draft immediately. The draft is cleared
   * automatically after a submit that reports no errors, or manually via
   * {@link clearDraft}. `File` values are skipped (not serializable).
   */
  enableDraft(options: MdyDraftOptions): void {
    this._draftManager.enableDraft(options);
  }

  /** Removes the stored draft (also called after an error-free submit). */
  clearDraft(): void {
    this._draftManager.clearDraft();
  }

  // ── History (undo/redo) and change tracking ─────────────────────────────────

  /**
   * Starts recording value snapshots for {@link undo}/{@link redo}. Idempotent.
   */
  enableHistory(options?: {
    readonly maxEntries?: number;
    readonly debounceMs?: number;
  }): void {
    this._historyManager.enableHistory(options);
  }

  /** Restores the previous recorded form value (no-op when history is empty). */
  undo(): void {
    this._historyManager.undo();
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._historyManager.redo();
  }

  /**
   * Minimal patch of the form: only the fields whose current value differs
   * (Object.is) from their declared initial value — ready for an API PATCH.
   */
  getChanges(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, rec] of this._fields) {
      const initial = this._initialValues.has(name)
        ? this._initialValues.get(name)
        : null;
      const current = rec.state.value();
      if (!Object.is(initial, current)) out[name] = current;
    }
    return out;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  private _destroyed = false;

  /** True once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Releases every resource the engine owns: async validator runners, the
   * draft and history effects, all pending timers, field records and the
   * undo/redo stacks. Idempotent. After destruction the engine is inert —
   * effect-driven features cannot be re-enabled and in-flight async results
   * are discarded. Bindings must call this when their host scope goes away
   * (component unmount, effect-scope dispose, element disconnect).
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._fields.forEach(rec => {
      rec.asyncRunner?.destroy();
      rec.asyncRunner = null;
      // Bumping the run id makes any in-flight promise resolve as stale.
      rec.asyncRunId++;
    });
    this._draftManager.destroy();
    this._historyManager.destroy();
    this._fields.clear();
    this._claims.clear();
    this._initialValues.clear();
    this._rx.untracked(() => {
      this._fieldNames.set([]);
    });
    // Backstop: any effect registered with the scope (draft/history/async
    // validators, and anything a future migrated adapter attaches to it)
    // is torn down here even if its own manager's destroy() above didn't
    // run for some reason. Idempotent — the individual destroy() calls
    // above already covered the documented paths.
    this._scope?.destroy();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _getOrCreate(name: string): FieldRecord {
    if (!isSafeFieldPath(name)) {
      throw new Error(
        `[modyra] Invalid field path "${name}": reserved or empty path segments are not allowed.`,
      );
    }
    if (MDY_DEV && this._destroyed) {
      this._warn(
        `Field "${name}" requested on a destroyed form engine — the record ` +
        "is created detached and no validation effects will run.",
      );
    }
    let rec = this._fields.get(name);
    if (!rec) {
      rec = this._createFieldRecord(name);
      this._fields.set(name, rec);
      this._rx.untracked(() =>
        this._fieldNames.update(names => [...names, name]),
      );
    }
    return rec;
  }

  private _createFieldRecord(name: string): FieldRecord {
    // Untracked so no reactive dependency on the seed value is created when
    // called from inside a computed. has() (not ??) so an explicit initial
    // value of null wins over the seed.
    const initialValue = this._initialValues.has(name)
      ? this._initialValues.get(name)
      : this._rx.untracked(() => this._formValue())?.[name] ?? null;

    return createFieldRecord(
      this._rx,
      this._applySecurity(name, initialValue),
      (v) => [...this._crossErrorsFor(name), ...this._serverErrorsFor(name, v)],
      (v) => this._applySecurity(name, v),
    );
  }

  // ── Security (see security.ts) ─────────────────────────────────────────────

  /**
   * The single choke point every field write passes through (the field
   * record wraps its value signal with this). Resolution order: per-field
   * override → form policy → "off".
   */
  private _applySecurity(name: string, value: unknown): unknown {
    const sanitizer = this._fieldSanitizers.get(name) ??
      this._security.sanitize ?? "off";
    const maxValueLength = this._security.maxValueLength;
    if (sanitizer === "off" && maxValueLength === undefined) return value;
    const { value: next, actions } = applyValueSecurity(value, {
      sanitizer,
      maxValueLength,
    });
    for (const action of actions) {
      this._report({ kind: action.kind, path: name, detail: action.detail });
    }
    return next;
  }

  /**
   * Always-on draft restore check: entries whose shape cannot have been
   * produced by the declared field are dropped (type confusion via a
   * tampered localStorage draft). Fields without a registered initial
   * (raw-engine usage, where drafts legitimately create fields) restore
   * as-is.
   */
  private _draftEntryAllowed(key: string, value: unknown): boolean {
    if (!this._initialValues.has(key)) return true;
    if (draftShapeMatches(this._initialValues.get(key), value)) return true;
    this._report({
      kind: "draft-shape",
      path: key,
      detail:
        `Draft entry "${key}" dropped: stored value shape does not match ` +
        "the field's declared type.",
    });
    return false;
  }

  private _report(violation: MdySecurityViolation): void {
    try {
      this._security.onViolation?.(violation);
    } catch (e: unknown) {
      if (MDY_DEV) {
        this._warn(
          `onViolation hook threw: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  /** Cross-field errors attributed to the named field. */
  private _crossErrorsFor(name: string): ReadonlyArray<MdyFieldError> {
    const errors = this._crossErrors();
    if (errors.length === 0) return [];
    return errors
      .filter(e => e.path === name)
      .map(e => ({ kind: e.kind, message: e.message, payload: e.payload }));
  }

  /**
   * Server errors from the last submit, shown only while the field value
   * still equals the value that was submitted.
   */
  private _serverErrorsFor(
    name: string,
    currentValue: unknown,
  ): ReadonlyArray<MdyFieldError> {
    const snapshot = this._submitSnapshot();
    if (!snapshot || !(name in snapshot) || !Object.is(snapshot[name], currentValue)) {
      return [];
    }
    return this._lastSubmitErrors()
      .filter(e => e.path === name)
      .map(e => ({ kind: e.kind, message: e.message, payload: e.payload }));
  }

  /** Lazily creates the effect that runs async validators for a field. */
  private _ensureAsyncRunner(name: string, rec: FieldRecord): void {
    if (this._destroyed || rec.asyncRunner) return;
    if (!this._rx.canEffect) {
      if (MDY_DEV) this._warn(
        `Async validators for "${name}" need an effect-capable reactivity ` +
        `(with the Angular adapter: construct it with an Injector).`,
      );
      return;
    }
    rec.asyncRunner = createAsyncRunner(
      rec,
      this._rx,
      {
        fieldPath: name,
        formValue: () => this.getValue(),
        fieldState: (p) => this._fields.get(p)?.state ?? null,
      },
      this._scope,
    );
  }
}
