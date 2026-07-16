let _legacyValidatorKey = 0;
function isDraftEnvelope(parsed) {
    return (typeof parsed === "object" &&
        parsed !== null &&
        typeof parsed.__mdyDraft === "number" &&
        typeof parsed.value === "object");
}
/**
 * Default browser storage — inert when `localStorage` is unavailable or
 * blocked (SSR, Node, sandboxed iframes, browsers that throw SecurityError
 * on access when cookies/site data are disabled).
 */
function localStorageDraftStorage() {
    let available = false;
    try {
        available = typeof localStorage !== "undefined" && localStorage !== null;
    }
    catch {
        // Accessing `localStorage` itself throws in restrictive modes.
    }
    return {
        read: (key) => {
            if (!available)
                return null;
            try {
                return localStorage.getItem(key);
            }
            catch {
                return null;
            }
        },
        write: (key, value) => {
            if (available)
                localStorage.setItem(key, value);
        },
        remove: (key) => {
            if (!available)
                return;
            try {
                localStorage.removeItem(key);
            }
            catch {
                // Ignore: nothing to clean up if the storage is unreachable.
            }
        },
    };
}
/** True when the value is (or contains) a File — not draft-serializable. */
function containsFile(value) {
    if (typeof File === "undefined" || value === null)
        return false;
    if (value instanceof File)
        return true;
    if (Array.isArray(value))
        return value.some(containsFile);
    return false;
}
/** Shallow key/value equality between two flat form-value records. */
function shallowEqualRecords(a, b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length)
        return false;
    return aKeys.every(k => Object.is(a[k], b[k]));
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
export class MdyFormEngine {
    _rx;
    _formValue;
    _submitMode;
    _fields = new Map();
    /** Reactive list of field names — drives state.valid computation. */
    _fieldNames;
    _initialValues = new Map();
    /** Reference count of controls claiming each field name. */
    _claims = new Map();
    /** Form-level (cross-field) validators. */
    _formValidators;
    /** Errors produced by the form-level validators on the current value. */
    _crossErrors;
    _submitting;
    _submitCount;
    _lastSubmitErrors;
    /**
     * Form value captured at the moment the last submit reported errors.
     * A field shows its server errors only while its value still matches the
     * snapshot — editing the field clears them.
     */
    _submitSnapshot;
    _devWarnings;
    state;
    /** Reactive signal emitting the current form value on every field change. */
    value;
    /** Reactive list of the registered field names (flat, dotted for groups). */
    fieldNames;
    constructor(_rx, _formValue = () => undefined, _submitMode = () => "valid-only", options) {
        this._rx = _rx;
        this._formValue = _formValue;
        this._submitMode = _submitMode;
        this._devWarnings = options?.devWarnings ?? true;
        this._fieldNames = _rx.signal([]);
        this.fieldNames = this._fieldNames.asReadonly();
        this._formValidators = _rx.signal([]);
        this._submitting = _rx.signal(false);
        this._submitCount = _rx.signal(0);
        this._lastSubmitErrors = _rx.signal([]);
        this._submitSnapshot = _rx.signal(null);
        this._hasDraft = _rx.signal(false);
        this._canUndo = _rx.signal(false);
        this._canRedo = _rx.signal(false);
        this.hasDraft = this._hasDraft.asReadonly();
        this.canUndo = this._canUndo.asReadonly();
        this.canRedo = this._canRedo.asReadonly();
        this.value = _rx.computed(() => Object.fromEntries(this._fieldNames().map(n => [n, this._fields.get(n)?.state.value() ?? null])));
        this._crossErrors = _rx.computed(() => {
            const fns = this._formValidators();
            if (fns.length === 0)
                return [];
            const value = this.value();
            return fns.flatMap(fn => fn(value));
        });
        const valid = _rx.computed(() => this._fieldNames().every(n => this._fields.get(n)?.state.valid() ?? true) && this._crossErrors().length === 0);
        const pending = _rx.computed(() => this._fieldNames().some(n => this._fields.get(n)?.state.pending() ?? false));
        this.state = {
            valid,
            pending,
            submitting: this._submitting,
            submitCount: this._submitCount,
            canSubmit: _rx.computed(() => {
                if (this._submitting())
                    return false;
                const mode = this._submitMode();
                if (mode === "valid-only")
                    return valid() && !pending();
                if (mode === "always")
                    return true;
                return false; // manual
            }),
            lastSubmitErrors: this._lastSubmitErrors,
        };
    }
    _warn(message) {
        if (this._devWarnings) {
            console.warn(`[modyra] ${message}`);
        }
    }
    // ── MdyFormRegistry ─────────────────────────────────────────────────────────
    claimField(name) {
        const count = (this._claims.get(name) ?? 0) + 1;
        this._claims.set(name, count);
        this._getOrCreate(name);
        if (count > 1) {
            this._warn(`Duplicate control name "${name}": ${count} controls now share the same field state.`);
        }
    }
    /**
     * Releases one claim on the field. The record (value, validators, flags)
     * is destroyed only when no claiming control remains.
     */
    removeField(name) {
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
            this._rx.untracked(() => this._fieldNames.update(names => names.filter(n => n !== name)));
            this._initialValues.delete(name);
        }
    }
    setInitialValue(name, value) {
        this._initialValues.set(name, value);
        const rec = this._fields.get(name);
        if (rec) {
            rec.state.value.set(value);
        }
    }
    addValidators(name, validators, isRequired = false) {
        this.upsertValidators(name, `__legacy_${_legacyValidatorKey++}`, validators, isRequired);
    }
    upsertValidators(name, key, validators, marksRequired = false) {
        const rec = this._getOrCreate(name);
        // Cast from ValidatorFn<T> to ValidatorFn<unknown> at the storage boundary.
        // Safe: the field value is always of type T at runtime (validator and field
        // are wired together by the field name).
        rec.validators.update(map => {
            const next = new Map(map);
            next.set(key, validators);
            return next;
        });
        rec.requiredKeys.update(keys => {
            if (marksRequired === keys.has(key))
                return keys;
            const next = new Set(keys);
            if (marksRequired)
                next.add(key);
            else
                next.delete(key);
            return next;
        });
    }
    removeValidators(name, key) {
        const rec = this._fields.get(name);
        if (!rec)
            return;
        rec.validators.update(map => {
            if (!map.has(key))
                return map;
            const next = new Map(map);
            next.delete(key);
            return next;
        });
        rec.asyncValidators.update(map => {
            if (!map.has(key))
                return map;
            const next = new Map(map);
            next.delete(key);
            return next;
        });
        rec.requiredKeys.update(keys => {
            if (!keys.has(key))
                return keys;
            const next = new Set(keys);
            next.delete(key);
            return next;
        });
    }
    upsertAsyncValidators(name, key, validators, options) {
        const rec = this._getOrCreate(name);
        rec.asyncValidators.update(map => {
            const next = new Map(map);
            next.set(key, {
                fns: validators,
                debounceMs: options?.debounceMs ?? 0,
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
    setFormValidators(validators) {
        this._formValidators.set(validators);
    }
    setDisabled(name, disabled) {
        this._getOrCreate(name).disabled.set(disabled);
    }
    setReadonly(name, readonly) {
        this._getOrCreate(name).readonly.set(readonly);
    }
    // ── MdyFormAdapter ──────────────────────────────────────────────────────────
    getField(name) {
        const rec = this._getOrCreate(name);
        return () => rec.state;
    }
    getValue() {
        return Object.fromEntries(Array.from(this._fields.entries()).map(([n, r]) => [n, r.state.value()]));
    }
    errorsFor(path) {
        return this._rx.computed(() => {
            // Depend on the reactive name list so the computed re-evaluates when
            // the field is created after the first read.
            this._fieldNames();
            const fieldErrors = (this._fields.get(path)?.state.errors() ?? []).map(e => ({ ...e, path }));
            // Path "" addresses the form itself: global server errors, cross-field
            // errors not attributed to a specific field, and server errors whose
            // path matches no registered field (they must surface somewhere
            // instead of being silently dropped).
            const globalErrors = path === ""
                ? [
                    ...this._lastSubmitErrors().filter(e => e.path === null || !this._fields.has(e.path)),
                    ...this._crossErrors().filter(e => e.path === null),
                ]
                : [];
            return [...fieldErrors, ...globalErrors];
        });
    }
    markAllTouched() {
        this._fields.forEach(r => r.state.touched.set(true));
    }
    patchValue(partial) {
        for (const [key, val] of Object.entries(partial)) {
            const rec = this._getOrCreate(key);
            rec.state.value.set(val);
        }
    }
    setValue(value) {
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
    reset() {
        this._fields.forEach((rec, name) => {
            // Only restore explicit initial values; a seed value is a prefill,
            // not a reset target. Fields without an explicit initial go to null.
            const iv = this._initialValues.has(name)
                ? this._initialValues.get(name)
                : null;
            rec.state.value.set(iv);
            rec.state.touched.set(false);
            rec.state.dirty.set(false);
        });
        this._lastSubmitErrors.set([]);
        this._submitSnapshot.set(null);
    }
    buildSubmitEvent(value) {
        return {
            value,
            valid: this.state.valid(),
            errors: [...this._lastSubmitErrors()],
        };
    }
    async submit(action) {
        if (!this.state.canSubmit()) {
            this.markAllTouched();
            return;
        }
        this._submitting.set(true);
        this._submitCount.update(n => n + 1);
        const value = this.getValue();
        try {
            const errors = (await action(value)) ?? [];
            this._lastSubmitErrors.set(errors);
            this._submitSnapshot.set(errors.length > 0 ? value : null);
            if (errors.length === 0)
                this.clearDraft(); // successful submit: draft done
        }
        catch (e) {
            this._lastSubmitErrors.set([{
                    path: null,
                    kind: 'unknown',
                    message: e instanceof Error ? e.message : String(e),
                }]);
            this._submitSnapshot.set(value);
        }
        finally {
            this._submitting.set(false);
        }
    }
    // ── Draft persistence ────────────────────────────────────────────────────────
    _draftKey = null;
    _draftStorage = null;
    _draftEffect = null;
    _draftTimer = null;
    _draftExclude = new Set();
    _draftVersion = 1;
    /** Serialized value at enable time — a pristine form writes no draft. */
    _draftBaseline = null;
    _draftLastWritten = null;
    _hasDraft;
    /** True when a stored draft was found and restored by {@link enableDraft}. */
    hasDraft;
    /**
     * Persists the form value under `key` on every (debounced) change and
     * restores an existing draft immediately. The draft is cleared
     * automatically after a submit that reports no errors, or manually via
     * {@link clearDraft}. `File` values are skipped (not serializable).
     */
    enableDraft(options) {
        if (this._draftEffect)
            return;
        if (!this._rx.canEffect) {
            this._warn("enableDraft() needs an effect-capable reactivity " +
                "(with the Angular adapter: construct it with an Injector).");
            return;
        }
        this._draftKey = options.key;
        this._draftStorage = options.storage ?? localStorageDraftStorage();
        this._draftExclude = new Set(options.exclude ?? []);
        this._draftVersion = options.version ?? 1;
        const debounceMs = options.debounceMs ?? 400;
        // Restore an existing draft before recording starts.
        const stored = this._draftStorage.read(this._draftKey);
        if (stored !== null) {
            const value = this._parseDraft(stored, options.ttlMs);
            if (value !== null) {
                this.patchValue(Object.fromEntries(Object.entries(value).filter(([k]) => !this._draftExclude.has(k))));
                this._hasDraft.set(true);
                this._draftLastWritten = this._serializeDraft(value);
            }
            else {
                this._draftStorage.remove(this._draftKey);
            }
        }
        this._draftBaseline = this._serializeDraft(this._rx.untracked(() => this.value()));
        this._draftEffect = this._rx.effect((onCleanup) => {
            const current = this.value();
            this._rx.untracked(() => {
                if (this._draftTimer !== null)
                    clearTimeout(this._draftTimer);
                this._draftTimer = setTimeout(() => {
                    this._draftTimer = null;
                    this._writeDraft(current);
                }, debounceMs);
            });
            onCleanup(() => {
                if (this._draftTimer !== null) {
                    clearTimeout(this._draftTimer);
                    this._draftTimer = null;
                }
            });
        });
    }
    /** Removes the stored draft (also called after an error-free submit). */
    clearDraft() {
        if (this._draftKey && this._draftStorage) {
            this._draftStorage.remove(this._draftKey);
        }
        this._hasDraft.set(false);
        this._draftLastWritten = null;
        // The current (submitted) value becomes the new baseline.
        this._draftBaseline = this._serializeDraft(this._rx.untracked(() => this.value()));
    }
    /**
     * Parses a stored draft, returning its value or `null` when it must be
     * discarded (corrupt JSON, version mismatch, expired TTL). Envelope-less
     * payloads written by pre-versioning releases are still accepted.
     */
    _parseDraft(stored, ttlMs) {
        try {
            const parsed = JSON.parse(stored);
            if (isDraftEnvelope(parsed)) {
                if (parsed.__mdyDraft !== this._draftVersion)
                    return null;
                if (ttlMs !== undefined && Date.now() - parsed.savedAt > ttlMs) {
                    return null;
                }
                return parsed.value;
            }
            if (typeof parsed === "object" && parsed !== null) {
                return parsed; // legacy plain draft
            }
            return null;
        }
        catch {
            return null;
        }
    }
    _serializeDraft(value) {
        const serializable = Object.fromEntries(Object.entries(value).filter(([k, v]) => !this._draftExclude.has(k) && !containsFile(v)));
        return JSON.stringify(serializable);
    }
    _writeDraft(value) {
        if (!this._draftKey || !this._draftStorage)
            return;
        const serialized = this._serializeDraft(value);
        // Nothing the user changed → no draft; unchanged → no rewrite.
        if (serialized === this._draftLastWritten)
            return;
        if (this._draftLastWritten === null && serialized === this._draftBaseline) {
            return;
        }
        const envelope = {
            __mdyDraft: this._draftVersion,
            savedAt: Date.now(),
            value: JSON.parse(serialized),
        };
        try {
            this._draftStorage.write(this._draftKey, JSON.stringify(envelope));
            this._draftLastWritten = serialized;
        }
        catch {
            // Quota errors and private-mode restrictions must not break the form.
        }
    }
    // ── History (undo/redo) and change tracking ─────────────────────────────────
    _undoStack = [];
    _redoStack = [];
    _lastSnapshot = null;
    _historyEffect = null;
    _historyTimer = null;
    _canUndo;
    _canRedo;
    /** True when {@link undo} has state to restore (see {@link enableHistory}). */
    canUndo;
    /** True when {@link redo} has state to restore. */
    canRedo;
    /**
     * Starts recording value snapshots for {@link undo}/{@link redo}. Idempotent.
     *
     * `debounceMs` batches rapid changes (e.g. keystrokes) into a single
     * history entry — without it every value change becomes an undo step.
     * Only the form **value** is recorded: touched/dirty flags, server errors
     * and validation state are not restored by undo/redo.
     */
    enableHistory(options) {
        if (this._historyEffect)
            return;
        if (!this._rx.canEffect) {
            this._warn("enableHistory() needs an effect-capable reactivity " +
                "(with the Angular adapter: construct it with an Injector).");
            return;
        }
        const max = options?.maxEntries ?? 100;
        const debounceMs = options?.debounceMs ?? 0;
        const record = (current) => {
            const last = this._lastSnapshot;
            if (last !== null && shallowEqualRecords(last, current))
                return;
            if (last !== null) {
                this._undoStack.push(last);
                if (this._undoStack.length > max)
                    this._undoStack.shift();
                this._redoStack.length = 0;
                this._canUndo.set(true);
                this._canRedo.set(false);
            }
            this._lastSnapshot = current;
        };
        this._historyEffect = this._rx.effect((onCleanup) => {
            const current = this.value();
            this._rx.untracked(() => {
                if (debounceMs <= 0) {
                    record(current);
                    return;
                }
                // First value seeds the snapshot immediately so the pre-typing
                // state is undoable; later changes are batched.
                if (this._lastSnapshot === null) {
                    record(current);
                    return;
                }
                if (this._historyTimer !== null)
                    clearTimeout(this._historyTimer);
                this._historyTimer = setTimeout(() => {
                    this._historyTimer = null;
                    record(current);
                }, debounceMs);
            });
            onCleanup(() => {
                if (this._historyTimer !== null) {
                    clearTimeout(this._historyTimer);
                    this._historyTimer = null;
                }
            });
        });
    }
    /**
     * Flushes a pending debounced snapshot so undo/redo act on the latest
     * value instead of the last recorded batch.
     */
    _flushHistory() {
        if (this._historyTimer === null)
            return;
        clearTimeout(this._historyTimer);
        this._historyTimer = null;
        const current = this._rx.untracked(() => this.value());
        const last = this._lastSnapshot;
        if (last !== null && !shallowEqualRecords(last, current)) {
            this._undoStack.push(last);
            this._redoStack.length = 0;
        }
        this._lastSnapshot = current;
    }
    /** Restores the previous recorded form value (no-op when history is empty). */
    undo() {
        this._flushHistory();
        const prev = this._undoStack.pop();
        if (!prev)
            return;
        const current = this._rx.untracked(() => this.value());
        this._redoStack.push(current);
        // Pre-setting the snapshot makes the history effect treat the restored
        // value as already recorded instead of pushing it again.
        this._lastSnapshot = prev;
        this.setValue(prev);
        this._canUndo.set(this._undoStack.length > 0);
        this._canRedo.set(true);
    }
    /** Re-applies the value undone by the last {@link undo}. */
    redo() {
        this._flushHistory();
        const next = this._redoStack.pop();
        if (!next)
            return;
        const current = this._rx.untracked(() => this.value());
        this._undoStack.push(current);
        this._lastSnapshot = next;
        this.setValue(next);
        this._canRedo.set(this._redoStack.length > 0);
        this._canUndo.set(true);
    }
    /**
     * Minimal patch of the form: only the fields whose current value differs
     * (Object.is) from their declared initial value — ready for an API PATCH.
     */
    getChanges() {
        const out = {};
        for (const [name, rec] of this._fields) {
            const initial = this._initialValues.has(name)
                ? this._initialValues.get(name)
                : null;
            const current = rec.state.value();
            if (!Object.is(initial, current))
                out[name] = current;
        }
        return out;
    }
    // ── Private helpers ─────────────────────────────────────────────────────────
    _getOrCreate(name) {
        let rec = this._fields.get(name);
        if (!rec) {
            rec = this._createFieldRecord(name);
            this._fields.set(name, rec);
            this._rx.untracked(() => this._fieldNames.update(names => [...names, name]));
        }
        return rec;
    }
    _createFieldRecord(name) {
        const rx = this._rx;
        // Untracked so no reactive dependency on the seed value is created when
        // called from inside a computed. has() (not ??) so an explicit initial
        // value of null wins over the seed.
        const initialValue = this._initialValues.has(name)
            ? this._initialValues.get(name)
            : rx.untracked(() => this._formValue())?.[name] ?? null;
        const value = rx.signal(initialValue);
        const touched = rx.signal(false);
        const dirty = rx.signal(false);
        const requiredKeys = rx.signal(new Set());
        // Dynamic signals provided by bindings, defaulting to false.
        const disabledSignal = rx.signal(() => false);
        const readonlySignal = rx.signal(() => false);
        const validators = rx.signal(new Map());
        const asyncValidators = rx.signal(new Map());
        const asyncErrors = rx.signal([]);
        const pending = rx.signal(false);
        const errors = rx.computed(() => {
            const v = value();
            const syncErrors = Array.from(validators().values()).flatMap(fns => fns.flatMap(fn => fn(v).map(message => ({ kind: "validation", message }))));
            return [
                ...syncErrors,
                ...asyncErrors(),
                ...this._crossErrorsFor(name),
                ...this._serverErrorsFor(name, v),
            ];
        });
        const state = {
            value,
            touched,
            dirty,
            required: rx.computed(() => requiredKeys().size > 0),
            valid: rx.computed(() => errors().length === 0),
            errors,
            disabled: rx.computed(() => disabledSignal()()),
            readonly: rx.computed(() => readonlySignal()()),
            pending: pending.asReadonly(),
        };
        return {
            state,
            validators,
            asyncValidators,
            asyncErrors,
            pending,
            requiredKeys,
            disabled: disabledSignal,
            readonly: readonlySignal,
            asyncRunId: 0,
            asyncRunner: null,
        };
    }
    /** Cross-field errors attributed to the named field. */
    _crossErrorsFor(name) {
        const errors = this._crossErrors();
        if (errors.length === 0)
            return [];
        return errors
            .filter(e => e.path === name)
            .map(e => ({ kind: e.kind, message: e.message, payload: e.payload }));
    }
    /**
     * Server errors from the last submit, shown only while the field value
     * still equals the value that was submitted.
     */
    _serverErrorsFor(name, currentValue) {
        const snapshot = this._submitSnapshot();
        if (!snapshot || !(name in snapshot) || !Object.is(snapshot[name], currentValue)) {
            return [];
        }
        return this._lastSubmitErrors()
            .filter(e => e.path === name)
            .map(e => ({ kind: e.kind, message: e.message, payload: e.payload }));
    }
    /** Lazily creates the effect that runs async validators for a field. */
    _ensureAsyncRunner(name, rec) {
        if (rec.asyncRunner)
            return;
        if (!this._rx.canEffect) {
            this._warn(`Async validators for "${name}" need an effect-capable reactivity ` +
                `(with the Angular adapter: construct it with an Injector).`);
            return;
        }
        rec.asyncRunner = this._rx.effect((onCleanup) => {
            const v = rec.state.value();
            const entries = Array.from(rec.asyncValidators().values());
            const fns = entries.flatMap(e => e.fns);
            const runId = ++rec.asyncRunId;
            if (fns.length === 0) {
                this._rx.untracked(() => {
                    rec.pending.set(false);
                    rec.asyncErrors.set([]);
                });
                return;
            }
            // Pending covers the whole debounce+run window, so canSubmit stays
            // false while a check is outstanding.
            this._rx.untracked(() => rec.pending.set(true));
            const run = () => {
                void Promise.all(fns.map(fn => fn(v)))
                    .then(results => {
                    if (runId !== rec.asyncRunId)
                        return; // stale run: last-wins
                    rec.asyncErrors.set(results
                        .flat()
                        .map(message => ({ kind: "async", message })));
                    rec.pending.set(false);
                })
                    .catch((e) => {
                    if (runId !== rec.asyncRunId)
                        return;
                    rec.asyncErrors.set([{
                            kind: "async",
                            message: e instanceof Error ? e.message : String(e),
                        }]);
                    rec.pending.set(false);
                });
            };
            const debounceMs = entries.reduce((max, e) => Math.max(max, e.debounceMs), 0);
            if (debounceMs > 0) {
                const timer = setTimeout(run, debounceMs);
                onCleanup(() => clearTimeout(timer));
            }
            else {
                run();
            }
        });
    }
}
