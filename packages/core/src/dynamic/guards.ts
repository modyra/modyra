/**
 * What makes a value that arrived from outside safe to read.
 *
 * A leaf: the shapes a document declares and the reader that accepts one both need these, and a
 * predicate owned by either would make the other import it back.
 */

import { isSafeFieldPath } from "../path-utils.js";

/**
 * What separates the segments of a generated DOM id (`@modyra/widgets`' id factory builds
 * `${widgetId}__${part}`). It lives here, in the lowest layer, because both the id factory and the
 * name rules below have to agree on it and `@modyra/core` cannot import `@modyra/widgets`.
 *
 * A field name containing it collides: `part("a", "label")` and a field named `a__label` both land
 * on `a__label`, in different roles, and the browser is happy to hold two elements with one id —
 * so `getElementById`, `label[for]` and every ARIA IDREF stop being deterministic.
 */
export const MDY_ID_DELIMITER = "__";

export const MDY_MAX_DYNAMIC_PATTERN_LENGTH = 256;
const MDY_FORBIDDEN_DYNAMIC_NAMES = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** ISO `yyyy-MM-dd`, and a real date rather than a well-shaped impossible one. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isSafeDynamicSegment(value: string): boolean {
  return value.length > 0 && !value.includes(".") && !MDY_FORBIDDEN_DYNAMIC_NAMES.has(value);
}

/**
 * The names a trusted field list may use.
 *
 * {@link parseDynamicFields} drops a bad name because its input is a document that may be anything.
 * A list written in code is never parsed, and nothing looks at a name until it becomes part of a
 * form — so the same rules hold on both paths, and only the response differs: a name written in
 * code is a defect to report rather than input to survive.
 *
 * A name here is a **path**, as it is everywhere else: the dynamic contract carries a nested form
 * as fields named `shipping.city`, and refusing the separator would refuse every flattened
 * document. What is refused is a path no form can hold — an empty segment, a prototype key, the id
 * delimiter, or a name already taken.
 */
/**
 * What a name may be, wherever a form reads one.
 *
 * A flat list names a path and a tree names one segment at a time, and both arrive at the same DOM:
 * a widget id is built from the name and reaches `aria-describedby`, which is a space-separated list
 * of ids — so whitespace there becomes several references, each resolving to nothing, and the
 * control has no accessible name. The id delimiter collides the name with another field's parts.
 *
 * Held in one function because the two doors disagreeing is the defect it exists to prevent: a
 * document refused by one build route and taken by the other means which pair of functions a
 * consumer called decides whether their document works.
 */
/**
 * Whether a single path segment is one a document may name, asked without throwing.
 *
 * The same three rules {@link assertSafeDynamicName} raises on, for the reader that reports rather
 * than refuses — a document's tree is walked by a validator that collects diagnostics, and a name it
 * lets through is one the flat door drops, so the shape an author wrote decided whether their
 * mistake was caught.
 */
export function isSafeDynamicName(name: string): boolean {
  return isSafeDynamicSegment(name) && !name.includes(MDY_ID_DELIMITER) && !/\s/.test(name);
}

export function assertSafeDynamicName(name: string): void {
  if (name.includes(MDY_ID_DELIMITER)) {
    throw new Error(
      `[modyra] Invalid field name "${name}": "${MDY_ID_DELIMITER}" separates the segments of a ` +
        `generated id, so this name would collide with another field's parts.`,
    );
  }
  if (/\s/.test(name)) {
    throw new Error(
      `[modyra] Invalid field name "${name}": a widget id is built from this name, and ` +
        "whitespace splits an id reference into several, each resolving to nothing — so the " +
        "control would have no accessible name.",
    );
  }
}

export function assertSafeDynamicFieldNames(
  fields: ReadonlyArray<{ readonly name: string }>,
): void {
  const seen = new Set<string>();
  for (const declared of fields) {
    // An entry that is not a field has no name to check, and destructuring one produced
    // `Cannot read properties of undefined (reading 'length')` from inside the path check — an
    // internal, on a list a caller assembled, naming neither the entry nor the door.
    if (typeof declared !== "object" || declared === null) {
      throw new Error(
        `[modyra] A field list holds fields, and one entry is ${
          declared === null ? "null" : `a ${typeof declared}`
        }. Each entry names a field: { name, kind, label }.`,
      );
    }
    const { name } = declared;
    if (typeof name !== "string") {
      throw new Error(
        `[modyra] A field must be named, and one entry names ${
          name === undefined ? "nothing" : `a ${typeof name}`
        }.`,
      );
    }
    if (!isSafeFieldPath(name)) {
      throw new Error(
        `[modyra] Invalid field name "${name}": every segment of a path must be present and must ` +
          `not be a prototype key, or the form would be keyed onto the prototype chain.`,
      );
    }
    assertSafeDynamicName(name);
    if (seen.has(name)) {
      throw new Error(`[modyra] Duplicate field name "${name}": every field needs its own identity.`);
    }
    seen.add(name);
  }
}


let diagnosticSink: ((message: string, path?: string) => void) | undefined;

/**
 * Runs `read` with every `warnDev` finding going to `sink` instead of the console.
 *
 * The sink is restored on the way out, including when `read` throws: a reader that abandons a
 * malformed document must not leave the next one reporting into its result.
 */
/**
 * Where a finding is, as a JSON pointer into the document, when the code that reports it knows.
 *
 * A reader is sent to the place they have to change. Without it every per-field finding pointed at
 * `/fields` — the line the array opens on — so a two-hundred-line document assembled by a CMS sent
 * the reader to the same line whichever entry was wrong, and an editor's underline stopped being
 * worth more than the console message.
 */
export function collectingDiagnostics<T>(
  sink: (message: string, path?: string) => void,
  read: () => T,
): T {
  const previous = diagnosticSink;
  diagnosticSink = sink;
  try {
    return read();
  } finally {
    diagnosticSink = previous;
  }
}

export function warnDev(message: string, path?: string): void {
  // A caller holding a sink is collecting these into a result it is about to read, so writing to the
  // console as well duplicates every finding into a channel it did not ask for — and a tool that
  // parses a document per keystroke turns that into a stream. With no sink the console is the only
  // way the finding reaches anyone, which is why it stays the fallback rather than an option.
  if (diagnosticSink) {
    diagnosticSink(message, path);
    return;
  }
  console.warn(`[modyra] ${message}`);
}
