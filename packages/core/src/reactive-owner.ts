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

/**
 * Which form a handle came from.
 *
 * A handle names a path, and a path means nothing without the form that holds it: two forms on one
 * page share every path they have in common. A binding handed a handle must read the field that
 * handle belongs to, not the one whose element happens to enclose the control — otherwise what the
 * user types lands in the wrong form, and nothing says so.
 */
const HANDLE_FORMS = new WeakMap<object, object>();

/** Internal: called by handle factories right after building a handle. */
export function registerHandleForm(handle: object, form: object): void {
  HANDLE_FORMS.set(handle, form);
}

/**
 * The form that built `handle`, if known. `undefined` for a hand-built handle or one from a version
 * that predates this registry — a caller should fall back to the form it already has rather than
 * treat that as an error.
 */
export function handleFormOf(handle: object): object | undefined {
  return HANDLE_FORMS.get(handle);
}

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
