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
  MdyWritableSignal,
} from "./reactivity.js";
import { isSafeFieldPath } from "./path-utils.js";
import { MDY_DEV } from "./dev-flags.js";
import { isRecord } from "./record-utils.js";

/** Pluggable storage for {@link MdyDraftManager.enableDraft}. */
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
  readonly warn: (message: string) => void;
  /**
   * Extra always-on gate for restored entries (draft shape validation).
   * Return false to drop the entry.
   */
  readonly filterRestoredEntry?: (key: string, value: unknown) => boolean;
}

/**
 * Manages draft persistence for a single form instance.
 */
export class MdyDraftManager {
  private readonly _rx: MdyReactivity;
  private readonly _getValue: () => Record<string, unknown>;
  private readonly _patchValue: (value: Record<string, unknown>) => void;
  private readonly _hasDraft: MdyWritableSignal<boolean>;
  private readonly _warn: (message: string) => void;
  private readonly _filterRestoredEntry:
    | ((key: string, value: unknown) => boolean)
    | undefined;

  private _key: string | null = null;
  private _storage: MdyDraftStorage | null = null;
  private _effect: MdyEffectRef | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _exclude: ReadonlySet<string> = new Set();
  private _version = 1;
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
  }

  /**
   * Persists the form value under `key` on every (debounced) change and
   * restores an existing draft immediately. The draft is cleared
   * automatically after a submit that reports no errors, or manually via
   * {@link clearDraft}. `File` values are skipped (not serializable).
   */
  enableDraft(options: MdyDraftOptions): void {
    if (this._effect) return;
    if (!this._rx.canEffect) {
      if (MDY_DEV) this._warn(
        "enableDraft() needs an effect-capable reactivity " +
        "(with the Angular adapter: construct it with an Injector).",
      );
      return;
    }
    this._key = options.key;
    this._storage = options.storage ?? localStorageDraftStorage();
    this._exclude = new Set(options.exclude ?? []);
    this._version = options.version ?? 1;
    const debounceMs = options.debounceMs ?? 400;

    // Restore an existing draft before recording starts.
    const stored = this._storage.read(this._key);
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
                !this._exclude.has(k) &&
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

    this._effect = this._rx.effect((onCleanup) => {
      const current = this._getValue();
      this._rx.untracked(() => {
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
          this._timer = null;
          this._write(current);
        }, debounceMs);
      });
      onCleanup(() => {
        if (this._timer !== null) {
          clearTimeout(this._timer);
          this._timer = null;
        }
      });
    });
  }

  /** Removes the stored draft (also called after an error-free submit). */
  clearDraft(): void {
    if (this._key && this._storage) {
      this._storage.remove(this._key);
    }
    this._hasDraft.set(false);
    this._lastWritten = null;
    // The current (submitted) value becomes the new baseline.
    this._baseline = this._serialize(
      this._rx.untracked(() => this._getValue()),
    ) ?? null;
  }

  /** Releases timers and effects and resets the hasDraft signal. */
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
        if (ttlMs !== undefined && Date.now() - parsed.savedAt > ttlMs) {
          return null;
        }
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
        ([k, v]) => !this._exclude.has(k) && !containsFile(v),
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

  private _write(value: Record<string, unknown>): void {
    if (!this._key || !this._storage) return;
    const serialized = this._serialize(value);
    if (serialized === null) return;
    // Nothing the user changed → no draft; unchanged → no rewrite.
    if (serialized === this._lastWritten) return;
    if (this._lastWritten === null && serialized === this._baseline) {
      return;
    }
    // Build the envelope around the already-serialized payload so the value
    // is stringified only once per write.
    const envelope = `{"__mdyDraft":${this._version},"savedAt":${Date.now()},"value":${serialized}}`;
    try {
      this._storage.write(this._key, envelope);
      this._lastWritten = serialized;
    } catch {
      // Quota errors and private-mode restrictions must not break the form.
    }
  }
}