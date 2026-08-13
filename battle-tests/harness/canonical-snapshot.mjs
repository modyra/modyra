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
      return {
        path,
        // Declaration order, deliberately unsorted.
        keys: [...handle.keys()],
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

function compareErrors(a, b) {
  return (
    a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind) || a.message.localeCompare(b.message)
  );
}
