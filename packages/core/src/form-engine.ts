import {
  MdyBatchingCapability,
  MdyReactivity,
  MdyReactiveScope,
  MdySignal,
  MdyWritableSignal,
  reactivityRunsEffects,
} from "./reactivity-contract.js";

/** Narrows to a reactivity that reports (and implements) real runtime batching. */
function hasBatchingCapability(
  rx: MdyReactivity,
): rx is MdyReactivity & MdyBatchingCapability {
  return (
    rx.capabilities?.batching === true &&
    typeof (rx as Partial<MdyBatchingCapability>).batch === "function"
  );
}
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
import type { MdyCollectionHost } from "./contracts/collection-host.js";
import type { MdyPathGate } from "./contracts/form-registry.js";
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
export type { MdyFormRegistry, MdyPathGate } from "./contracts/form-registry.js";
export type { MdyCollectionHost } from "./contracts/collection-host.js";

// ─── Registry interface ───────────────────────────────────────────────────────


let _legacyValidatorKey = 0;

/** Names a wrong-shaped argument in a message, without printing what it holds. */
function shapeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

/**
 * A reactive argument arrives as a zero-argument function, and is refused here when it is not one.
 *
 * These setters are the adapter-facing surface: a framework's own reactive value passes through them
 * on every binding, and a ref or a plain boolean is the ordinary mistake. Nothing calls the argument
 * until a later read composes it, so a value that cannot be called is stored quietly and every read
 * that reaches it — `disabled()`, `readonly()`, `state.valid()`, `submitValue()` — fails with a
 * message naming an engine internal, on a form that still answers `getValue()`.
 *
 * A path is checked where it arrives; so is this.
 */
function assertReactive(
  value: unknown,
  parameter: string,
  name: string,
): asserts value is MdySignal<boolean> {
  if (typeof value === "function") return;
  throw new Error(
    `[modyra] ${parameter} for "${name}" must be a zero-argument function, received ${shapeOf(value)}. ` +
    "A framework's own reactive value is wrapped in one: () => ref.value.",
  );
}

/**
 * An initial is the baseline `reset()` returns to and `dirty` measures against, so it outlives every
 * value written over it. A field given one it cannot hold can never be clean and can always be reset
 * into a value its own kind forbids.
 *
 * The declared initial is what the engine knows about what a field holds — a schema states no kind —
 * so a replacement of a different shape is refused and a field that declared nothing is left alone.
 */
function assertBaseline(name: string, declared: unknown, value: unknown): void {
  if (declared === null || declared === undefined) return;
  if (value !== null && typeof value === typeof declared) return;
  throw new Error(
    `[modyra] The initial value for "${name}" must be ${shapeOf(declared)}, received ${shapeOf(value)}.`,
  );
}

/** The same door for the write that replaces everything. */
function assertWholeValue(value: unknown, method: string): asserts value is Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return;
  throw new Error(
    `[modyra] ${method} takes the whole form value as an object, received ${shapeOf(value)}.`,
  );
}

/** The same door for the setters whose reactive argument is a list of functions. */
function assertValidatorList(
  value: unknown,
  parameter: string,
  name: string,
): asserts value is ReadonlyArray<unknown> {
  if (Array.isArray(value) && value.every(entry => typeof entry === "function")) return;
  throw new Error(
    `[modyra] ${parameter} for "${name}" must be an array of functions, received ${shapeOf(value)}.`,
  );
}

export interface MdyFormEngineOptions {
  /** Emit console warnings for suspicious usage. Default true. */
  readonly devWarnings?: boolean;
  /**
   * Injection-prevention policy for field values (sanitization, length
   * caps, violation telemetry). Structural checks (draft shape, server
   * error paths) are always on regardless. See security.ts.
   */
  readonly security?: MdySecurityPolicy;
  /**
   * `false` defers every effect-dependent feature (draft, history, async
   * validators) until {@link MdyFormEngine.activate} is called instead of
   * starting them at construction time — piano §10.5/§10.7: construction
   * stays pure (no timers, no storage/network reads), so it's safe during
   * SSR and tolerant of React/Preact Strict Mode's dev-only double-invoke.
   * Default `true` (today's behavior: effects start immediately).
   */
  readonly autoActivate?: boolean;
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
/**
 * How a collection tells the engine which of its paths exist.
 *
 * `isOpen` is asked before anything is created, so a control mounting on a row that was never
 * declared claims nothing. `onRefusedWrite` is the other half: a *value* arriving for a refused path
 * is the owner's own data — a restored draft, an undo across the moment a row was added — and it is
 * offered to the owner rather than dropped.
 *
 * A collection that does not govern existence omits `isOpen`: its rows follow its value, every path
 * below it exists as soon as something writes there, and nothing is refused. It registers to hear
 * {@link MdyPathGate.onReplace} — the shape of a whole-value write — which is a different question
 * from who may create a field.
 */

/** What a binder has said about one path: the halves of {@link MdyInteractivity} it may state. */
interface MdyPathBinding {
  readonly disabled?: MdySignal<boolean>;
  readonly readonly?: MdySignal<boolean>;
}

export class MdyFormEngine
  implements MdyFormAdapter<Record<string, unknown>>, MdyCollectionHost {
  private readonly _fields = new Map<string, FieldRecord>();
  /** Reactive list of field names — drives state.valid computation. */
  private readonly _fieldNames: MdyWritableSignal<readonly string[]>;
  private readonly _initialValues = new Map<string, unknown>();
  /** Reference count of controls claiming each field name. */
  private readonly _claims = new Map<string, number>();
  /**
   * Prefixes whose paths exist only while their owner says so, and the predicate that decides.
   *
   * A keyed collection owns the set of rows that exist; a control mounting on one of them must not
   * bring it into being, or the data model would follow the rendering. See {@link registerPathGate}.
   */
  private readonly _gates = new Map<string, MdyPathGate>();
  /**
   * Paths a schema declared, which no control may take away.
   *
   * A field created **by a control** — the declarative mode, where `name="email"` is the only place
   * the field is ever mentioned — belongs to that control and goes when it goes. A field a schema
   * declared belongs to the schema: it exists because someone wrote it down, and whether anything is
   * on screen is not the schema's business. It is the same sentence the gate makes for a row.
   */
  private readonly _owned = new Set<string>();
  /** Claims that arrived for a path its gate refuses, held until the gate admits it. */
  private readonly _pendingClaims = new Map<string, number>();
  /**
   * What a binding said about a field, kept apart from the field record.
   *
   * `disabled` and `readonly` are the binder's word, and a binder outlives the record: inside a
   * keyed collection a control may bind before its row is declared, and it stays bound while the row
   * is removed and declared again. The record is the row's and is destroyed with it, so a binding
   * held only there would be dropped by a structural change the control never saw — leaving a
   * control that believes it is disabled over a field that is submitted.
   */
  private readonly _bindings = new Map<string, MdyPathBinding>();
  /**
   * Records handed to callers for refused paths: inert, absent from `_fields` and from
   * `fieldNames`, so they contribute neither value nor validity. Cached so repeated lookups of the
   * same refused path answer with the same object.
   */
  private readonly _detachedFields = new Map<string, FieldRecord>();
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
  /**
   * Builds a long-lived reactive object under this form's ownership.
   *
   * A handle is made of computations, and it outlives the read that asked for it: a row handle is
   * built inside the collection's `rows` computation, and a cell handle inside whatever the consumer
   * was computing when it called `cell()`. On a runtime that owns computations — Solid owns them by
   * the computation that created them — the owner re-running disposes everything created under it,
   * and a disposed computation keeps answering with the value it last held. The handle then reports
   * a row's cell as `null` for the rest of its life while the form's value is correct.
   *
   * Runtimes without ownership are unaffected: with no scope, this is a direct call.
   */
  runOwned<T>(build: () => T): T {
    const scope = this._scope;
    return scope && !scope.destroyed ? scope.run(build) : build();
  }

  /** True while {@link mutate} is running its callback. */
  private _mutating = false;
  /**
   * True when effect-dependent features (draft, history, async validators)
   * are paused — either constructed with `autoActivate: false` and never
   * {@link activate}d yet, or paused via {@link deactivate}. Field state,
   * undo/redo stacks and the draft baseline all survive; only the running
   * effects/timers stop. See piano §10.5/§10.7.
   */
  private _deactivated: boolean;

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
    this._deactivated = options?.autoActivate === false;
    this._scope = _rx.createScope?.({ debugName: "modyra:form" });
    const hasDraft = _rx.signal(false);
    this.hasDraft = hasDraft.asReadonly();
    this._draftManager = new MdyDraftManager({
      rx: _rx,
      getValue: () => this.value(),
      patchValue: (value) => this.restoreValue(value),
      hasDraft,
      warn: (message) => this._warn(message),
      filterRestoredEntry: (key, value) => this._draftEntryAllowed(key, value),
      isDeactivated: () => this._deactivated,
      scope: this._scope,
    });
    this._historyManager = new MdyHistoryManager({
      rx: _rx,
      isMutating: () => this._mutating,
      isDeactivated: () => this._deactivated,
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
    // A disabled field is not validated, for the same reason it is not submitted: the form is not
    // asking the question. Validating one would block submission on a value the field does not
    // contribute, and the user cannot clear the error because they cannot type into it.
    const valid = _rx.computed(
      () =>
        this._fieldNames().every((n) => {
          const rec = this._fields.get(n);
          if (!rec) return true;
          return rec.state.interactivity() === "disabled" || rec.state.valid();
        }) && this._crossErrors().length === 0,
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

  /**
   * The engine's development channel, for the collections it hosts.
   *
   * A manager that wrote to the console directly would keep talking after a host set
   * `devWarnings: false`, which is the one switch a consumer has for this noise.
   */
  warnDev(message: string): void {
    this._warn(message);
  }

  // ── MdyFormRegistry ─────────────────────────────────────────────────────────

  /**
   * Declares that paths under `prefix` exist only while `isOpen` says so.
   *
   * Written for collections whose keys are data: the owner of the keys decides which rows exist, and
   * everything else — a control mounting, a value write — asks. A refused path is not created, and a
   * claim on it waits instead of failing, so a control can mount before the row it belongs to arrives.
   *
   * Returns the disposer that removes the gate.
   */
  registerPathGate(prefix: string, gate: MdyPathGate): () => void {
    this._gates.set(prefix, gate);
    return () => {
      this._gates.delete(prefix);
    };
  }

  /**
   * Re-reads the gate over `prefix`: claims it now admits are replayed, and fields it now refuses are
   * destroyed with their claims put back in waiting.
   *
   * The owner calls this after changing which keys exist. Removing a row whose controls are still
   * mounted therefore takes the value with it — deletion is the owner's word, not the renderer's.
   */
  refreshPathGate(prefix: string): void {
    const covers = (name: string): boolean =>
      name === prefix || name.startsWith(`${prefix}.`);

    for (const [name, count] of [...this._pendingClaims]) {
      if (!covers(name) || this._gateRefuses(name)) continue;
      this._pendingClaims.delete(name);
      this._detachedFields.delete(name);
      for (let i = 0; i < count; i++) this.claimField(name);
    }

    for (const [name, count] of [...this._claims]) {
      if (!covers(name) || !this._gateRefuses(name)) continue;
      this._claims.delete(name);
      // The claim moves to waiting before the record goes, so that what is keyed by the name and
      // belongs to the control — its disabled and readonly bindings — is kept for the row's return.
      this._pendingClaims.set(name, count);
      this._destroyField(name);
    }

    for (const name of [...this._fields.keys()]) {
      if (covers(name) && this._gateRefuses(name)) this._destroyField(name);
    }
  }

  /** The field record for `name` if it exists — unlike {@link getField}, this creates nothing. */
  peekField(name: string): MdyFieldRef<unknown> | null {
    const rec = this._fields.get(name);
    return rec ? () => rec.state : null;
  }

  /** True when some collection owns this path, whether or not it currently admits it. */
  /**
   * True when a collection *governs existence* here — which is what stops an unmounting control from
   * destroying the field. A collection that only listens for whole-value writes governs nothing, so
   * its rows are removed by the ordinary path, by their owner.
   */
  private _gateCovers(name: string): boolean {
    for (const [prefix, gate] of this._gates) {
      if (!gate.isOpen) continue;
      if (name === prefix || name.startsWith(`${prefix}.`)) return true;
    }
    return false;
  }

  /**
   * Every gate whose prefix covers `name`, outermost first.
   *
   * Order matters for the report, not for the verdict: a path is in play only if *all* of them
   * admit it, and the outermost is the one whose refusal a caller can act on.
   */
  private _gatesOver(name: string): Array<[string, MdyPathGate]> {
    const covering: Array<[string, MdyPathGate]> = [];
    for (const [prefix, gate] of this._gates) {
      if (name === prefix || name.startsWith(`${prefix}.`)) covering.push([prefix, gate]);
    }
    return covering.sort(([a], [b]) => a.length - b.length);
  }

  /**
   * Out of play if any collection above it says no.
   *
   * The chain, not the first match: a collection nested inside another is covered by both gates,
   * and answering from whichever registered first lets a child admit a path its closed parent
   * refuses. It is the same sentence `conditions.ts` states about sections, over a different set of
   * ancestors.
   */
  private _gateRefuses(name: string): boolean {
    for (const [, gate] of this._gatesOver(name)) {
      if (gate.isOpen && !gate.isOpen(name)) return true;
    }
    return false;
  }

  /**
   * Offers a refused path to its owner as a *value*, and reports whether it was taken.
   *
   * A control mounting must not bring a row into being; a value arriving is a different act. A draft
   * being restored, an undo crossing the moment a row was added, a whole-form write: each carries the
   * owner's own data, and refusing it would silently drop the user's work rather than protect it.
   */
  private _offerToGate(name: string, value: unknown): boolean {
    // Offered outermost first: a row cannot be declared inside a parent row that does not exist,
    // so the outer collection is asked to take the value before the inner one is asked anything.
    for (const [, gate] of this._gatesOver(name)) {
      if (!gate.isOpen || gate.isOpen(name)) continue;
      gate.onRefusedWrite?.(name, value);
      if (!gate.isOpen(name)) return false;
    }
    return !this._gateRefuses(name);
  }

  claimField(name: string): void {
    if (this._gateRefuses(name)) {
      const waiting = (this._pendingClaims.get(name) ?? 0) + 1;
      this._pendingClaims.set(name, waiting);
      if (MDY_DEV) {
        this._warn(
          `Control claimed "${name}" before its row was declared. It stays empty until the key ` +
          "is declared; declaring it is the collection owner's call, not the control's.",
        );
      }
      return;
    }
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
    const waiting = this._pendingClaims.get(name);
    if (waiting !== undefined) {
      if (waiting > 1) this._pendingClaims.set(name, waiting - 1);
      else this._pendingClaims.delete(name);
      return;
    }
    const remaining = (this._claims.get(name) ?? 1) - 1;
    if (remaining > 0) {
      this._claims.set(name, remaining);
      return;
    }
    this._claims.delete(name);
    // Inside a gated collection the field belongs to the row, not to the controls that happen to be
    // showing it. Destroying it here would make a value depend on whether anything is on screen,
    // which is the failure the gate exists to prevent — the owner ends the row, and takes the value.
    if (this._gateCovers(name)) return;
    // Same sentence, one level out: a field a schema declared is the schema's, and unmounting the
    // control that showed it used to delete it — after which `getValue()` threw, because the value
    // no longer matched the shape the schema promised.
    if (this._owned.has(name)) return;
    this._destroyField(name);
  }

  /** Drops the record and everything keyed by its name. */
  /**
   * Ends a field because the collection that declared it says so.
   *
   * {@link removeField} answers to a control releasing its claim and refuses to end a field a row
   * owns; this is the row's own word, used when a collection replaces a subtree in place — a nested
   * list rewritten by a reorder above it, whose old rows are nobody's any more. Without it those
   * fields survive, and the reconciliation that reads field names absorbs them back as rows.
   */
  endField(name: string): void {
    this._claims.delete(name);
    this._owned.delete(name);
    this._destroyField(name);
  }

  private _destroyField(name: string): void {
    const rec = this._fields.get(name);
    if (!rec) return;
    rec.asyncRunner?.destroy();
    this._fields.delete(name);
    this._rx.untracked(() =>
      this._fieldNames.update(names => names.filter(n => n !== name)),
    );
    this._initialValues.delete(name);
    this._fieldSanitizers.delete(name);
    // The binding outlives the record only while something is still bound: a claim, or a claim
    // waiting for its row. With neither, the control that spoke is gone and so is what it said.
    if (!this._claims.has(name) && !this._pendingClaims.has(name)) this._bindings.delete(name);
  }

  /**
   * Declares that `name` exists because a schema says so, not because a control does.
   *
   * Called by whoever owns the declaration — the typed form for its fields, an array manager for the
   * leaves of a row it registered — and undone when that owner takes the field away.
   */
  ownField(name: string): void {
    this._owned.add(name);
  }

  /** Gives up ownership: the field goes back to living as long as something claims it. */
  disownField(name: string): void {
    this._owned.delete(name);
  }

  setInitialValue(name: string, value: unknown): void {
    assertBaseline(name, this._initialValues.get(name), value);
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
    assertValidatorList(validators, "validators", name);
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
    assertValidatorList(validators, "validators", name);
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
    assertReactive(disabled, "disabled", name);
    const rec = this._getOrCreate(name);
    // A binding cannot put back in play what the schema left out, and finding that out by watching a
    // control stay grey is the kind of silence this library owes an explanation for.
    if (MDY_DEV && this._devWarnings && rec.inactive()()) {
      this._warn(
        `"${name}" is out of play because a condition in the schema says so, so a control's own ` +
        "disabled binding cannot change it. The condition is what decides here; the binding decides " +
        "only while the field is in play.",
      );
    }
    this._bind(name, { disabled });
    rec.disabled.set(disabled);
  }

  /**
   * Declares that `name` is only in play while `active` says so.
   *
   * Separate from {@link MdyFormEngine.setDisabled} because the two have different authors: a
   * schema states when a field counts, a binding states whether the user may edit it now. One slot
   * would let whichever spoke last silently cancel the other.
   */
  setInactive(name: string, inactive: MdySignal<boolean>): void {
    assertReactive(inactive, "inactive", name);
    this._getOrCreate(name).inactive.set(inactive);
  }

  setReadonly(name: string, readonly: MdySignal<boolean>): void {
    assertReactive(readonly, "readonly", name);
    this._bind(name, { readonly });
    this._getOrCreate(name).readonly.set(readonly);
  }

  /**
   * Moves what a binder said about a set of paths onto the paths their rows now have.
   *
   * A row that changes identity — renamed, or moved to another index — carries its value, its
   * verdicts and the marks a user left on it. What a control said about a cell is the same kind of
   * thing: it belongs to the row, not to the spelling of its path, and a binding left behind would
   * suppress a cell of whichever row arrives at that path next.
   *
   * The *value* is carried, not the signal. The signal belongs to a control bound to the old path,
   * and a control stays where it is while rows move under it: carrying the signal itself would let
   * that control keep speaking for a row it no longer shows. A control that follows its row says so
   * again on its next render, which replaces this snapshot.
   *
   * Every pair is read before any is written, so a swap does not clear what it has just carried.
   */
  carryBindings(pairs: ReadonlyArray<readonly [from: string, to: string]>): void {
    const carried: Array<{ from: string; to: string; binding: MdyPathBinding }> = [];
    for (const [from, to] of pairs) {
      const binding = this._bindings.get(from);
      if (binding) carried.push({ from, to, binding });
    }
    for (const { from } of carried) this.clearBindings(from);
    for (const { to, binding } of carried) {
      const snapshot: { disabled?: MdySignal<boolean>; readonly?: MdySignal<boolean> } = {};
      if (binding.disabled) snapshot.disabled = this._rx.signal(this._rx.untracked(() => binding.disabled!()));
      if (binding.readonly) snapshot.readonly = this._rx.signal(this._rx.untracked(() => binding.readonly!()));
      this._bindings.set(to, { ...this._bindings.get(to), ...snapshot });
      const rec = this._fields.get(to) ?? this._detachedFields.get(to);
      if (!rec) continue;
      if (snapshot.disabled) rec.disabled.set(snapshot.disabled);
      if (snapshot.readonly) rec.readonly.set(snapshot.readonly);
    }
  }

  /**
   * Re-places the fields under `prefix` so that the row segment of each follows `order`.
   *
   * A row's fields are registered when the row is declared, so the flat value reads them in the
   * order the rows arrived. A row that leaves one key and arrives at another is registered again and
   * would land last — the handle would say it is where it was and the value would say it is at the
   * bottom, about the same row at the same moment. Fields outside the prefix do not move, and the
   * slots the collection already occupies are the slots it keeps.
   */
  orderRowsUnder(prefix: string, order: ReadonlyArray<string>): void {
    const rank = new Map(order.map((key, index) => [key, index]));
    const rowOf = (name: string): number =>
      rank.get(name.slice(prefix.length + 1).split(".")[0] ?? "") ?? Number.MAX_SAFE_INTEGER;
    const under = [...this._fields.keys()].filter(name => name.startsWith(`${prefix}.`));
    if (under.length < 2) return;
    // Stable, so what a row holds keeps the order it was registered in.
    const sorted = [...under].sort((a, b) => rowOf(a) - rowOf(b));
    if (sorted.every((name, index) => name === under[index])) return;

    const queue = sorted[Symbol.iterator]();
    const placed = new Map<string, FieldRecord>();
    for (const [name, rec] of this._fields) {
      if (!name.startsWith(`${prefix}.`)) {
        placed.set(name, rec);
        continue;
      }
      const next = queue.next().value as string;
      placed.set(next, this._fields.get(next)!);
    }
    this._fields.clear();
    for (const [name, rec] of placed) this._fields.set(name, rec);
    this._rx.untracked(() => this._fieldNames.set([...placed.keys()]));
  }

  /** Releases a path's binding and, where the field is there, what it was saying. */
  clearBindings(name: string): void {
    this._bindings.delete(name);
    const rec = this._fields.get(name) ?? this._detachedFields.get(name);
    if (!rec) return;
    rec.disabled.set(this._rx.signal(false));
    rec.readonly.set(this._rx.signal(false));
  }

  private _bind(name: string, binding: MdyPathBinding): void {
    this._bindings.set(name, { ...this._bindings.get(name), ...binding });
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getField(name: string): MdyFieldRef<unknown> | null {
    // A path its gate refuses has no field to resolve — the row it belongs to has not been declared.
    // Null rather than an inert record, so a caller that must render something empty says so itself.
    if (this._gateRefuses(name)) return null;
    const rec = this._getOrCreate(name);
    return () => rec.state;
  }

  /**
   * Every field's value, including disabled ones.
   *
   * This is the *live editing model*, and it stays total on purpose. Drafts, history, cross-field
   * validators and async validation contexts all read it: a draft that dropped a field because it
   * happened to be disabled when the user walked away would lose their work, and a cross-field rule
   * comparing two fields needs both of them whatever their interactivity.
   *
   * {@link MdyFormEngine.submitValue} is what actually gets sent.
   */
  getValue(): Record<string, unknown> {
    // Reads the name list as a signal, so a computed built on this value depends on *which* fields
    // exist and not only on what they hold. Without it, a value read while a collection was empty
    // stays empty after rows arrive: the map iterated below is not reactive.
    this._fieldNames();
    return Object.fromEntries(
      Array.from(this._fields.entries()).map(([n, r]) => [n, r.state.value()]),
    );
  }

  /**
   * What a submit actually sends: every field except the disabled ones.
   *
   * A disabled control is not a control with an unavailable answer, it is a question the form is
   * not asking — HTML has never submitted one. A read-only field *is* submitted, because it holds a
   * real answer the form is asserting on the user's behalf.
   *
   * The return type is deliberately weaker than {@link MdyFormEngine.getValue}'s at the typed layer
   * (`MdySubmittedValue<S>`): any field may be disabled at runtime, so a total type would be
   * claiming something no runtime check guarantees.
   */
  submitValue(): Record<string, unknown> {
    return Object.fromEntries(
      Array.from(this._fields.entries())
        .filter(([, r]) => r.state.interactivity() !== "disabled")
        .map(([n, r]) => [n, r.state.value()]),
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
            // A cross-field error naming a path with no field, for the same reason as the line
            // above: a keyed collection's paths are data, so a rule about a row names one and the
            // row can leave while the rule still says it. The error keeps deciding `valid`, so it
            // has to be readable — a form that will not submit and cannot say why is the one state
            // a consumer cannot render.
            ...this._crossErrors().filter(
              e => e.path === null || !this._fields.has(e.path),
            ),
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
      if (!this._offerToGate(key, val)) continue;
      const rec = this._getOrCreate(key);
      rec.state.value.set(val);
    }
  }

  setValue(value: Record<string, unknown>): void {
    assertWholeValue(value, "setValue");
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      if (!this._offerToGate(key, val)) continue;
      const rec = this._getOrCreate(key);
      rec.state.value.set(val);
    }
    // Replace semantics: a field the new value does not name returns to its initial, which is the
    // rule `reset()` follows and a shape the form could have started in. Nulling them instead left a
    // field holding what `explainValueMismatch` condemns, on a form still reporting itself valid.
    this._fields.forEach((rec, name) => {
      if (name in value && value[name] !== undefined) return;
      rec.state.value.set(this._initialOf(name));
    });
    // Told last, so a row this write declared is already there to be kept.
    this._tellGatesTheWholeValue(value);
  }

  /**
   * Writes a stored snapshot back.
   *
   * A patch, because a draft deliberately omits what it must not persist and nulling those would
   * erase them — but the collections are told the whole shape, so a row the user removed before the
   * snapshot was written stays removed instead of coming back.
   */
  restoreValue(value: Record<string, unknown>): void {
    // One snapshot arriving is one change. Restoring row by row put a step of history between every
    // pair of rows, so undoing a restored draft walked back through partial tables the user never
    // saw — and the state they were in before it arrived was on none of them.
    this.mutate(() => {
      this.patchValue(value);
      this._tellGatesTheWholeValue(value);
    });
  }

  /** Hands each collection the paths a whole-value write carried below it. */
  private _tellGatesTheWholeValue(value: Record<string, unknown>): void {
    for (const [prefix, gate] of this._gates) {
      if (!gate.onReplace) continue;
      const under = new Set<string>();
      for (const name of Object.keys(value)) {
        if (name.startsWith(`${prefix}.`)) under.add(name);
      }
      gate.onReplace(under);
    }
  }

  reset(): void {
    this._fields.forEach((rec, name) => {
      // Only restore explicit initial values; a seed value is a prefill,
      // not a reset target. Fields without an explicit initial go to null.
      rec.state.value.set(this._initialOf(name));
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
    // Disabled fields are not sent. See `submitValue`.
    const value = this.submitValue();
    try {
      const checked = this._readRefusal((await action(value)) ?? []);
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

  /**
   * What a submit action returned, read as a refusal a person can be shown.
   *
   * The argument is whatever an application derived from a server's answer, so every shape a
   * response takes arrives here. The rule is that a refusal reaches somebody: an answer this cannot
   * read becomes a form-level error rather than nothing, because the failure it replaces is a person
   * who pressed Send, saw no message, and believed it went through.
   *
   * A path is still untrusted. An unsafe one is dropped and reported, which is the one case where
   * losing the message is the lesser harm.
   */
  private _readRefusal(returned: unknown): ReadonlyArray<MdyFormError> {
    if (!Array.isArray(returned)) {
      this._warn(
        "A submit action returns a list of errors or nothing; this one returned " +
        `${shapeOf(returned)}, so its answer could not be read.`,
      );
      return [{
        path: null,
        kind: "unknown",
        message: "The submitted answer could not be read.",
      }];
    }
    const read: MdyFormError[] = [];
    for (const entry of returned) {
      // A bare message is what a server that says "no" without naming a field looks like once an
      // application has pulled the strings out of its response.
      if (typeof entry === "string") {
        read.push({ path: null, kind: "unknown", message: entry });
        continue;
      }
      if (entry === null || typeof entry !== "object") {
        this._warn(`A submit action returned ${shapeOf(entry)} among its errors, which names nothing.`);
        continue;
      }
      const raw = entry as { path?: unknown; kind?: unknown; message?: unknown; payload?: unknown };
      // Absent, null and empty all mean the same thing — the refusal is about the form. A server
      // writes `{ message }` far more often than it writes `{ path: null, message }`.
      const named = raw.path === undefined || raw.path === null || raw.path === "" ? null : raw.path;
      if (named !== null && (typeof named !== "string" || !isSafeFieldPath(named))) {
        this._report({
          kind: "error-path",
          path: String(named),
          detail: `Server error with unsafe path "${String(named)}" dropped.`,
        });
        continue;
      }
      // A message that is not a string reached a person as `[object Object]`. What it holds is kept
      // on `payload`, where an application can read it, and what is shown says what happened.
      const message = typeof raw.message === "string"
        ? raw.message
        : "The submitted answer could not be read.";
      if (typeof raw.message !== "string") {
        this._warn(
          `A submit error for ${named === null ? "the form" : `"${named}"`} carried ` +
          `${shapeOf(raw.message)} as its message, which is not something to show anyone.`,
        );
      }
      read.push({
        path: named,
        kind: typeof raw.kind === "string" ? raw.kind : "unknown",
        message,
        ...(raw.payload === undefined && typeof raw.message === "string" ? {} : { payload: raw.payload ?? raw.message }),
      });
    }
    return read;
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
   * Groups every field write inside `fn` into exactly one history entry
   * (when history is enabled), regardless of whether the reactivity
   * adapter's effects run synchronously or are scheduler-deferred.
   * Delegates to the adapter's own `batch()`
   * when it reports the capability (none do yet — piano Milestone 3); works
   * correctly without it either way.
   *
   * ```ts
   * form.mutate(() => {
   *   form.f.firstName.set("Lorenzo");
   *   form.f.lastName.set("Muscherà");
   * });
   * ```
   */
  mutate(fn: () => void): void {
    if (this._mutating) {
      // Nested call: the outermost mutate() owns the single coalesced entry.
      fn();
      return;
    }
    this._mutating = true;
    try {
      if (hasBatchingCapability(this._rx)) {
        this._rx.batch(fn);
      } else {
        fn();
      }
    } finally {
      this._mutating = false;
      this._historyManager.recordNow();
    }
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

  /** True while effect-dependent features are paused — see {@link activate}/{@link deactivate}. */
  get deactivated(): boolean {
    return this._deactivated;
  }

  /**
   * Starts (or resumes) effect-dependent features: draft persistence,
   * history recording and per-field async validators. Idempotent, and
   * safe to call repeatedly (React/Preact Strict Mode's dev-only
   * mount→unmount→remount dance calls this on every mount). No-op if the
   * engine wasn't constructed with `autoActivate: false` and was never
   * {@link deactivate}d — those already start immediately.
   */
  activate(): void {
    if (this._destroyed || !this._deactivated) return;
    this._deactivated = false;
    this._draftManager.resume();
    this._historyManager.resume();
    this._fields.forEach((rec, name) => this._ensureAsyncRunner(name, rec));
  }

  /**
   * Pauses draft persistence, history recording and per-field async
   * validators — releasing their timers/network calls/effects — without
   * losing any state (field values, undo/redo stacks, draft baseline).
   * Unlike {@link destroy}, the form can be {@link activate}d again.
   * Idempotent. Intended for a binding's own lifecycle (e.g. React/Preact
   * Strict Mode's transient unmount, or pausing an inactive tab/route).
   */
  deactivate(): void {
    if (this._destroyed || this._deactivated) return;
    this._deactivated = true;
    this._draftManager.pause();
    this._historyManager.pause();
    this._fields.forEach(rec => {
      rec.asyncRunner?.destroy();
      rec.asyncRunner = null;
    });
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
    this._owned.clear();
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
    if (this._gateRefuses(name)) {
      // Detached: writes land somewhere harmless instead of throwing, and the record is absent from
      // `_fields`, so it weighs on neither the form's value nor its validity.
      let detached = this._detachedFields.get(name);
      if (!detached) {
        detached = this._createFieldRecord(name);
        this._detachedFields.set(name, detached);
      }
      return detached;
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

  /** What a field holds when nothing has been written to it: its initial, or null if none was declared. */
  private _initialOf(name: string): unknown {
    return this._initialValues.has(name) ? this._initialValues.get(name) : null;
  }

  private _createFieldRecord(name: string): FieldRecord {
    // Untracked so no reactive dependency on the seed value is created when
    // called from inside a computed. has() (not ??) so an explicit initial
    // value of null wins over the seed.
    const initialValue = this._initialValues.has(name)
      ? this._initialValues.get(name)
      : this._rx.untracked(() => this._formValue())?.[name] ?? null;

    const rec = createFieldRecord(
      this._rx,
      this._applySecurity(name, initialValue),
      (v) => [...this._crossErrorsFor(name), ...this._serverErrorsFor(name, v)],
      (v) => this._applySecurity(name, v),
      (message) => this._warn(`"${name}" ${message}`),
    );

    // A record built for a path a binding already spoke about answers to that binding from the
    // start: the row is new, what the control said about it is not.
    const bound = this._bindings.get(name);
    if (bound?.disabled) rec.disabled.set(bound.disabled);
    if (bound?.readonly) rec.readonly.set(bound.readonly);
    return rec;
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
    if (!this._initialValues.has(key)) {
      // A form whose structure was declared — a schema owns fields, a collection owns a subtree —
      // restores only what that declaration describes. Storage is the least trustworthy input a
      // form has, and a key nobody declared arriving from it becomes a field: a name of the
      // writer's choosing in `fieldNames()`, which is what a document-driven renderer draws from.
      // A collection's own paths are described by its gate, so a row restores as it always did.
      const declared = this._owned.size > 0 || this._gates.size > 0;
      // Every collection's own subtree, not only the ones that govern existence: an array's rows
      // follow its value, and a draft naming a row it does not have yet is how a restored order
      // gets its lines back.
      const insideCollection = [...this._gates.keys()].some(
        (prefix) => key === prefix || key.startsWith(`${prefix}.`),
      );
      if (declared && !insideCollection) {
        this._report({
          kind: "draft-shape",
          path: key,
          detail: `Draft entry "${key}" dropped: the form declares no field by that name.`,
        });
        return false;
      }
      return true;
    }
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
    if (this._destroyed || this._deactivated || rec.asyncRunner) return;
    if (!reactivityRunsEffects(this._rx)) {
      if (MDY_DEV) this._warn(
        `Async validators for "${name}" need an effect-capable reactivity ` +
        "— see your reactivity adapter for how to provide one.",
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
