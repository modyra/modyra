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
import {
  MDY_ADAPTER_CONTRACT_VIOLATION,
  MDY_ASYNC_FEATURE_DISABLED,
  type MdyDiagnostics,
} from "./reactivity-diagnostics.js";
import { ancestorsOf, isSafeFieldPath } from "./path-utils.js";
import type { MdyCollectionHost } from "./contracts/collection-host.js";
import type { MdyInteractivity } from "./types.js";
import type { MdyPathGate } from "./contracts/form-registry.js";
import { MDY_DEV } from "./dev-flags.js";
import { matchesValueShape, type MdyValueShape } from "./value-contracts.js";
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

export type { MdyDraftOptions, MdyDraftStorage, MdyWebStorageLike } from "./draft-manager.js";
export type { MdyFormRegistry, MdyPathGate } from "./contracts/form-registry.js";
export type { MdyCollectionHost } from "./contracts/collection-host.js";

// ─── Registry interface ───────────────────────────────────────────────────────


let _legacyValidatorKey = 0;

/** Names a wrong-shaped argument in a message, without printing what it holds. */
/**
 * A flat write's entries, in the order their paths are numbered.
 *
 * A positional collection grows one row at a time, so the order its cells arrive in decides whether
 * they land. Object key order is the order a JSON document happened to be written in, and a draft
 * rewritten by anything else can hand `tags.10` before `tags.2` — after which the list has a row for
 * the first and none for the second. Sorting by segment, numerically where a segment is a number,
 * makes a write's effect the same whatever order it was serialised in.
 */
function inPathOrder(
  value: Partial<Record<string, unknown>>,
): Array<[string, unknown]> {
  return Object.entries(value).sort(([left], [right]) => {
    const a = left.split(".");
    const b = right.split(".");
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const one = a[i];
      const two = b[i];
      if (one === undefined) return -1;
      if (two === undefined) return 1;
      if (one === two) continue;
      const asNumbers = Number(one) - Number(two);
      if (Number.isFinite(asNumbers) && asNumbers !== 0) return asNumbers;
      return one < two ? -1 : 1;
    }
    return 0;
  });
}

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

/** The sanitizer profiles a policy may name. A closed set, which is what makes a typo detectable. */
const SANITIZE_PROFILES: ReadonlySet<string> = new Set(["off", "text", "strict"]);

/** What a security policy may say. Closed too, so a misspelled key is a key nobody wrote. */
const SECURITY_KEYS: ReadonlySet<string> = new Set(["sanitize", "maxValueLength", "onViolation"]);

/**
 * A policy that was asked for badly is not silently the one that does nothing.
 *
 * `sanitize` defaults to `"off"`, deliberately — and that default is what makes every way of getting
 * the option wrong indistinguishable from not having asked for it. A profile outside the closed set
 * fell back to the *least* protective member of that set: `sanitise` is the ordinary British spelling
 * and turned an XSS defence off without a word, and `"stict"` was read, found to be nothing, and
 * answered with `off`.
 *
 * Not sanitizing by default is unchanged and correct — a consumer who asks for nothing gets nothing.
 * What is refused is asking for something that does not exist.
 */
function assertSecurityPolicy(policy: unknown): MdySecurityPolicy {
  if (policy === undefined) return {};
  if (typeof policy !== "object" || policy === null || Array.isArray(policy)) {
    throw new Error(
      `[modyra] security takes a policy object, received ${
        policy === null ? "null" : Array.isArray(policy) ? "an array" : `a ${typeof policy}`
      }: { sanitize, maxValueLength, onViolation }.`,
    );
  }
  const unknown = Object.keys(policy).filter((key) => !SECURITY_KEYS.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `[modyra] security does not have ${unknown.map((key) => `"${key}"`).join(", ")}. ` +
      `It has ${[...SECURITY_KEYS].join(", ")}.`,
    );
  }
  const { sanitize } = policy as MdySecurityPolicy;
  if (sanitize !== undefined && typeof sanitize !== "function" && !SANITIZE_PROFILES.has(sanitize)) {
    throw new Error(
      `[modyra] There is no sanitizer called ${JSON.stringify(sanitize)}. ` +
      `Name one of ${[...SANITIZE_PROFILES].join(", ")}, or pass a function.`,
    );
  }
  return policy as MdySecurityPolicy;
}

/**
 * A callback that has not finished cannot be one change.
 *
 * `mutate(fn: () => void)` is typed synchronous and TypeScript does not stop this: a function
 * returning `Promise<void>` is assignable where `void` is expected, which is the rule that makes
 * callbacks ergonomic and here is a foot-gun.
 */
function assertFinished(returned: unknown): void {
  if (returned === null || typeof returned !== "object" && typeof returned !== "function") return;
  if (typeof (returned as { then?: unknown }).then !== "function") return;
  throw new Error(
    "[modyra] mutate takes a callback that finishes: it groups the writes it makes into one change, " +
    "and a callback that waits has already ended its batch by the time it resumes. Await first, then " +
    "call mutate with what to write.",
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
   * Where the form reports what it could not do.
   *
   * The codes and the sinks were published — `createConsoleDiagnostics`, `createSilentDiagnostics`,
   * `MDY_ASYNC_FEATURE_DISABLED` and its siblings — and nothing took one: the only option accepting
   * an `MdyDiagnostics` lived in one adapter's reactivity. A consumer who read that surface built a
   * sink, named the codes they cared about, and waited for something that could never arrive.
   *
   * A form degrades rather than failing — an async check a reactivity cannot run is skipped, a draft
   * without effects is not started — and each of those is invisible on every surface an application
   * reads. With a sink they are events with codes, routable and filterable; without one they are a
   * console line in development and nothing in production.
   */
  readonly diagnostics?: MdyDiagnostics;
  /**
   * Injection-prevention policy for field values (sanitization, length
   * caps, violation telemetry). Structural checks (draft shape, server
   * error paths) are always on regardless. See security.ts.
   */
  readonly security?: MdySecurityPolicy;
  /**
   * `false` defers every effect-dependent feature (draft, history, async
   * validators) until {@link MdyFormEngine.activate} is called instead of
   * starting them at construction time — construction
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
  /** A schema's own condition, which the binder cannot override — see {@link MdyFormEngine.setInactive}. */
  readonly inactive?: MdySignal<boolean>;
}

/**
 * Whether a value arriving from storage is one this field offers.
 *
 * An option's *shape* is "anything non-nullish" by design: ADR 0051 lets an option carry an object,
 * so the shape check cannot tell a legitimate one from `{"hostile":true}`. The list can. Where a
 * field declares none — a typed form that passes options nowhere — this says yes and the field is
 * back to the shape check alone.
 */
function offeredHere(
  offered: readonly unknown[] | undefined,
  shape: MdyValueShape,
  value: unknown,
): boolean {
  if (offered === undefined) return true;
  if (shape === "option") return offered.some((option) => sameOptionValue(option, value));
  if (shape === "option[]") {
    return Array.isArray(value)
      && value.every((member) => offered.some((option) => sameOptionValue(option, member)));
  }
  return true;
}

/** Two option values are the same when they hold the same thing — the rule `equals` follows. */
function sameOptionValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}


export class MdyFormEngine
  implements MdyFormAdapter<Record<string, unknown>>, MdyCollectionHost {
  private readonly _fields = new Map<string, FieldRecord>();
  /**
   * How many times the set of field names has changed.
   *
   * The names themselves are the keys of `_fields`, in their own order, and `fieldNames` derives the
   * list from them. Held as a list instead, every field created copied it: one row's cells cost the
   * length of the form, and declaring two thousand rows in one write spent most of its time
   * allocating arrays nobody read. A counter says the same thing — *the shape changed* — in one
   * write, and a reader inside a batch pays for the list once rather than once per row.
   */
  private readonly _structure: MdyWritableSignal<number>;
  private readonly _initialValues = new Map<string, unknown>();

  /**
   * The paths the form started with, once someone has said when that was.
   *
   * A baseline is two things and they are not the same: what a field started as, and whether the
   * field was there at all. A row a user adds has cells whose declared initial is the value the row
   * arrived with, so every one of them equals its own baseline and a patch built from the difference
   * carried no trace of a row that is not in the stored document. Names are what separates them.
   *
   * `null` until a baseline is taken: an engine driven directly has never been told when its form
   * stopped being built, and reporting every field as new would be worse than reporting none.
   */
  private _baselineFields: Set<string> | null = null;

  /**
   * How many fields live under each dotted prefix a field's path passes through.
   *
   * A name may address a subtree — a collection, a group — and the two places that answer "is this an
   * ancestor" walked every field the form holds to find out. Once per cell of a row, that is the
   * whole cost of writing a collection in bulk: two thousand rows paid for six thousand walks over a
   * growing map. The count is kept where the fields are, and answering costs one lookup.
   */
  private readonly _pathPrefixes = new Map<string, Map<string, number>>();

  /** Records (or releases) the prefixes `name` sits under, and the segment it takes under each. */
  private _indexPrefixes(name: string, added: boolean): void {
    let at = name.indexOf(".");
    while (at !== -1) {
      const prefix = name.slice(0, at);
      const next = name.indexOf(".", at + 1);
      const segment = next === -1 ? name.slice(at + 1) : name.slice(at + 1, next);
      const children = this._pathPrefixes.get(prefix);
      if (added) {
        if (children) children.set(segment, (children.get(segment) ?? 0) + 1);
        else this._pathPrefixes.set(prefix, new Map([[segment, 1]]));
      } else if (children) {
        const held = children.get(segment) ?? 0;
        if (held <= 1) children.delete(segment);
        else children.set(segment, held - 1);
        if (children.size === 0) this._pathPrefixes.delete(prefix);
      }
      at = next;
    }
  }

  /** Whether any field lives below `name` — the question a subtree write has to ask first. */
  private _hasFieldsUnder(name: string): boolean {
    return this._pathPrefixes.has(name);
  }

  /**
   * The one path segment each child of `prefix` occupies — a collection's keys, or its row indices.
   *
   * A collection asking which of its rows the form holds used to read every field name and keep the
   * ones under its own path. Each collection paid the width of the whole form, so a form holding a
   * collection per row paid it once per row: the cost of declaring rows grew with the square of
   * their number. The index answers from where the fields are.
   *
   * Reads the structure signal, so a caller inside an effect re-runs when the shape changes, exactly
   * as {@link MdyFormEngine.fieldNames} does.
   */
  childSegmentsUnder(prefix: string): readonly string[] {
    this._structure();
    const children = this._pathPrefixes.get(prefix);
    return children ? [...children.keys()] : [];
  }
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
  private readonly _diagnostics: MdyDiagnostics | undefined;
  private readonly _security: MdySecurityPolicy;
  /** Per-field sanitizer overrides (schema-level), keyed by dotted path. */
  private readonly _fieldSanitizers = new Map<string, MdySanitizer>();
  /** Paths a schema declared as holding a secret. */
  private readonly _sensitivePaths = new Set<string>();
  /** The runtime shape each path's kind declares, for the doors that read a value from outside. */
  private readonly _declaredShapes = new Map<string, MdyValueShape>();
  /** The values each option-shaped path offers, so a stored value can be held to the list. */
  private readonly _declaredOptions = new Map<string, readonly unknown[]>();

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
   * implemented `createScope` yet). Draft/history/async-validator effects
   * register with it
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
   * effects/timers stop.
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
    this._diagnostics = options?.diagnostics;
    this._security = assertSecurityPolicy(options?.security);
    this._deactivated = options?.autoActivate === false;
    this._scope = _rx.createScope?.({ debugName: "modyra:form" });
    const hasDraft = _rx.signal(false);
    this.hasDraft = hasDraft.asReadonly();
    this._draftManager = new MdyDraftManager({
      rx: _rx,
      getValue: () => this.value(),
      patchValue: (value) => this.restoreValue(value),
      hasDraft,
      warn: (message, code) => this._warn(message, code),
      // Asked for on every read and write rather than copied: a collection's rows declare their
      // cells when the user creates them, so a set taken once knows about none of them.
      secretPaths: () => this._sensitivePaths,
      filterRestoredEntry: (key, value) => this._draftEntryAllowed(key, value),
      // Which form this is, as the paths it was built with: a draft belongs to a shape, not to
      // whoever holds the key.
      formShape: () => this.shapeKey(),
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
    this._structure = _rx.signal(0);
    this.fieldNames = _rx.computed(() => {
      this._structure();
      return [...this._fields.keys()];
    });
    this._formValidators = _rx.signal<
      ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>
    >([]);
    this._submitting = _rx.signal(false);
    this._submitCount = _rx.signal(0);
    this._lastSubmitErrors = _rx.signal<ReadonlyArray<MdyFormError>>([]);
    this._submitSnapshot = _rx.signal<Record<string, unknown> | null>(null);

    this.value = _rx.computed(() => {
      const names = this.fieldNames();
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
        this.fieldNames().every((n) => {
          const rec = this._fields.get(n);
          if (!rec) return true;
          return rec.state.interactivity() === "disabled" || rec.state.valid();
        }) && this._crossErrors().length === 0,
    );
    const pending = _rx.computed(() =>
      this.fieldNames().some(n => this._fields.get(n)?.state.pending() ?? false),
    );
    this.state = {
      valid,
      pending,
      submitting: this._submitting,
      submitCount: this._submitCount,
      canSubmit: _rx.computed(() => {
        // A form that has ended cannot send anything: its fields are gone, so `valid()` is the
        // vacuous truth of a form with nothing left to be wrong. Answering `true` here is what let
        // `if (form.state.canSubmit()) send(form.submitValue())` post an empty payload from a
        // teardown path.
        if (this._destroyed) return false;
        if (this._submitting()) return false;
        const mode = this._submitMode();
        if (mode === "valid-only") return valid() && !pending();
        if (mode === "always") return true;
        return false; // manual
      }),
      lastSubmitErrors: this._lastSubmitErrors,
    };
  }

  /**
   * What the form could not do, said once to whoever is listening.
   *
   * The sink first and the console second: a consumer who supplied one asked for these as events,
   * and printing them as well duplicates every degradation into a channel they did not ask for. With
   * no sink the console is the only way it reaches anyone, which is why it stays the fallback.
   */
  private _warn(message: string, code = MDY_ADAPTER_CONTRACT_VIOLATION): void {
    if (this._diagnostics) {
      this._diagnostics.report({ code, severity: "warning", message });
      return;
    }
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
      // It adds to whatever is already waiting: a path can hold live claims and waiting ones at once,
      // when one control bound before the row existed and another after, and a count that replaced
      // instead of adding lost the earlier control — releasing one then emptied the path while a
      // control was still bound, and its bindings went with it.
      this._pendingClaims.set(name, (this._pendingClaims.get(name) ?? 0) + count);
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
    for (const prefix of ancestorsOf(name)) {
      if (this._gates.get(prefix)?.isOpen) return true;
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
    if (this._gates.size === 0) return [];
    const covering: Array<[string, MdyPathGate]> = [];
    // The covering prefixes are exactly the path's own ancestors, so they are looked up rather than
    // searched for: a form whose rows each register a gate has as many gates as rows, and scanning
    // them for every path makes every write cost the size of the collection.
    for (const prefix of ancestorsOf(name)) {
      const gate = this._gates.get(prefix);
      if (gate) covering.push([prefix, gate]);
    }
    return covering;
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
    // A control still bound does not stop being bound because the row under it ended. Its claim goes
    // back to waiting — the state ADR 0044 calls a claim waiting for its row — so the next row this
    // path names finds it there, with whatever the control had said about the field: a cell the
    // consumer excluded stayed excluded for the row that arrived next, where deleting the claim let
    // it back into the payload.
    const held = this._claims.get(name);
    if (held !== undefined && held > 0) {
      this._pendingClaims.set(name, (this._pendingClaims.get(name) ?? 0) + held);
    }
    this._claims.delete(name);
    this._owned.delete(name);
    this._destroyField(name);
  }

  private _destroyField(name: string): void {
    const rec = this._fields.get(name);
    if (!rec) return;
    rec.asyncRunner?.destroy();
    this._fields.delete(name);
    this._indexPrefixes(name, false);
    this._rx.untracked(() => this._structure.update((version) => version + 1));
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

  /**
   * A short, stable name for the shape this form has.
   *
   * The paths it was built with, sorted and hashed. It says *which form* a stored draft belongs to:
   * a form whose own shape happens to contain another's — one field more, the rest the same — read
   * the other's draft as its own and replaced it, because "is every stored path one I declare"
   * answers yes for a superset. Two forms are the same form when they have the same shape.
   */
  shapeKey(): string {
    const names = [...(this._baselineFields ?? new Set(this._initialValues.keys()))].sort();
    let hash = 0x811c9dc5;
    for (const name of names) {
      for (let index = 0; index < name.length; index += 1) {
        hash ^= name.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      hash ^= 0x2e;
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Records which paths the form holds now as the ones it started with.
   *
   * Called when the form is built and whenever the current value becomes the baseline. What existed
   * at that moment is the baseline's shape; what appears later — a row a user added — is a change
   * whatever its cells hold.
   */
  markBaseline(): void {
    this._baselineFields = new Set([...this._fields.keys(), ...this._initialValues.keys()]);
  }

  /**
   * Adds a path to the baseline's shape, for a consumer declaring what that path started as.
   *
   * The subtree with it: a baseline declared on a collection is a statement about the rows it holds,
   * and a consumer naming the level they can write — the collection — means the rows a user made
   * under it are the ones the form now starts from.
   */
  noteBaseline(name: string): void {
    if (this._baselineFields === null) return;
    this._baselineFields.add(name);
    if (!this._hasFieldsUnder(name)) return;
    for (const held of this._fields.keys()) {
      if (held.startsWith(`${name}.`)) this._baselineFields.add(held);
    }
  }

  setInitialValue(name: string, value: unknown): void {
    // A path may name an ancestor. A collection's keys are data — a row the user added has a path
    // nobody could have written down — so a caller who can only name leaves can never move the
    // baseline of what a user built. Naming the collection moves every cell under it, reading each
    // one's own current value, which is what "this is where we start from now" means for a subtree.
    //
    // The same question `exclude` answers for drafts, and the same answer: a name that is an
    // ancestor is about everything beneath it.
    const under = this._hasFieldsUnder(name)
      ? [...this._fields.keys()].filter((path) => path.startsWith(`${name}.`))
      : [];
    if (under.length > 0) {
      // Descendants first, and whether or not a field exists at this path itself: a collection
      // carries a phantom field at its own path for collection-level errors, and asking whether one
      // is there answered "leaf" for the very level a consumer reaches for — the collection, which
      // is the one name they can write without knowing what the user created.
      for (const path of under) {
        this.setInitialValue(path, this._rx.untracked(() => this._fields.get(path)!.state.value()));
      }
      return;
    }
    assertBaseline(name, this._initialValues.get(name), value);
    // Sanitized here so `reset()` and `getChanges()` compare against the value the field actually
    // holds — and the record is written with the value as it arrived, because the signal sanitizes
    // every write of its own.
    //
    // Handing the sanitized value down instead ran the sanitizer twice, which was written off as
    // harmless on the grounds that a sanitizer is idempotent. DOMPurify is; escaping is not, and
    // escaping is what a text sanitizer does. Every door that writes *through* a collection goes
    // this way — a server response, a loaded record, a row added — so four load-and-save rounds with
    // nobody touching the field turned `Tom & Jerry` into `Tom &amp;amp;amp; Jerry`, with no moment
    // at which anyone got it wrong.
    this._initialValues.set(name, this._applySecurity(name, value));
    const rec = this._fields.get(name);
    if (rec === undefined) return;
    // Only when it is not already what the field holds. Re-baselining a collection hands each
    // descendant the value it is already holding, and writing it back runs the sanitizer over an
    // output of the sanitizer — which is a second escape, not a repeat of the first.
    if (!Object.is(this._rx.untracked(() => rec.state.value()), value)) {
      rec.state.value.set(value);
    }
  }

  /**
   * What a control says about the entry it is holding, when the two disagree.
   *
   * The control is the only thing that knows: the form holds a value its own rules accept — often
   * `null`, which nothing objects to — while the person is looking at text the control could not
   * read. Reported here, the form counts it, so a verdict a person can see is one the submit can.
   */
  reportEntry(name: string, problem: string | null): void {
    const rec = this._fields.get(name) ?? this._detachedFields.get(name);
    if (!rec) return;
    if (rec.entryProblem() !== problem) rec.entryProblem.set(problem);
  }

  markSensitive(name: string): void {
    this._sensitivePaths.add(name);
  }

  declareShape(name: string, shape: MdyValueShape): void {
    this._declaredShapes.set(name, shape);
  }

  declareOptions(name: string, options: readonly unknown[]): void {
    this._declaredOptions.set(name, options);
  }

  /**
   * The paths the schema declared as secrets, for whoever would otherwise copy their values out.
   *
   * Read by the devtools panel, which has no other way to know: its name heuristic is a guess in
   * both directions, and a declaration is the one statement that is not.
   */
  sensitivePaths(): readonly string[] {
    return [...this._sensitivePaths];
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
    // A name nobody declared creates a record nothing renders and nothing submits, so the binding is
    // held against a field that does not exist. A typo in a path that came from data — a document, a
    // rule, a saved layout — otherwise looks exactly like a control the form chose not to disable.
    if (MDY_DEV && !this._fields.has(name) && !this._initialValues.has(name) && !this._gatesOver(name).length) {
      this._warn(`setDisabled on "${name}": this form declares no such field, so the binding reaches nothing.`);
    }
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
    // Held against the path as well as on the record, because the path may name something that has
    // no value of its own — a group, a collection, a row — and what is said about it is answered by
    // the fields inside it.
    this._bind(name, { inactive });
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
    // Whether the baseline had the path travels with the rest: a row renamed is the row the form
    // started with under another key, and a key is not a change of value. A row the baseline never
    // had stays new under either key.
    if (this._baselineFields !== null) {
      for (const [from, to] of pairs) {
        if (this._baselineFields.delete(from)) this._baselineFields.add(to);
      }
    }
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
    this._rx.untracked(() => this._structure.update((version) => version + 1));
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

  /**
   * What the paths above `name` say about it.
   *
   * `setDisabled("billing")` names a group, a collection or a row — something the schema declares and
   * no value belongs to — and it used to reach nothing: only a leaf was ever honoured, so a consumer
   * excluding a whole section watched it stay editable and stay in the payload, with nothing said.
   *
   * The semantics are not new. `group(children, { when })` already takes a section out of play with
   * everything inside it; this gives the imperative door the answer the declarative one has. Composed
   * on read rather than pushed down, so a row declared after the sentence was spoken is covered by it
   * — which is the half a one-time walk over today's fields would miss.
   */
  private _outerVerdict(name: string): MdyInteractivity {
    let readonly = false;
    let cut = name.lastIndexOf(".");
    while (cut > 0) {
      const ancestor = name.slice(0, cut);
      const binding = this._bindings.get(ancestor);
      if (binding?.disabled?.() || binding?.inactive?.()) return "disabled";
      if (binding?.readonly?.()) readonly = true;
      cut = ancestor.lastIndexOf(".");
    }
    return readonly ? "readonly" : "enabled";
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
    this.fieldNames();
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
      this.fieldNames();
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
    for (const [key, val] of inPathOrder(partial)) {
      if (!this._offerToGate(key, val)) continue;
      const rec = this._getOrCreate(key);
      rec.state.value.set(val);
    }
  }

  setValue(value: Record<string, unknown>): void {
    assertWholeValue(value, "setValue");
    for (const [key, val] of inPathOrder(value)) {
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
    // A field the schema calls sensitive is withheld whether or not the call names it: `exclude` is a
    // list the application passes when it creates the form, and a document that marks a field secret
    // has no way to reach it. The manager asks for the declarations on every read and write rather
    // than being handed them here, because a collection's rows declare their cells later — and it
    // matches them by path, where `exclude` matches a bare name wherever it appears.
    this._draftManager.enableDraft(options);
    // A restored draft is the state the form opens in, not a step away from one. Recorded as a step,
    // the first thing a person is offered to undo is something they did not do — and taking the
    // offer writes the empty form back over the draft, because the draft follows the model. What
    // would recover it is a redo, which lives in the tab.
    //
    // History only: the restored edits are still changes against the values the form was built with,
    // so `getChanges()` and a PATCH built from it keep reporting them. What moves is where undo ends.
    if (this._rx.untracked(() => this.hasDraft())) this._historyManager.rebaseline();
  }

  /**
   * Removes the stored draft (also called after an error-free submit).
   *
   * And moves the baseline, which is the half the guide documents and the half a caller reaches for
   * it for: a consumer who has just saved, or has decided the draft is stale, wants the form to stop
   * calling the current values changes. Without it `getChanges()` still reported every edited field,
   * so a `PATCH` built from it sent exactly what the caller had decided to discard.
   */
  clearDraft(): void {
    this._draftManager.clearDraft();
    this.rebaselineToCurrentValue();
  }

  /**
   * Makes the value the form holds now the one it started from.
   *
   * Two deliberate acts arrive at the same state: a draft written into a fresh form, and a draft
   * discarded on purpose. Neither is a change a person made, so neither belongs in what `getChanges()`
   * reports or in what an undo would take back.
   */
  rebaselineToCurrentValue(): void {
    this._rx.untracked(() => {
      for (const [name, rec] of this._fields) {
        this.setInitialValue(name, rec.state.value());
      }
    });
    // The shape too: the rows the form holds now are the rows it started with.
    this.markBaseline();
    this._historyManager.rebaseline();
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
   * when it reports the capability (none do yet); works
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
      assertFinished(fn());
      return;
    }
    this._mutating = true;
    let returned: unknown;
    try {
      returned = hasBatchingCapability(this._rx) ? this._rx.batch(fn) : fn();
    } finally {
      this._mutating = false;
      this._historyManager.recordNow();
    }
    // Read after the callback returns, not inside a `catch`: a callback that waits does not throw,
    // it *returns* a promise — and an async function that fails after an `await` returns a rejected
    // one rather than raising here. The batch closes when the synchronous part ends, so every write
    // after the first `await` lands outside it and the caller gets exactly the history `mutate`
    // exists to prevent. Nothing on the calling side can see that: `mutate` returns `void`, so
    // awaiting it waits for nothing, and the only symptom is counting undo steps.
    assertFinished(returned);
  }

  /**
   * Minimal patch of the form: only the fields whose current value differs
   * (Object.is) from their declared initial value — ready for an API PATCH.
   *
   * A field out of play is left out, the same rule `submitValue` applies. Both answer the question
   * *what leaves this form*, and a patch built the documented way was carrying exactly the value a
   * submission withholds — a form can hold a value it must not transmit, and the two published ways
   * of reading it disagreed about which value that was. The value is still held and still reported
   * by `getValue`, which is the total read.
   */
  getChanges(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, rec] of this._fields) {
      if (rec.state.interactivity() === "disabled") continue;
      const initial = this._initialValues.has(name)
        ? this._initialValues.get(name)
        : null;
      const current = rec.state.value();
      // A field the baseline never had is a change on its own: the cells of a row a user added carry
      // the values the row arrived with as their declared initial, so nothing about them differs and
      // a patch would have described a form with no such row.
      if (this._baselineFields !== null && !this._baselineFields.has(name)) { out[name] = current; continue; }
      if (!Object.is(initial, current)) out[name] = current;
    }
    return out;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  private _destroyed = false;

  /**
   * The same fact as {@link destroyed}, in a form a computed can watch.
   *
   * Every field's verdict reads it, so a form that ends takes its controls out of play in the same
   * beat. The plain boolean beside it cannot carry that: nothing recomputes when it flips.
   */
  private _endedSignal: MdyWritableSignal<boolean> | null = null;

  private get _ended(): MdyWritableSignal<boolean> {
    return (this._endedSignal ??= this._rx.signal(false));
  }

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
      // Paused, not destroyed: a run already in flight is about the value the form still holds, and
      // its answer is what `activate()` promises to resume onto. Tearing the runner down instead
      // aborted the run, so the promise resolved into a form that stayed `pending` for good and the
      // submit button of a completed form never came back.
      rec.asyncRunner?.pause();
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
    // Before the records go, so each one's verdict recomputes while something still holds it. A
    // control rendered from a handle is on the page after the form ends — an unmount and a teardown
    // are two moments, and between them a person types into a field whose form is over. The write is
    // refused either way; this is what makes the refusal visible instead of leaving an enabled
    // control painting text the form will never hold.
    this._rx.untracked(() => this._ended.set(true));
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
      this._structure.update((version) => version + 1);
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
      this._indexPrefixes(name, true);
      this._rx.untracked(() => this._structure.update((version) => version + 1));
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
    // A declared initial has already been through the sanitizer, in `setInitialValue`, which is what
    // `reset()` and `getChanges()` compare against. Running it again here escaped it a second time —
    // the door every collection row goes through, so a value loaded and saved four times came back
    // as `Tom &amp;amp;amp; Jerry` with nobody having got it wrong at any point.
    const declared = this._initialValues.has(name);
    const initialValue = declared
      ? this._initialValues.get(name)
      : this._rx.untracked(() => this._formValue())?.[name] ?? null;

    const rec = createFieldRecord(
      this._rx,
      declared ? initialValue : this._applySecurity(name, initialValue),
      (v) => [...this._crossErrorsFor(name), ...this._serverErrorsFor(name, v)],
      (v) => this._applySecurity(name, v),
      (message) => this._warn(`"${name}" ${message}`),
      this._rx.computed(() => this._outerVerdict(name)),
      () => this._ended(),
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
    // A declared shape is what the check is for. `null` is not the absence of a declaration — it is
    // what the contract declares for every kind that has no empty of its own — so reading it as
    // "nothing was declared" let an object into a `number`, a `select`, a `datepicker`: the type
    // confusion this check exists to stop, from the least trustworthy input a form has.
    // Wherever a kind declared one, and not only where the initial is `null`: a `daterange` starts at
    // `{start:null,end:null}`, so "an object where an object is declared" accepted any object at all.
    const shape = this._declaredShapes.get(key);
    if (shape !== undefined) {
      if (value === null || (matchesValueShape(shape, value) && offeredHere(this._declaredOptions.get(key), shape, value))) {
        return true;
      }
      this._report({
        kind: "draft-shape",
        path: key,
        detail:
          `Draft entry "${key}" dropped: stored value shape does not match ` +
          `the field's declared type (${shape}).`,
      });
      return false;
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
      .map(e => ({ kind: e.kind, message: e.message, payload: e.payload, origin: "cross-field" as const }));
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
      // The origin is this form's own knowledge — it arrived from a submit — and it is not the word
      // the payload chose: a refusal calling itself `validation` is otherwise printed exactly like a
      // rule this form ran, in the one tool built to say where things come from.
      .map(e => ({ kind: e.kind, message: e.message, payload: e.payload, origin: "server" as const }));
  }

  /** Lazily creates the effect that runs async validators for a field. */
  private _ensureAsyncRunner(name: string, rec: FieldRecord): void {
    if (this._destroyed || this._deactivated || rec.asyncRunner) return;
    if (!reactivityRunsEffects(this._rx)) {
      // Reported whether or not this is a development build: a check that is not running is not a
      // development-time nicety, and a consumer holding a sink asked to be told in production too.
      this._warn(
        `Async validators for "${name}" need an effect-capable reactivity ` +
        "— see your reactivity adapter for how to provide one.",
        MDY_ASYNC_FEATURE_DISABLED,
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
        warn: (message) => this._warn(`Field "${name}": ${message}`),
      },
      this._scope,
    );
  }
}
