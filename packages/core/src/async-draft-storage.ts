/**
 * A draft storage backed by an asynchronous key/value store.
 *
 * `MdyDraftStorage` is synchronous by design — a field handle writes a draft while the user types,
 * and there is nothing sensible for `read` to return to a caller that cannot wait. React Native's
 * standard storage is Promise-based, so the two do not meet without a cache in between.
 *
 * This is that cache: hydrate once, serve every read and write from memory, flush to the backend in
 * the background. No dependency on any particular store — the backend is passed in, so this works
 * with `@react-native-async-storage/async-storage`, an IndexedDB wrapper, or a test double.
 *
 * Two semantics the shape does not make obvious, both deliberate:
 *
 * **A read before hydration finishes returns `null`** — "no draft", never a stale or partial one.
 * There is no way to block a synchronous read, and returning something wrong is worse than
 * returning nothing: a form would restore a draft that is not the user's. Callers that care must
 * `await storage.ready` before restoring, which is why `ready` exists.
 *
 * **A failed flush is never thrown into the form, and never loses the draft.** The value stays in
 * the cache, so the next write retries it and a read still sees it — the user keeps typing and the
 * draft survives in memory even if the device's storage is full. `onError` is how a caller learns;
 * without one the failure is silent, which matches what the default `localStorage` storage already
 * does with quota errors.
 */
import type { MdyDraftStorage } from "./draft-manager.js";

/** The Promise-based store this adapter caches. The shape `AsyncStorage` already has. */
export interface MdyAsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface MdyAsyncDraftStorageOptions {
  /** The asynchronous store to cache. */
  readonly backend: MdyAsyncKeyValueStore;
  /**
   * Keys to read at startup.
   *
   * A key/value store cannot be enumerated portably, so hydration reads what it is told to. Pass
   * the draft keys the app uses; anything else is treated as absent until it is written.
   */
  readonly keys: readonly string[];
  /**
   * Called when a background flush rejects, with the key and the reason.
   *
   * The draft is kept in the cache regardless. Without this the failure is invisible, which is the
   * same bargain the default storage makes with quota errors.
   */
  readonly onError?: (key: string, error: unknown) => void;
}

export interface MdyAsyncDraftStorage extends MdyDraftStorage {
  /**
   * Resolves when the initial read has finished, successfully or not.
   *
   * Never rejects: a store that cannot be read leaves the cache empty, which reads as "no draft"
   * rather than as an error the form has to handle.
   */
  readonly ready: Promise<void>;
  /** Resolves when every write issued so far has settled. For tests and for teardown. */
  flushed(): Promise<void>;
}

/**
 * Wraps an asynchronous store so drafts can be read and written synchronously.
 *
 * Hydration starts immediately; it does not wait to be awaited.
 */
export function createHydratedDraftStorage(
  options: MdyAsyncDraftStorageOptions,
): MdyAsyncDraftStorage {
  const { backend, keys, onError } = options;
  const cache = new Map<string, string>();
  /**
   * Keys the consumer removed while hydration was still in flight.
   *
   * An absent cache entry means two different things during hydration — never set, and deliberately
   * discarded — and the arriving value has to be kept in the first case and dropped in the second.
   * Without the distinction a draft the user discarded comes back when the backend answers.
   */
  const discarded = new Set<string>();
  let inFlight: Promise<unknown> = Promise.resolve();

  const report = (key: string, error: unknown): void => {
    // A reporter that throws must not take the form down with it, nor break the flush chain.
    try { onError?.(key, error); } catch { /* the caller's problem, not the form's */ }
  };

  // Each key is read on its own so one unreadable key does not hide the rest.
  const ready = Promise.all(
    keys.map(async (key) => {
      try {
        const value = await backend.getItem(key);
        // Anything the consumer did while the read was in flight is newer than what the store held:
        // a write keeps what was written, and a removal stays removed.
        if (value !== null && !cache.has(key) && !discarded.has(key)) cache.set(key, value);
      } catch (error) {
        report(key, error);
      }
    }),
  ).then(() => undefined);

  /** Queue a background operation, keeping failures off the caller's path. */
  const enqueue = (key: string, run: () => Promise<unknown>): void => {
    inFlight = inFlight.then(run).catch((error: unknown) => { report(key, error); });
  };

  return {
    ready,
    flushed: () => inFlight.then(() => undefined),

    read(key) {
      return cache.get(key) ?? null;
    },

    write(key, value) {
      cache.set(key, value);
      // A write is newer than a removal that preceded it, so the key is a live one again.
      discarded.delete(key);
      enqueue(key, () => backend.setItem(key, value));
    },

    remove(key) {
      cache.delete(key);
      discarded.add(key);
      enqueue(key, () => backend.removeItem(key));
    },
  };
}
