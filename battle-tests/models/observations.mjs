/**
 * What a form looks like from outside, written down so two of them can be compared.
 *
 * The encoding is deliberate rather than `JSON.stringify`: a comparison that goes through JSON
 * cannot tell `undefined` from an absent property, silently drops a `Date`'s identity, reorders
 * nothing but hides everything, and throws on a cycle instead of reporting where it is. Each of
 * those is a difference a battle test exists to notice.
 *
 * Every non-plain value is encoded as a tagged object, so the difference between "a Date whose time
 * is 0" and "the number 0" survives into the report.
 */

const TAG = "$mdy";

export class BattleHarnessError extends Error {
  constructor(message) {
    super(message);
    this.name = "BattleHarnessError";
  }
}

/**
 * A value as it will be compared and reported.
 *
 * `path` is carried only to name the offender when encoding refuses: a form value holding a
 * function or a cycle is a harness input problem, not a divergence, and must not be reported as one.
 */
export function encodeValue(value, path = "", seen = new Set()) {
  if (value === undefined) return { [TAG]: "undefined" };
  if (value === null) return null;

  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") {
    if (Number.isNaN(value)) return { [TAG]: "number", of: "NaN" };
    if (!Number.isFinite(value)) return { [TAG]: "number", of: value > 0 ? "Infinity" : "-Infinity" };
    if (Object.is(value, -0)) return { [TAG]: "number", of: "-0" };
    return value;
  }
  if (type === "bigint") return { [TAG]: "bigint", of: value.toString() };
  if (type === "symbol") return { [TAG]: "symbol", of: value.description ?? "" };
  if (type === "function") {
    throw new BattleHarnessError(`observation at ${path || "<root>"} holds a function`);
  }

  if (seen.has(value)) {
    throw new BattleHarnessError(`observation at ${path || "<root>"} is cyclic`);
  }
  const next = new Set(seen).add(value);

  if (value instanceof Date) {
    return { [TAG]: "date", iso: Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString() };
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return { [TAG]: "file", name: value.name ?? null, size: value.size, type: value.type };
  }
  if (value instanceof RegExp) return { [TAG]: "regexp", source: value.source, flags: value.flags };
  if (value instanceof Map) {
    return {
      [TAG]: "map",
      entries: [...value.entries()].map(([key, entry], index) => [
        encodeValue(key, `${path}[${index}].key`, next),
        encodeValue(entry, `${path}[${index}].value`, next),
      ]),
    };
  }
  if (value instanceof Set) {
    return { [TAG]: "set", entries: [...value].map((entry, index) => encodeValue(entry, `${path}[${index}]`, next)) };
  }
  if (Array.isArray(value)) {
    // Array order is data, and is preserved.
    return value.map((entry, index) => encodeValue(entry, `${path}[${index}]`, next));
  }

  // Own enumerable keys in their own order: declaration order of a record is part of its API, so it
  // is preserved here and normalised only where a caller states that it wants a set.
  const encoded = { [TAG]: "object", keys: Object.keys(value), of: {} };
  for (const key of encoded.keys) {
    encoded.of[key] = encodeValue(value[key], path ? `${path}.${key}` : key, next);
  }
  return encoded;
}

/** The same object with its keys sorted — for the places where order is presentation, not data. */
export function sortedPaths(paths) {
  return Object.freeze([...paths].sort());
}

function isTagged(value) {
  return typeof value === "object" && value !== null && TAG in value;
}

function describe(value) {
  if (value === undefined) return "<absent>";
  if (isTagged(value) && value[TAG] === "undefined") return "undefined";
  return JSON.stringify(value);
}

/**
 * The first place two encoded observations disagree, or `null`.
 *
 * First rather than all: a divergence report that lists forty consequences of one cause is read by
 * nobody, and the shrinker needs one anchor. `ignore` holds top-level observation fields a test has
 * declared irrelevant — a renderer-only field such as `mountedPaths` — and never a value path.
 */
export function diffCanonical(expected, actual, { ignore = [] } = {}) {
  return walk(expected, actual, "", new Set(ignore));
}

function walk(expected, actual, path, ignore) {
  if (path === "" && isPlainRecord(expected) && isPlainRecord(actual)) {
    const keys = sortedPaths(new Set([...Object.keys(expected), ...Object.keys(actual)]));
    for (const key of keys) {
      if (ignore.has(key)) continue;
      const found = walk(expected[key], actual[key], key, ignore);
      if (found) return found;
    }
    return null;
  }

  if (expected === actual) return null;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const found = walk(expected[index], actual[index], `${path}[${index}]`, ignore);
      if (found) return found;
    }
    return null;
  }

  if (isPlainRecord(expected) && isPlainRecord(actual)) {
    const keys = sortedPaths(new Set([...Object.keys(expected), ...Object.keys(actual)]));
    for (const key of keys) {
      const found = walk(expected[key], actual[key], path ? `${path}.${key}` : key, ignore);
      if (found) return found;
    }
    return null;
  }

  if (Object.is(expected, actual)) return null;
  return { path: path || "<root>", expected: describe(expected), actual: describe(actual) };
}

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
