/**
 * Associates a field/array handle with the {@link MdyReactivity} runtime
 * that created its signals.
 *
 * Bindings (React/Preact's `createFieldStore`) must observe a handle
 * through the runtime that actually owns it, never by constructing a
 * fresh, unrelated reactivity instance — that's the cross-runtime
 * observation rule. A `WeakMap` keyed by the handle object
 * (not individual signals) is cheap: one entry per field, not per signal,
 * and it's tagged once at handle-construction time in `typed-form.ts`.
 */
import { vanillaReactivity, type MdyReactivity } from "./reactivity.js";
import { MDY_DEV } from "./dev-flags.js";
import { MdyCrossRuntimeObservationError } from "./reactivity-errors.js";
import { MDY_CROSS_RUNTIME_OBSERVATION, type MdyDiagnostics } from "./reactivity-diagnostics.js";

/**
 * The two registries, shared across every copy of this package in one realm.
 *
 * A module-level `WeakMap` is per module *instance*. Two copies of `@modyra/core` in one dependency
 * tree — what a package manager builds whenever two dependents need versions it cannot deduplicate,
 * the ordinary state of a tree partway through an upgrade — are two registries, and a handle
 * registered in one is unknown to the other. `observerFor` reports only when it can see an owner
 * that differs from the runtime it was handed, so an unknown handle is a handle it says nothing
 * about: the guard turns itself off in exactly the tree it exists for.
 *
 * A registry keyed by a global symbol is one registry however many copies are loaded. It is scoped
 * to the realm, so a worker or a second document has its own — which is correct, since a handle
 * cannot cross a realm either.
 *
 * Read defensively: another copy may be a version whose registry has a different shape, and one that
 * does not carry both maps is not used rather than trusted.
 */
const REGISTRY = Symbol.for("modyra.handle-registry");

interface HandleRegistry {
  readonly owners: WeakMap<object, MdyReactivity>;
  readonly forms: WeakMap<object, object>;
}

const registry = ((): HandleRegistry => {
  const host = globalThis as Record<symbol, unknown>;
  const held = host[REGISTRY] as Partial<HandleRegistry> | undefined;
  if (held?.owners instanceof WeakMap && held.forms instanceof WeakMap) return held as HandleRegistry;
  const fresh: HandleRegistry = { owners: new WeakMap(), forms: new WeakMap() };
  host[REGISTRY] = fresh;
  return fresh;
})();

const HANDLE_OWNERS = registry.owners;

/**
 * Which form a handle came from.
 *
 * A handle names a path, and a path means nothing without the form that holds it: two forms on one
 * page share every path they have in common. A binding handed a handle must read the field that
 * handle belongs to, not the one whose element happens to enclose the control — otherwise what the
 * user types lands in the wrong form, and nothing says so.
 */
const HANDLE_FORMS = registry.forms;

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

/**
 * The runtime a caller should observe `handle` through.
 *
 * Every consumer that is handed a handle faces the same question and answered it the same wrong way:
 * build a fresh `vanillaReactivity()`. That works by accident — vanilla's tracking is global to the
 * module — and stops working the moment the handle belongs to another adapter's form, silently,
 * because nothing re-renders and nothing complains. The registry above is the answer; this is the
 * one place that reads it, so a caller no longer has to know that it should.
 *
 * A runtime passed in explicitly is honoured, not replaced: a caller that means it keeps its
 * scheduling, and overriding it here would hide the mistake rather than report it. What happens
 * instead is that the mismatch is *named* — `MdyCrossRuntimeObservationError` has existed since this
 * defect was first diagnosed and had never been constructed by anything.
 */
export function observerFor(
  handle: object,
  requested?: MdyReactivity,
  diagnostics?: MdyDiagnostics,
): MdyReactivity {
  const owner = getFieldHandleOwner(handle);
  if (requested === undefined) return owner ?? vanillaReactivity();

  if (MDY_DEV && owner !== undefined && owner !== requested) {
    const error = new MdyCrossRuntimeObservationError(
      requested.kind ?? "unknown",
      owner.kind ?? "unknown",
    );
    if (diagnostics) {
      diagnostics.report({
        code: MDY_CROSS_RUNTIME_OBSERVATION,
        severity: "error",
        message: error.message,
      });
    } else {
      console.warn(error.message);
    }
  }
  return requested;
}
