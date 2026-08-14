/**
 * The whole public state of a form, in one comparable value.
 *
 * Everything here is read through the public surface — `getValue`, `submitValue`, `state`,
 * `fieldNames`, `getField`, and a collection's own handle. Nothing reaches into the engine, so a
 * snapshot cannot agree with the implementation by construction.
 *
 * What is normalised and what is not is the point of the file:
 *
 *   - path lists are sorted, because which order a form reports its fields in is not a promise;
 *   - a record's `keys` are **not** sorted, because declaration order is part of its API;
 *   - array order is preserved for the same reason;
 *   - values are encoded, not stringified, so `undefined`, `null` and an absent property stay
 *     distinguishable and a `Date` stays a date.
 */

import { encodeValue, sortedPaths } from "../models/observations.mjs";

/**
 * @param collections  Record handles by path — a collection's keys and validity are readable only
 *                     from its own handle, and the harness knows where they are from the schema spec.
 * @param mounted      Which paths a mount strategy currently holds claimed.
 * @param activeAsyncRuns  Async validator runs the harness has started and not yet settled.
 */
export function canonicalObservation({
  form,
  collections = {},
  mounted = [],
  diagnostics = [],
  activeAsyncRuns = 0,
} = {}) {
  const fieldNames = sortedPaths(form.fieldNames());

  const errors = [];
  const touchedPaths = [];
  const dirtyPaths = [];
  const disabledPaths = [];
  const readonlyPaths = [];

  for (const name of fieldNames) {
    const ref = form.getField(name);
    if (!ref) continue;
    const state = ref();
    for (const error of state.errors()) {
      errors.push({ path: name, kind: error.kind, message: error.message });
    }
    if (state.touched()) touchedPaths.push(name);
    if (state.dirty()) dirtyPaths.push(name);
    if (state.disabled()) disabledPaths.push(name);
    if (state.readonly()) readonlyPaths.push(name);
  }

  const collectionObservations = Object.keys(collections)
    .sort()
    .map((path) => {
      const handle = collections[path];
      // The two kinds answer the same question differently: a keyed collection names its rows, a
      // positional one counts them. Both are reported as the row names a path would carry, so one
      // comparison reads either.
      const keyed = typeof handle.keys === "function";
      return {
        path,
        kind: keyed ? "record" : "array",
        // Declaration order for a record, index order for an array; deliberately unsorted.
        keys: keyed
          ? [...handle.keys()]
          : Array.from({ length: handle.length() }, (_, index) => String(index)),
        valid: handle.valid(),
        errors: handle.errors().map((error) => ({ kind: error.kind, message: error.message })),
      };
    });

  return Object.freeze({
    value: encodeValue(form.getValue(), "value"),
    submittedValue: encodeValue(form.submitValue(), "submittedValue"),
    valid: form.state.valid(),
    pending: form.state.pending(),
    fieldNames: [...fieldNames],
    errors: errors.sort(compareErrors),
    touchedPaths,
    dirtyPaths,
    disabledPaths,
    readonlyPaths,
    collections: collectionObservations,
    activeAsyncRuns,
    mountedPaths: [...sortedPaths(mounted)],
    diagnostics: [...diagnostics],
  });
}

/**
 * The fields that describe how a form was looked at rather than what it holds.
 *
 * A test comparing two mount strategies ignores exactly these and nothing else: a broader exclusion
 * would hide the divergence such a test exists to find.
 */
export const RENDERER_ONLY_FIELDS = Object.freeze(["mountedPaths"]);

/**
 * What two mount strategies are allowed to disagree about.
 *
 * Diagnostics join the list only here: mounting a cell before its row exists is a documented,
 * warned-about thing to do, so a strategy that does it says so and one that does not stays silent.
 * A test using this list owes an explicit assertion about the diagnostics it excluded — dropping
 * them without one is how a real warning stops being read.
 */
export const MOUNT_COMPARISON_FIELDS = Object.freeze([...RENDERER_ONLY_FIELDS, "diagnostics"]);

function compareErrors(a, b) {
  return (
    a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind) || a.message.localeCompare(b.message)
  );
}
