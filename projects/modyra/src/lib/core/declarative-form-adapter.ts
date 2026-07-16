import {
  computed,
  effect,
  EffectRef,
  Injector,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from "@angular/core";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyFieldError,
  MdyFieldRef,
  MdyFieldState,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySubmitMode,
  ValidatorFn,
} from "./types";

declare const ngDevMode: boolean | undefined;

// ─── Registry interface ───────────────────────────────────────────────────────

export interface MdyDeclarativeRegistry {
  /**
   * Registers type-specific validators for a named field.
   * The generic parameter `T` lets directive call sites pass typed validators
   * without casting. The adapter stores them as `ValidatorFn<unknown>` internally
   * (safe because the field value will always be of the correct type at runtime).
   *
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

// ─── Internal field record ────────────────────────────────────────────────────

interface AsyncValidatorEntry {
  readonly fns: ReadonlyArray<MdyAsyncValidatorFn<unknown>>;
  readonly debounceMs: number;
}

interface DeclarativeFieldRecord {
  readonly state: MdyFieldState<unknown>;
  /** Sync validators keyed by owner (directive instance / legacy counter). */
  readonly validators: WritableSignal<
    ReadonlyMap<string, ReadonlyArray<ValidatorFn<unknown>>>
  >;
  /** Async validators keyed by owner. */
  readonly asyncValidators: WritableSignal<
    ReadonlyMap<string, AsyncValidatorEntry>
  >;
  readonly asyncErrors: WritableSignal<ReadonlyArray<MdyFieldError>>;
  readonly pending: WritableSignal<boolean>;
  /** Keys whose validator sets mark the field as required. */
  readonly requiredKeys: WritableSignal<ReadonlySet<string>>;
  readonly disabled: WritableSignal<Signal<boolean>>;
  readonly readonly: WritableSignal<Signal<boolean>>;
  asyncRunId: number;
  asyncRunner: EffectRef | null;
}

let _legacyValidatorKey = 0;

// ─── Draft persistence types ──────────────────────────────────────────────────

/** Pluggable storage for {@link MdyDeclarativeAdapter.enableDraft}. */
export interface MdyDraftStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export interface MdyDraftOptions {
  /** Storage key the draft is persisted under. */
  readonly key: string;
  /** Defaults to `localStorage` (no-op on SSR). */
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

/** Envelope every draft is stored in (adds expiry + versioning metadata). */
interface DraftEnvelope {
  readonly __mdyDraft: number;
  readonly savedAt: number;
  readonly value: Record<string, unknown>;
}

function isDraftEnvelope(parsed: unknown): parsed is DraftEnvelope {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as DraftEnvelope).__mdyDraft === "number" &&
    typeof (parsed as DraftEnvelope).value === "object"
  );
}

/**
 * Default browser storage — inert when `localStorage` is unavailable or
 * blocked (SSR, sandboxed iframes, browsers that throw SecurityError on
 * access when cookies/site data are disabled).
 */
function localStorageDraftStorage(): MdyDraftStorage {
  let available = false;
  try {
    available = typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    // Accessing `localStorage` itself throws in restrictive modes.
  }
  return {
    read: (key) => {
      if (!available) return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      if (available) localStorage.setItem(key, value);
    },
    remove: (key) => {
      if (!available) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore: nothing to clean up if the storage is unreachable.
      }
    },
  };
}

/** True when the value is (or contains) a File — not draft-serializable. */
function containsFile(value: unknown): boolean {
  if (typeof File === "undefined" || value === null) return false;
  if (value instanceof File) return true;
  if (Array.isArray(value)) return value.some(containsFile);
  return false;
}

/** Shallow key/value equality between two flat form-value records. */
function shallowEqualRecords(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => Object.is(a[k], b[k]));
}

// ─── Declarative Adapter ──────────────────────────────────────────────────────

/**
 * Adapter used when <mdy-form> is used without an explicit [adapter] input.
 *
 * Fields are created lazily on first getField() call.
 * Validators are registered by directive instructions and update the
 * reactive `validators` signal, so `errors` recomputes automatically.
 */
export class MdyDeclarativeAdapter
  implements MdyFormAdapter<Record<string, unknown>>, MdyDeclarativeRegistry {
  private readonly _fields = new Map<string, DeclarativeFieldRecord>();
  /** Reactive list of field names — drives state.valid computation. */
  private readonly _fieldNames = signal<readonly string[]>([]);
  private readonly _initialValues = new Map<string, unknown>();
  /** Reference count of controls claiming each field name (B9). */
  private readonly _claims = new Map<string, number>();

  /** Form-level (cross-field) validators. */
  private readonly _formValidators = signal<
    ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>
  >([]);
  /** Errors produced by the form-level validators on the current value. */
  private readonly _crossErrors: Signal<ReadonlyArray<MdyFormError>>;

  private readonly _submitting = signal(false);
  private readonly _submitCount = signal(0);
  private readonly _lastSubmitErrors = signal<ReadonlyArray<MdyFormError>>([]);
  /**
   * Form value captured at the moment the last submit reported errors.
   * A field shows its server errors only while its value still matches the
   * snapshot — editing the field clears them (B6).
   */
  private readonly _submitSnapshot = signal<Record<string, unknown> | null>(
    null,
  );

  readonly state: MdyFormState;

  /** Reactive signal emitting the current form value on every field change. */
  readonly value: Signal<Record<string, unknown>>;

  /** Reactive list of the registered field names (flat, dotted for groups). */
  readonly fieldNames: Signal<readonly string[]> = this._fieldNames.asReadonly();

  constructor(
    private readonly _formValue: Signal<Record<string, unknown> | undefined>,
    private readonly _submitMode: Signal<MdySubmitMode> = signal("valid-only"),
    /** Needed to run async validators; omit if you only use sync validation. */
    private readonly _injector?: Injector,
  ) {
    this.value = computed(() =>
      Object.fromEntries(
        this._fieldNames().map(n => [n, this._fields.get(n)?.state.value() ?? null]),
      ),
    );
    this._crossErrors = computed(() => {
      const fns = this._formValidators();
      if (fns.length === 0) return [];
      const value = this.value();
      return fns.flatMap(fn => fn(value));
    });
    const valid = computed(
      () =>
        this._fieldNames().every(
          n => this._fields.get(n)?.state.valid() ?? true,
        ) && this._crossErrors().length === 0,
    );
    const pending = computed(() =>
      this._fieldNames().some(n => this._fields.get(n)?.state.pending() ?? false),
    );
    this.state = {
      valid,
      pending,
      submitting: this._submitting,
      submitCount: this._submitCount,
      canSubmit: computed(() => {
        if (this._submitting()) return false;
        const mode = this._submitMode();
        if (mode === "valid-only") return valid() && !pending();
        if (mode === "always") return true;
        return false; // manual
      }),
      lastSubmitErrors: this._lastSubmitErrors,
    };
  }

  // ── MdyDeclarativeRegistry ──────────────────────────────────────────────────

  claimField(name: string): void {
    const count = (this._claims.get(name) ?? 0) + 1;
    this._claims.set(name, count);
    this._getOrCreate(name);
    if (count > 1 && typeof ngDevMode !== "undefined" && ngDevMode) {
      console.warn(
        `[modyra] Duplicate control name "${name}": ${count} controls now share the same field state.`,
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
      untracked(() => this._fieldNames.update(names => names.filter(n => n !== name)));
      this._initialValues.delete(name);
    }
  }

  setInitialValue(name: string, value: unknown): void {
    this._initialValues.set(name, value);
    // Update existing field value if already created
    const rec = this._fields.get(name);
    if (rec) {
      (rec.state.value as WritableSignal<unknown>).set(value);
    }
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
    // Safe: the field value is always of type T at runtime (the directive and field
    // are wired together by the `name` attribute). TypeScript cannot verify this
    // without contravariant widening support, so we cast once here.
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

  setDisabled(name: string, disabled: Signal<boolean>): void {
    this._getOrCreate(name).disabled.set(disabled);
  }

  setReadonly(name: string, readonly: Signal<boolean>): void {
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

  errorsFor(path: string): Signal<ReadonlyArray<MdyFormError>> {
    return computed(() => {
      // Depend on the reactive name list so the computed re-evaluates when
      // the field is created after the first read (B3).
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
    this._fields.forEach(r => (r.state.touched as WritableSignal<boolean>).set(true));
  }

  patchValue(partial: Partial<Record<string, unknown>>): void {
    for (const [key, val] of Object.entries(partial)) {
      const rec = this._getOrCreate(key);
      (rec.state.value as WritableSignal<unknown>).set(val);
    }
  }

  setValue(value: Record<string, unknown>): void {
    // Replace semantics: fields absent from the new value are reset to null (B4).
    for (const [key, val] of Object.entries(value)) {
      const rec = this._getOrCreate(key);
      (rec.state.value as WritableSignal<unknown>).set(val);
    }
    this._fields.forEach((rec, name) => {
      if (!(name in value)) {
        (rec.state.value as WritableSignal<unknown>).set(null);
      }
    });
  }

  reset(): void {
    this._fields.forEach((rec, name) => {
      // Only restore explicit per-control [initialValue]; [formValue] is a prefill seed,
      // not a reset target. Fields without an explicit initialValue go back to null.
      const iv = this._initialValues.has(name)
        ? this._initialValues.get(name)
        : null;
      (rec.state.value as WritableSignal<unknown>).set(iv as unknown);
      (rec.state.touched as WritableSignal<boolean>).set(false);
      (rec.state.dirty as WritableSignal<boolean>).set(false);
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
      this._lastSubmitErrors.set(errors);
      this._submitSnapshot.set(errors.length > 0 ? value : null);
      if (errors.length === 0) this.clearDraft(); // successful submit: draft done
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

  private _draftKey: string | null = null;
  private _draftStorage: MdyDraftStorage | null = null;
  private _draftEffect: EffectRef | null = null;
  private _draftTimer: ReturnType<typeof setTimeout> | null = null;
  private _draftExclude: ReadonlySet<string> = new Set();
  private _draftVersion = 1;
  /** Serialized value at enable time — a pristine form writes no draft (R20). */
  private _draftBaseline: string | null = null;
  private _draftLastWritten: string | null = null;
  private readonly _hasDraft = signal(false);

  /** True when a stored draft was found and restored by {@link enableDraft}. */
  readonly hasDraft: Signal<boolean> = this._hasDraft.asReadonly();

  /**
   * Persists the form value under `key` on every (debounced) change and
   * restores an existing draft immediately. The draft is cleared
   * automatically after a submit that reports no errors, or manually via
   * {@link clearDraft}. `File` values are skipped (not serializable).
   * Requires an Injector; the default storage is `localStorage` (no-op on SSR).
   */
  enableDraft(options: MdyDraftOptions): void {
    if (this._draftEffect) return;
    if (!this._injector) {
      if (typeof ngDevMode !== "undefined" && ngDevMode) {
        console.warn(
          "[modyra] enableDraft() needs an Injector: " +
            "construct the adapter with one (done automatically by <mdy-form> and mdyForm()).",
        );
      }
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
        this.patchValue(
          Object.fromEntries(
            Object.entries(value).filter(([k]) => !this._draftExclude.has(k)),
          ),
        );
        this._hasDraft.set(true);
        this._draftLastWritten = this._serializeDraft(value);
      } else {
        this._draftStorage.remove(this._draftKey);
      }
    }
    this._draftBaseline = this._serializeDraft(
      untracked(() => this.value()),
    );

    this._draftEffect = effect(
      (onCleanup) => {
        const current = this.value();
        untracked(() => {
          if (this._draftTimer !== null) clearTimeout(this._draftTimer);
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
      },
      { injector: this._injector },
    );
  }

  /** Removes the stored draft (also called after an error-free submit). */
  clearDraft(): void {
    if (this._draftKey && this._draftStorage) {
      this._draftStorage.remove(this._draftKey);
    }
    this._hasDraft.set(false);
    this._draftLastWritten = null;
    // The current (submitted) value becomes the new baseline.
    this._draftBaseline = this._serializeDraft(untracked(() => this.value()));
  }

  /**
   * Parses a stored draft, returning its value or `null` when it must be
   * discarded (corrupt JSON, version mismatch, expired TTL). Envelope-less
   * payloads written by pre-versioning releases are still accepted.
   */
  private _parseDraft(
    stored: string,
    ttlMs: number | undefined,
  ): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isDraftEnvelope(parsed)) {
        if (parsed.__mdyDraft !== this._draftVersion) return null;
        if (ttlMs !== undefined && Date.now() - parsed.savedAt > ttlMs) {
          return null;
        }
        return parsed.value;
      }
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>; // legacy plain draft
      }
      return null;
    } catch {
      return null;
    }
  }

  private _serializeDraft(value: Record<string, unknown>): string {
    const serializable = Object.fromEntries(
      Object.entries(value).filter(
        ([k, v]) => !this._draftExclude.has(k) && !containsFile(v),
      ),
    );
    return JSON.stringify(serializable);
  }

  private _writeDraft(value: Record<string, unknown>): void {
    if (!this._draftKey || !this._draftStorage) return;
    const serialized = this._serializeDraft(value);
    // Nothing the user changed → no draft (R20); unchanged → no rewrite.
    if (serialized === this._draftLastWritten) return;
    if (this._draftLastWritten === null && serialized === this._draftBaseline) {
      return;
    }
    const envelope: DraftEnvelope = {
      __mdyDraft: this._draftVersion,
      savedAt: Date.now(),
      value: JSON.parse(serialized) as Record<string, unknown>,
    };
    try {
      this._draftStorage.write(this._draftKey, JSON.stringify(envelope));
      this._draftLastWritten = serialized;
    } catch {
      // Quota errors and private-mode restrictions must not break the form.
    }
  }

  // ── History (undo/redo) and change tracking ─────────────────────────────────

  private readonly _undoStack: Array<Record<string, unknown>> = [];
  private readonly _redoStack: Array<Record<string, unknown>> = [];
  private _lastSnapshot: Record<string, unknown> | null = null;
  private _historyEffect: EffectRef | null = null;
  private _historyTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _canUndo = signal(false);
  private readonly _canRedo = signal(false);

  /** True when {@link undo} has state to restore. Enable with {@link enableHistory}. */
  readonly canUndo: Signal<boolean> = this._canUndo.asReadonly();
  /** True when {@link redo} has state to restore. */
  readonly canRedo: Signal<boolean> = this._canRedo.asReadonly();

  /**
   * Starts recording value snapshots for {@link undo}/{@link redo}.
   * Requires the adapter to have been constructed with an Injector
   * (done automatically by `<mdy-form>` / `mdyForm()`). Idempotent.
   *
   * `debounceMs` batches rapid changes (e.g. keystrokes) into a single
   * history entry — without it every value change becomes an undo step.
   * Only the form **value** is recorded: touched/dirty flags, server errors
   * and validation state are not restored by undo/redo.
   */
  enableHistory(options?: {
    readonly maxEntries?: number;
    readonly debounceMs?: number;
  }): void {
    if (this._historyEffect) return;
    if (!this._injector) {
      if (typeof ngDevMode !== "undefined" && ngDevMode) {
        console.warn(
          "[modyra] enableHistory() needs an Injector: " +
            "construct the adapter with one (done automatically by <mdy-form> and mdyForm()).",
        );
      }
      return;
    }
    const max = options?.maxEntries ?? 100;
    const debounceMs = options?.debounceMs ?? 0;
    const record = (current: Record<string, unknown>): void => {
      const last = this._lastSnapshot;
      if (last !== null && shallowEqualRecords(last, current)) return;
      if (last !== null) {
        this._undoStack.push(last);
        if (this._undoStack.length > max) this._undoStack.shift();
        this._redoStack.length = 0;
        this._canUndo.set(true);
        this._canRedo.set(false);
      }
      this._lastSnapshot = current;
    };
    this._historyEffect = effect(
      (onCleanup) => {
        const current = this.value();
        untracked(() => {
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
          if (this._historyTimer !== null) clearTimeout(this._historyTimer);
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
      },
      { injector: this._injector },
    );
  }

  /**
   * Flushes a pending debounced snapshot so undo/redo act on the latest
   * value instead of the last recorded batch.
   */
  private _flushHistory(): void {
    if (this._historyTimer === null) return;
    clearTimeout(this._historyTimer);
    this._historyTimer = null;
    const current = untracked(() => this.value());
    const last = this._lastSnapshot;
    if (last !== null && !shallowEqualRecords(last, current)) {
      this._undoStack.push(last);
      this._redoStack.length = 0;
    }
    this._lastSnapshot = current;
  }

  /** Restores the previous recorded form value (no-op when history is empty). */
  undo(): void {
    this._flushHistory();
    const prev = this._undoStack.pop();
    if (!prev) return;
    const current = untracked(() => this.value());
    this._redoStack.push(current);
    // Pre-setting the snapshot makes the history effect treat the restored
    // value as already recorded instead of pushing it again.
    this._lastSnapshot = prev;
    this.setValue(prev);
    this._canUndo.set(this._undoStack.length > 0);
    this._canRedo.set(true);
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._flushHistory();
    const next = this._redoStack.pop();
    if (!next) return;
    const current = untracked(() => this.value());
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

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _getOrCreate(name: string): DeclarativeFieldRecord {
    let rec = this._fields.get(name);
    if (!rec) {
      rec = this._createFieldRecord(name);
      this._fields.set(name, rec);
      untracked(() => this._fieldNames.update(names => [...names, name]));
    }
    return rec;
  }

  private _createFieldRecord(name: string): DeclarativeFieldRecord {
    // Use untracked to avoid creating reactive dependencies on _formValue
    // when called from inside a computed.
    // has() (not ??) so an explicit initial value of null wins over the seed (R1).
    const initialValue = this._initialValues.has(name)
      ? this._initialValues.get(name)
      : untracked(() => this._formValue())?.[name] ?? null;

    const value = signal<unknown>(initialValue);
    const touched = signal(false);
    const dirty = signal(false);
    const requiredKeys = signal<ReadonlySet<string>>(new Set());
    // Dynamic signals provided by directives, defaulting to false.
    const disabledSignal = signal<Signal<boolean>>(signal(false));
    const readonlySignal = signal<Signal<boolean>>(signal(false));

    const validators = signal<
      ReadonlyMap<string, ReadonlyArray<ValidatorFn<unknown>>>
    >(new Map());
    const asyncValidators = signal<ReadonlyMap<string, AsyncValidatorEntry>>(
      new Map(),
    );
    const asyncErrors = signal<ReadonlyArray<MdyFieldError>>([]);
    const pending = signal(false);

    const errors = computed<ReadonlyArray<MdyFieldError>>(() => {
      const v = value();
      const syncErrors = Array.from(validators().values()).flatMap(fns =>
        fns.flatMap(fn =>
          fn(v).map(
            message => ({ kind: "validation", message }) as MdyFieldError,
          ),
        ),
      );
      return [
        ...syncErrors,
        ...asyncErrors(),
        ...this._crossErrorsFor(name),
        ...this._serverErrorsFor(name, v),
      ];
    });

    const state: MdyFieldState<unknown> = {
      value,
      touched,
      dirty,
      required: computed(() => requiredKeys().size > 0),
      valid: computed(() => errors().length === 0),
      errors,
      disabled: computed(() => disabledSignal()()),
      readonly: computed(() => readonlySignal()()),
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
  private _crossErrorsFor(name: string): ReadonlyArray<MdyFieldError> {
    const errors = this._crossErrors();
    if (errors.length === 0) return [];
    return errors
      .filter(e => e.path === name)
      .map(e => ({ kind: e.kind, message: e.message, payload: e.payload }));
  }

  /**
   * Server errors from the last submit, shown only while the field value
   * still equals the value that was submitted (B6).
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

  /**
   * Lazily creates the effect that runs async validators for a field.
   * Requires the adapter to have been constructed with an Injector.
   */
  private _ensureAsyncRunner(name: string, rec: DeclarativeFieldRecord): void {
    if (rec.asyncRunner) return;
    if (!this._injector) {
      if (typeof ngDevMode !== "undefined" && ngDevMode) {
        console.warn(
          `[modyra] Async validators for "${name}" need an Injector: ` +
            `construct MdyDeclarativeAdapter with one (done automatically by <mdy-form>).`,
        );
      }
      return;
    }
    rec.asyncRunner = effect(
      (onCleanup) => {
        const v = rec.state.value();
        const entries = Array.from(rec.asyncValidators().values());
        const fns = entries.flatMap(e => e.fns);
        const runId = ++rec.asyncRunId;
        if (fns.length === 0) {
          untracked(() => {
            rec.pending.set(false);
            rec.asyncErrors.set([]);
          });
          return;
        }
        // Pending covers the whole debounce+run window, so canSubmit stays
        // false while a check is outstanding.
        untracked(() => rec.pending.set(true));
        const run = (): void => {
          void Promise.all(fns.map(fn => fn(v)))
            .then(results => {
              if (runId !== rec.asyncRunId) return; // stale run: last-wins
              rec.asyncErrors.set(
                results
                  .flat()
                  .map(message => ({ kind: "async", message }) as MdyFieldError),
              );
              rec.pending.set(false);
            })
            .catch((e: unknown) => {
              if (runId !== rec.asyncRunId) return;
              rec.asyncErrors.set([{
                kind: "async",
                message: e instanceof Error ? e.message : String(e),
              }]);
              rec.pending.set(false);
            });
        };
        const debounceMs = entries.reduce(
          (max, e) => Math.max(max, e.debounceMs),
          0,
        );
        if (debounceMs > 0) {
          const timer = setTimeout(run, debounceMs);
          onCleanup(() => clearTimeout(timer));
        } else {
          run();
        }
      },
      { injector: this._injector },
    );
  }
}
