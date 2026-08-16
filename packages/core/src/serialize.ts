/**
 * A form value, as something `JSON.stringify` can carry without losing it.
 *
 * The reason it exists is `File`: a native file has no enumerable own properties, so it stringifies
 * to `{}` — a payload or a devtools panel showing an empty object where the user picked a document.
 * It is described instead.
 *
 * Everything else here follows from that goal rather than from the mechanics. A value that defines
 * `toJSON` has already answered the question this function asks, so its answer is taken: rebuilding
 * such an object property by property would *lose* what plain `JSON.stringify` keeps, which is the
 * opposite of the point — a `Date` would come out `{}`, and so would every domain type that defines
 * `toJSON` to be storable.
 *
 * A value JSON refuses outright — a `BigInt` — is described for the same reason, so that reading a
 * form's value is never the thing that fails.
 *
 * A value that refers back to itself is described rather than walked: a form value is a tree, and a
 * cycle is a mistake to report rather than a stack to exhaust.
 */
export function mdyFormSerialize(value: unknown): unknown {
  return serialize(value, new Set<object>());
}

/** Placeholder for a value already met on the way down — a cycle. */
const CIRCULAR = "[Circular]";

function serialize(value: unknown, seen: Set<object>): unknown {
  // The other value JSON cannot carry, and the loud one: `JSON.stringify` raises
  // `Do not know how to serialize a BigInt` rather than writing something, so a form holding one
  // stops whatever reads it — including the devtools panel, which is what a developer opens
  // precisely when something is already wrong. A form is allowed to hold one: the engine reports a
  // shape it does not expect as a verdict rather than refusing the write, which is what lets a field
  // show what a person typed and say why it is wrong.
  //
  // Described like a File rather than coerced to a number: `10n` and `10` are different values and a
  // reader of a payload should not have to guess which one is in front of them.
  if (typeof value === "bigint") return `[BigInt: ${value.toString()}]`;
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Before `toJSON`: a File has none, and describing it is the reason this function exists. A
  // polyfill that added one would otherwise change what a file looks like in a payload.
  if (typeof File !== "undefined" && value instanceof File) {
    return `[File: ${value.name} (${value.size} bytes)]`;
  }

  if (seen.has(value)) return CIRCULAR;
  seen.add(value);
  try {
    const toJson = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJson === "function") {
      // What it returns may itself need describing — a `toJSON` returning an object with a File in
      // it is unusual but not wrong.
      return serialize((toJson as () => unknown).call(value), seen);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => serialize(entry, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = serialize(entry, seen);
    }
    return result;
  } finally {
    // Left behind on the way up: the same object appearing twice as a *sibling* is repetition, not a
    // cycle, and describing the second one as circular would be a lie.
    seen.delete(value);
  }
}
