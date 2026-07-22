/**
 * Associates a field/array handle with the {@link MdyReactivity} runtime
 * that created its signals — piano-modyra-reactivity-adapter-api.md §7.
 *
 * Bindings (React/Preact's `createFieldStore`) must observe a handle
 * through the runtime that actually owns it, never by constructing a
 * fresh, unrelated reactivity instance — that's the cross-runtime
 * observation bug §10.1 names. A `WeakMap` keyed by the handle object
 * (not individual signals) is cheap: one entry per field, not per signal,
 * and it's tagged once at handle-construction time in `typed-form.ts`.
 */
import type { MdyReactivity } from "./reactivity.js";

const HANDLE_OWNERS = new WeakMap<object, MdyReactivity>();

/** Internal: called by handle factories right after building a handle. */
export function registerHandleOwner(handle: object, rx: MdyReactivity): void {
  HANDLE_OWNERS.set(handle, rx);
}

/**
 * The reactivity runtime that owns `handle`'s signals, if known. `undefined`
 * for a handle that predates this registry or was never tagged (e.g. a
 * hand-built test double) — callers should fall back to their own default
 * rather than treat this as an error.
 */
export function getFieldHandleOwner(handle: object): MdyReactivity | undefined {
  return HANDLE_OWNERS.get(handle);
}
