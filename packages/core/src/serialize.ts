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
const TOO_DEEP = "[Too deep]";

/** What a member read answers with when reading it raised. */
const UNREADABLE = Symbol("modyra:unreadable-member");

/** Reads one member of somebody else's object without letting an accessor decide the outcome. */
function readMember(value: object, key: string): unknown {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return UNREADABLE;
  }
}

/** The shortest true thing that can be said about a thrown value. */
function describeThrow(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

/**
 * How deep a value is walked before it is described instead.
 *
 * Every other walk in this library has a ceiling — a path is 512 characters, an expression is 32
 * levels, a declaration walk is 100 000 nodes — and the one without one was the walk whose entire
 * promise is that reading a form's value never fails. It did not take a hostile value to reach the
 * stack limit: a recursive structure from an API, a linked list, a tree an editor built. Described
 * rather than thrown, like `[Circular]` beside it.
 */
const MAX_DEPTH = 512;

function serialize(value: unknown, seen: Set<object>, depth = 0): unknown {
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

  // The same reason as `File`, one collection at a time: none of these carries its contents in its
  // own enumerable properties, so passing them through wrote `{}` — what a field nobody filled in
  // looks like. Somebody opens the panel to find out why a form is wrong; a `Map` holding entries
  // reading the same as an empty field is the panel answering a different question than the one
  // asked.
  if (value instanceof Map) return `[Map: ${value.size} ${value.size === 1 ? "entry" : "entries"}]`;
  if (value instanceof Set) return `[Set: ${value.size} ${value.size === 1 ? "member" : "members"}]`;
  if (value instanceof Error) return `[${value.name}: ${value.message}]`;

  if (seen.has(value)) return CIRCULAR;
  if (depth >= MAX_DEPTH) return TOO_DEEP;
  seen.add(value);
  try {
    // Every read below is a read of somebody else's object. A getter can throw, a `toJSON` can
    // fail, a Proxy can refuse to be enumerated — and this function exists so that reading a form's
    // value is never the thing that fails. A value it cannot read is described, like the ones it
    // cannot carry: the panel stays readable, which is the whole point of it, and the description
    // says which member it stopped at instead of leaving a stack trace where a value should be.
    const toJson = readMember(value, "toJSON");
    if (toJson === UNREADABLE) return `[Unreadable: toJSON]`;
    if (typeof toJson === "function") {
      // What it returns may itself need describing — a `toJSON` returning an object with a File in
      // it is unusual but not wrong.
      let produced: unknown;
      try {
        produced = (toJson as () => unknown).call(value);
      } catch (error) {
        return `[Unreadable: toJSON threw ${describeThrow(error)}]`;
      }
      return serialize(produced, seen, depth + 1);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => serialize(entry, seen, depth + 1));
    }

    const result: Record<string, unknown> = {};
    let keys: string[];
    try {
      // Keys rather than entries: `Object.entries` *reads* every member, so one accessor that throws
      // would lose the whole object where only that member is unreadable.
      keys = Object.keys(value);
    } catch (error) {
      // A Proxy refusing `ownKeys`, or an exotic object whose enumeration raises. There is nothing
      // to walk, and what it is is still worth saying.
      return `[Unreadable: ${describeThrow(error)}]`;
    }
    for (const key of keys) {
      const entry = readMember(value, key);
      result[key] = entry === UNREADABLE ? `[Unreadable: ${key}]` : serialize(entry, seen, depth + 1);
    }
    return result;
  } finally {
    // Left behind on the way up: the same object appearing twice as a *sibling* is repetition, not a
    // cycle, and describing the second one as circular would be a lie.
    seen.delete(value);
  }
}
