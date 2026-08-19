/**
 * Draft persistence manager.
 *
 * Encapsulates the storage, serialization, debounced writes and restore logic
 * previously embedded in {@link MdyFormEngine}. The form engine owns one
 * instance and delegates `enableDraft` / `clearDraft` to it.
 */

import type {
  MdyEffectRef,
  MdyReactivity,
  MdyReactiveScope,
  MdyWritableSignal,
} from "./reactivity-contract.js";
import { reactivityRunsEffects } from "./reactivity-contract.js";
import { isSafeFieldPath } from "./path-utils.js";
import { MDY_DEV } from "./dev-flags.js";
import { isRecord } from "./record-utils.js";
import { MDY_DRAFT_KEY_IN_USE } from "./reactivity-diagnostics.js";

/** Pluggable storage for {@link MdyDraftManager.enableDraft}. */
export interface MdyDraftStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * The storage a browser already has.
 *
 * `localStorage` and `sessionStorage` speak `getItem`/`setItem`/`removeItem`, and the draft guide
 * names `localStorage` as the default — so a consumer wanting a different key prefix, a session
 * instead of a local, or a wrapper that counts writes reaches for exactly this object. Declared here
 * so the option can take it rather than failing on the first read with the name of a private field.
 */
export interface MdyWebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MdyDraftOptions {
  /** Storage key the draft is persisted under. */
  readonly key: string;
  /**
   * Defaults to `localStorage` (inert when unavailable: SSR, Node).
   *
   * Either shape: this package's `{read, write, remove}`, or the platform's own
   * `{getItem, setItem, removeItem}` — `window.localStorage` and `window.sessionStorage` are taken
   * as they are.
   */
  readonly storage?: MdyDraftStorage | MdyWebStorageLike;
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
  if (!isRecord(parsed)) return false;
  const draft = parsed["__mdyDraft"];
  const value = parsed["value"];
  return typeof draft === "number" && isRecord(value);
}

/**
 * How far ahead of this clock a stamp may be and still be believed.
 *
 * Two machines rarely agree to the millisecond, and a draft written on one and read on another is
 * the ordinary case — so a stamp a little in the future is a clock, not a claim. Far in the future is
 * a claim, and the only thing it can buy is an expiry that never arrives.
 */
const MDY_DRAFT_CLOCK_SKEW_MS = 5 * 60_000;

/**
 * Whether an envelope is young enough to restore.
 *
 * `ttlMs` asks *how old is this*, and the answer comes from the envelope, which is written where
 * anything on the origin can write. A stamp that is missing, is not a number, or sits further ahead
 * than a clock can explain answers nothing — and a question with no answer is not answered with the
 * one that opens: an expiry a draft can opt out of by lying is not an expiry.
 */
function withinAge(savedAt: unknown, ttlMs: number): boolean {
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return false;
  const age = Date.now() - savedAt;
  if (age < -MDY_DRAFT_CLOCK_SKEW_MS) return false;
  return age <= ttlMs;
}

/**
 * The storage this manager will use, whichever of the two shapes it was handed.
 *
 * The guide names `localStorage` as the default, so the object a reader reaches for is the platform's
 * own — and the option took a different shape without saying so: the first read threw
 * `this._storage.read is not a function`, which names a private field, from a stack inside the
 * engine, about an argument the caller passed. A shape this package can adapt is adapted; a shape it
 * cannot is refused where it arrives, naming what was expected.
 */
function asDraftStorage(given: MdyDraftStorage | MdyWebStorageLike): MdyDraftStorage {
  const candidate = given as Partial<MdyDraftStorage> & Partial<MdyWebStorageLike>;
  if (
    typeof candidate.read === "function"
    && typeof candidate.write === "function"
    && typeof candidate.remove === "function"
  ) {
    return given as MdyDraftStorage;
  }
  if (
    typeof candidate.getItem === "function"
    && typeof candidate.setItem === "function"
    && typeof candidate.removeItem === "function"
  ) {
    const web = given as MdyWebStorageLike;
    return {
      // Bound to the object they came from: a Web Storage method called detached throws
      // `Illegal invocation`, which is the same failure one layer further in.
      read: (key) => web.getItem(key),
      write: (key, value) => web.setItem(key, value),
      remove: (key) => web.removeItem(key),
    };
  }
  throw new Error(
    "[modyra] draft.storage must be { read, write, remove } — or a Web Storage such as "
    + "`localStorage`, which is taken as it is. Received an object with: "
    + `${Object.keys(candidate).length > 0 ? Object.keys(candidate).join(", ") : "no usable members"}.`,
  );
}

/**
 * Default browser storage — inert when `localStorage` is unavailable or
 * blocked (SSR, Node, sandboxed iframes, browsers that throw SecurityError
 * on access when cookies/site data are disabled).
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

/**
 * True for values that must never enter a draft: binary payloads
 * (`File`/`Blob`/`FileList`) and `BigInt`, whose JSON round-trip would
 * silently change the restored type.
 */
function isDraftUnsafeLeaf(value: unknown): boolean {
  if (typeof value === "bigint") return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true; // File extends Blob
  if (typeof FileList !== "undefined" && value instanceof FileList) return true;
  return false;
}

/** True when the value is (or contains) a draft-unsafe leaf (see above). */
function containsFile(value: unknown): boolean {
  if (value === null) return false;
  if (isDraftUnsafeLeaf(value)) return true;
  if (typeof value === "object") {
    return containsFileInner(value, new WeakSet<object>());
  }
  return false;
}

function containsFileInner(value: unknown, seen: WeakSet<object>): boolean {
  if (value === null) return false;
  if (isDraftUnsafeLeaf(value)) return true;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some(item => containsFileInner(item, seen));
  }
  return Object.values(value).some(item =>
    containsFileInner(item, seen),
  );
}

interface DraftManagerDeps {
  readonly rx: MdyReactivity;
  readonly getValue: () => Record<string, unknown>;
  readonly patchValue: (value: Record<string, unknown>) => void;
  readonly hasDraft: MdyWritableSignal<boolean>;
  readonly warn: (message: string, code?: string) => void;
  /**
   * Extra always-on gate for restored entries (draft shape validation).
   * Return false to drop the entry.
   */
  readonly filterRestoredEntry?: (key: string, value: unknown) => boolean;
  /**
   * Form-owned scope (when the reactivity adapter provides one). The draft
   * effect registers with it so destroying the scope tears the effect down
   * too — a backstop alongside the explicit {@link MdyDraftManager.destroy}
   * call, per piano-modyra-reactivity-adapter-api.md §5.
   */
  readonly scope?: MdyReactiveScope;
  /**
   * True while the owning {@link import("./form-engine.js").MdyFormEngine}
   * is deactivated (constructed with `autoActivate: false`, or paused via
   * `deactivate()`) — see piano §10.5. While true, `enableDraft()` only
   * records the config: it defers reading storage, restoring a value and
   * starting the write effect until `resume()` — construction must stay
   * pure and storage-free (SSR-safe) until activation.
   */
  readonly isDeactivated: () => boolean;
}

/**
 * Manages draft persistence for a single form instance.
 */
/**
 * Whether a draft entry is one the form said never to persist.
 *
 * `exclude` began as a set of exact leaf paths, which answers for a field at the top of a form and
 * for nothing else. The guide's own example is a card number, card numbers live in a list, and a row
 * key is data — so the only spelling that worked, `cards.a.pan`, is the one nobody can write before
 * the user has added the row. A consumer following the instruction correctly still persisted the
 * secret, and everything about the form afterwards looked right.
 *
 * Four spellings answer now, and the reason they all do is that this is a promise about a secret:
 * an entry excluded by mistake is a convenience lost, and an entry persisted by mistake is a card
 * number in plain text that survives a logout. The direction to be generous in is not in question.
 *
 * - the exact path, as before
 * - an ancestor: `cards` excludes everything under `cards.`
 * - a pattern: `*` stands for exactly one segment, so `cards.*.pan` is that cell in every row
 * - a bare name: `pan` — no dot — excludes any cell called `pan`, wherever it is
 */
function draftPathExcluded(path: string, patterns: ReadonlySet<string>): boolean {
  if (patterns.size === 0) return false;
  const segments = path.split(".");
  for (const pattern of patterns) {
    if (pattern === path) return true;
    if (path.startsWith(`${pattern}.`)) return true;
    if (!pattern.includes(".")) {
      if (segments[segments.length - 1] === pattern) return true;
      continue;
    }
    if (!pattern.includes("*")) continue;
    const wanted = pattern.split(".");
    // A pattern may name a subtree as well as a leaf: `cards.*` covers `cards.a.pan`.
    if (wanted.length > segments.length) continue;
    if (wanted.every((segment, index) => segment === "*" || segment === segments[index])) return true;
  }
  return false;
}


export class MdyDraftManager {
  private readonly _rx: MdyReactivity;
  private readonly _getValue: () => Record<string, unknown>;
  private readonly _patchValue: (value: Record<string, unknown>) => void;
  private readonly _hasDraft: MdyWritableSignal<boolean>;
  private readonly _warn: (message: string, code?: string) => void;
  /** The stamp this form last wrote, so a stamp it did not write is recognisable as another writer's. */
  private _lastStamp: number | null = null;
  private readonly _filterRestoredEntry:
    | ((key: string, value: unknown) => boolean)
    | undefined;
  private readonly _scope: MdyReactiveScope | undefined;
  private readonly _isDeactivated: () => boolean;
  /** Config from enableDraft(), recorded but not yet started (deactivated at the time). */
  private _pendingOptions: MdyDraftOptions | null = null;
  /** True once `_start()` has run at least once — resume() then just restarts the effect. */
  private _hasStarted = false;

  /** True once this form has refused to replace a draft describing a form that is not it. */
  private _refusedForeign = false;
  private _key: string | null = null;
  private _storage: MdyDraftStorage | null = null;
  private _effect: MdyEffectRef | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _exclude: ReadonlySet<string> = new Set();
  private _version = 1;
  private _debounceMs = 400;
  /** Serialized value at enable time — a pristine form writes no draft. */
  private _baseline: string | null = null;
  private _lastWritten: string | null = null;

  constructor(deps: DraftManagerDeps) {
    this._rx = deps.rx;
    this._getValue = deps.getValue;
    this._patchValue = deps.patchValue;
    this._hasDraft = deps.hasDraft;
    this._warn = deps.warn;
    this._filterRestoredEntry = deps.filterRestoredEntry;
    this._isDeactivated = deps.isDeactivated;
    this._scope = deps.scope;
  }

  /**
   * Persists the form value under `key` on every (debounced) change and
   * restores an existing draft immediately. The draft is cleared
   * automatically after a submit that reports no errors, or manually via
   * {@link clearDraft}. `File` values are skipped (not serializable).
   */
  enableDraft(options: MdyDraftOptions): void {
    if (this._effect || this._pendingOptions) return;
    if (!reactivityRunsEffects(this._rx)) {
      if (MDY_DEV) this._warn(
        "enableDraft() needs an effect-capable reactivity " +
        "— see your reactivity adapter for how to provide one.",
      );
      return;
    }
    if (this._isDeactivated()) {
      // Construction must stay pure and storage-free until activation
      // (piano §10.5/§10.7) — record the config, do nothing else yet.
      this._pendingOptions = options;
      return;
    }
    this._start(options);
  }

  private _start(options: MdyDraftOptions): void {
    this._key = options.key;
    this._storage = options.storage === undefined
      ? localStorageDraftStorage()
      : asDraftStorage(options.storage);
    this._exclude = new Set(options.exclude ?? []);
    this._version = options.version ?? 1;
    this._debounceMs = options.debounceMs ?? 400;

    // Restore an existing draft before recording starts.
    // A storage that refuses to be read is a draft that is not there. Safari in private browsing
    // throws on access, an enterprise policy throws, a blocked third-party context throws — and a
    // draft is an optional convenience, so failing to read one means there is no draft, never that
    // there is no form. The write side has always been swallowed for the same reason.
    let stored: string | null = null;
    try {
      stored = this._storage.read(this._key);
    } catch (error) {
      if (MDY_DEV) {
        this._warn(
          `Draft storage could not be read (${error instanceof Error ? error.message : String(error)}). ` +
          "The form opens without a draft.",
        );
      }
    }
    if (stored !== null) {
      const value = this._parse(stored, options.ttlMs);
      if (value !== null) {
        // Stored drafts are untrusted input: drop excluded keys, any
        // reserved/empty path segment (__proto__ etc.) — instead of letting
        // field creation throw mid-restore — and entries that fail the
        // engine's shape validation (tampered storage).
        this._patchValue(
          Object.fromEntries(
            Object.entries(value).filter(
              ([k, v]) =>
                !draftPathExcluded(k, this._exclude) &&
                isSafeFieldPath(k) &&
                (this._filterRestoredEntry?.(k, v) ?? true),
            ),
          ),
        );
        this._hasDraft.set(true);
        this._lastWritten = this._serialize(value) ?? null;
      } else {
        this._storage.remove(this._key);
      }
    }
    this._baseline = this._serialize(
      this._rx.untracked(() => this._getValue()),
    ) ?? null;

    this._hasStarted = true;
    this._startEffect();
  }

  private _startEffect(): void {
    this._effect = this._rx.effect((onCleanup) => {
      const current = this._getValue();
      this._rx.untracked(() => {
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
          this._timer = null;
          this._write(current);
        }, this._debounceMs);
      });
      onCleanup(() => {
        if (this._timer !== null) {
          clearTimeout(this._timer);
          this._timer = null;
        }
      });
    }, { scope: this._scope, debugName: "modyra:draft" });
  }

  /**
   * Stops the write effect and its pending debounce timer without losing
   * any state (key/storage/baseline/hasDraft) — `resume()` restarts it
   * exactly where it left off. Called by the owning form's `deactivate()`.
   */
  pause(): void {
    this._effect?.destroy();
    this._effect = null;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Restarts what `pause()` stopped, or performs the deferred first start
   * if `enableDraft()` was called while deactivated. A no-op if draft was
   * never enabled, or is already running. Called by the owning form's
   * `activate()`.
   */
  resume(): void {
    if (this._effect) return;
    if (this._pendingOptions) {
      const options = this._pendingOptions;
      this._pendingOptions = null;
      this._start(options);
      return;
    }
    if (this._hasStarted) this._startEffect();
  }

  /** Removes the stored draft (also called after an error-free submit). */
  clearDraft(): void {
    if (this._key && this._storage) {
      // Same rule as reading it: a storage that will not remove an entry is not the caller's problem
      // to catch. What `clearDraft` promises about the *form* — the baseline moves, the draft is no
      // longer offered — holds whether or not the entry could be deleted.
      try {
        this._storage.remove(this._key);
      } catch (error) {
        if (MDY_DEV) {
          this._warn(
            `Draft storage could not remove "${this._key}" ` +
            `(${error instanceof Error ? error.message : String(error)}). The form has discarded it either way.`,
          );
        }
      }
    }
    this._hasDraft.set(false);
    this._lastWritten = null;
    // The current (submitted) value becomes the new baseline.
    this._baseline = this._serialize(
      this._rx.untracked(() => this._getValue()),
    ) ?? null;
  }

  /** Releases timers, effects, this form's claim on its draft key, and resets the hasDraft signal. */
  destroy(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._effect?.destroy();
    this._effect = null;
    this._hasDraft.set(false);
  }

  /**
   * Parses a stored draft, returning its value or `null` when it must be
   * discarded (corrupt JSON, version mismatch, expired TTL). Envelope-less
   * payloads written by pre-versioning releases are still accepted.
   */
  private _parse(
    stored: string,
    ttlMs: number | undefined,
  ): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isDraftEnvelope(parsed)) {
        if (parsed.__mdyDraft !== this._version) return null;
        if (ttlMs !== undefined && !withinAge(parsed.savedAt, ttlMs)) return null;
        return parsed.value;
      }
      if (isRecord(parsed)) {
        return parsed; // legacy plain draft
      }
      return null;
    } catch {
      return null;
    }
  }

  private _serialize(value: Record<string, unknown>): string | null {
    const serializable = Object.fromEntries(
      Object.entries(value).filter(
        ([k, v]) => !draftPathExcluded(k, this._exclude) && !containsFile(v),
      ),
    );
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(serializable, (_key, raw) => {
        // BigInt-bearing fields are filtered out before serialization; one
        // surfacing here (e.g. via toJSON) must skip the write, not mutate
        // the restored type to string.
        if (typeof raw === "bigint") {
          throw new TypeError("BigInt is not draft-serializable");
        }
        if (typeof raw === "object" && raw !== null) {
          if (seen.has(raw)) {
            throw new TypeError("Circular reference");
          }
          seen.add(raw);
        }
        return raw;
      });
    } catch {
      if (MDY_DEV) this._warn(
        "Skipped draft write: value is not JSON-serializable (cycle or unsupported type).",
      );
      return null;
    }
  }

  /**
   * What is in storage now, read back before a write replaces it.
   *
   * A draft key identifies the *form*, not the window — that is what makes a draft survive a reload —
   * so two tabs of one form share it by design. The engine defined the envelope, stamps `savedAt` on
   * every save and is the only thing that reads one, and it was writing that stamp without ever
   * comparing it: a tab that had been open a while replaced a draft another view had saved a minute
   * later, and stamped the replacement with the earlier time. The one field a later reader could use
   * to notice said the opposite.
   *
   * Returns the stamp of whatever is there, or null when there is nothing readable — an absent key,
   * a storage that raises, a payload from another writer. None of those is a conflict.
   */
  private _storedStamp(): number | null {
    if (!this._key || !this._storage) return null;
    try {
      const raw = this._storage.read(this._key);
      if (typeof raw !== "string" || raw.length === 0) return null;
      const parsed = JSON.parse(raw) as { savedAt?: unknown };
      return typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
        ? parsed.savedAt
        : null;
    } catch {
      return null;
    }
  }

  /**
   * The paths of a stored envelope this form does not declare.
   *
   * A draft key names one form's work. Two live forms sharing a key is not exotic — a component
   * rendered twice, a route mounting a form beside another, a key copied along with the options it
   * sits in — and the last save takes the whole envelope: one person's typing is gone from the only
   * place it was kept, and reopening their form restores nothing, because the draft under their key
   * now describes fields they do not have.
   *
   * The shape is what tells the two apart. A form re-opened on its own draft, or a second tab of the
   * same form, stores paths this form declares, and replacing that is the intended behaviour. Paths
   * it cannot read back belong to a different form.
   */
  private _foreignPaths(): string[] {
    if (!this._key || !this._storage || !this._filterRestoredEntry) return [];
    let raw: string | null = null;
    try {
      raw = this._storage.read(this._key);
    } catch {
      return [];
    }
    if (typeof raw !== "string" || raw.length === 0) return [];
    let value: unknown;
    try {
      value = (JSON.parse(raw) as { value?: unknown }).value;
    } catch {
      return [];
    }
    if (!isRecord(value)) return [];
    return Object.keys(value).filter(
      (path) =>
        !draftPathExcluded(path, this._exclude) &&
        isSafeFieldPath(path) &&
        !this._filterRestoredEntry!(path, (value as Record<string, unknown>)[path]),
    );
  }

  private _write(value: Record<string, unknown>): void {
    if (!this._key || !this._storage) return;
    const serialized = this._serialize(value);
    if (serialized === null) return;
    // Nothing the user changed → no draft; unchanged → no rewrite.
    if (serialized === this._lastWritten) return;
    if (this._lastWritten === null && serialized === this._baseline) {
      return;
    }
    // A draft describing a form that is not this one is another form's work, and replacing it loses
    // it: what is left behind is a draft neither form can read back. This form keeps no draft of its
    // own rather than take the key, and says so once — a person's every keystroke is not a new
    // event.
    const foreign = this._foreignPaths();
    if (foreign.length > 0) {
      if (!this._refusedForeign) {
        this._refusedForeign = true;
        this._warn(
          `A draft under "${this._key}" holds ${foreign.slice(0, 3).map((path) => `"${path}"`).join(", ")}` +
          `${foreign.length > 3 ? ", …" : ""}, which this form does not declare, so it belongs to another ` +
          "form. This form keeps no draft: saving would replace work nothing could read back. Give each " +
          "form its own key.",
          MDY_DRAFT_KEY_IN_USE,
        );
      }
      return;
    }
    const now = Date.now();
    const stored = this._storedStamp();
    // Someone else wrote since this form last did. The typing in front of the person wins — a draft
    // is a convenience and throwing away what they are writing to keep what they are not is the
    // worse answer — but it is said out loud, and the stamp never goes backwards: the record of when
    // the stored draft was written is the only thing a later reader has.
    const replacing = stored !== null && this._lastStamp !== null && stored > this._lastStamp;
    if (replacing && MDY_DEV) {
      this._warn(
        `A draft under "${this._key}" was saved more recently by something else and has been ` +
        "replaced. A draft key names the form, so two views of it share one — give each view its " +
        "own key if they must not overwrite each other.",
      );
    }
    // Never backwards, and never further ahead than a clock explains. Carrying a stored stamp
    // forward is what stops a draft being replaced by one saved earlier; carrying an *impossible*
    // one forward makes it permanent — every later save inherits it, and an expiry the user can
    // never reach however long they keep typing.
    const believable = stored !== null && stored <= now + MDY_DRAFT_CLOCK_SKEW_MS;
    const savedAt = believable && stored > now ? stored : now;
    // Build the envelope around the already-serialized payload so the value
    // is stringified only once per write.
    const envelope = `{"__mdyDraft":${this._version},"savedAt":${savedAt},"value":${serialized}}`;
    try {
      this._storage.write(this._key, envelope);
      this._lastWritten = serialized;
      this._lastStamp = savedAt;
    } catch {
      // Quota errors and private-mode restrictions must not break the form.
    }
  }
}
