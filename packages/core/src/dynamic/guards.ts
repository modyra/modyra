/**
 * What makes a value that arrived from outside safe to read.
 *
 * A leaf: the shapes a document declares and the reader that accepts one both need these, and a
 * predicate owned by either would make the other import it back.
 */

import { breaksValueConversion, isSafeFieldPath, namesAPrototypeKey } from "../path-utils.js";

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

/**
 * How long a field's path may be.
 *
 * A nested document has no depth limit, deliberately — a form's shape is the author's business —
 * but a path is not only structure: it is the payload key, the draft key, the widget id, and a
 * string every renderer carries per field. A hundred thousand levels of group produced a name of two
 * hundred thousand characters, parsed clean in a few milliseconds, and the cost of that name is paid
 * on every read of every value.
 *
 * A length rather than a depth, because it is the length that costs: a document nested nine levels
 * deep with short names is nothing to refuse.
 */
export const MDY_MAX_DYNAMIC_PATH_LENGTH = 512;
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
  return isSafeDynamicSegment(name)
    && !breaksValueConversion(name)
    && !name.includes(MDY_ID_DELIMITER)
    && !/\s/.test(name)
    && !MDY_INVISIBLE_IN_NAME.test(name);
}

/**
 * The characters that make two different names look like one.
 *
 * The same class `sanitize: "text"` strips from a **value**, and `security.md` explains why with the
 * case that matters: `"admin\u202E"` looks like `admin` and is not. A name never met the sanitizer,
 * and a name is what a value is filed under — a path, a payload key, a draft key, and the string a
 * reviewer reads when they check what a generated document declares. So a document could declare
 * `amount` twice, once really and once invisibly, and the duplicate check that exists precisely for
 * names that collide saw two different names.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the whole point of this regex
const MDY_INVISIBLE_IN_NAME = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2028-\u202E\u2066-\u2069\uFEFF]/;

/** Whether a name carries one of them — asked where a path is read rather than thrown on. */
export function hasInvisibleCharacters(name: string): boolean {
  return MDY_INVISIBLE_IN_NAME.test(name);
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
  if (MDY_INVISIBLE_IN_NAME.test(name)) {
    throw new Error(
      `[modyra] Invalid field name ${JSON.stringify(name)}: it carries a character that cannot be ` +
        "seen, so two names that read the same are two different fields — and the value sanitizer " +
        "removes exactly these from a value for the same reason.",
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
    // Each reason asked for by name, most specific first.
    //
    // `isSafeFieldPath` refuses everything below and more, so asking it first answered "must not be
    // a prototype key" for a name whose defect is a space or the id delimiter — the right verdict
    // with the wrong reason, sending the reader to look for a prototype key inside `"a b"`, and
    // disagreeing with what the parser says about the same name. Pollution stays ahead of the rest,
    // because `__proto__` also carries the id delimiter and the prototype chain is what matters
    // about it.
    // Before the general path check, beside the other two specific reasons: a value the consumer
    // cannot convert to a string is a defect that surfaces in their code, not ours.
    if (breaksValueConversion(name)) {
      throw new Error(
        `[modyra] Invalid field name "${name}": a form's value is an object, so a field named ` +
          `"toString" shadows the method every string conversion of that value goes through — ` +
          "`${value}` and `String(value)` then throw. Name the field something else.",
      );
    }
    if (namesAPrototypeKey(name)) {
      throw new Error(
        `[modyra] Invalid field name "${name}": every segment of a path must be present and must ` +
          `not be a prototype key, or the form would be keyed onto the prototype chain.`,
      );
    }
    assertSafeDynamicName(name);
    if (!isSafeFieldPath(name)) {
      throw new Error(
        `[modyra] Invalid field name "${name}": every segment of a path must be present and must ` +
          `not be a prototype key, or the form would be keyed onto the prototype chain.`,
      );
    }
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
