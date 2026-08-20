/**
 * Safe dotted-path utilities used by the form engine and draft/history
 * managers. Keeping this in one file prevents prototype-pollution bugs from
 * being re-implemented in every boundary that accepts untrusted paths.
 */

const MDY_FORBIDDEN_PATH_SEGMENTS = new Set([
  "",
  "__proto__",
  "prototype",
  "constructor",
]);

/**
 * True when every dotted segment of the path is non-empty and not a
 * prototype-polluting key (`__proto__`, `prototype`, `constructor`). The
 * engine rejects unsafe paths at field creation; boundaries that receive
 * untrusted paths (drafts, server errors, dynamic config) should filter
 * with this instead of throwing.
 */
export function isSafeFieldPath(name: string): boolean {
  if (name.length === 0) return false;
  return !namesAPrototypeKey(name) && name.split(".").every(isIdSegment);
}

/**
 * The one name a field cannot have without breaking the value the form produces.
 *
 * A form's value is an ordinary object, so a field called `toString` becomes a *data property* of it
 * — and `ToPrimitive` then has nothing callable to reach. `${value}`, `String(value)`, an `alert`,
 * some spellings of `console.log`: all of them throw `Cannot convert object to primitive value`,
 * outside this library, in the consumer's own code, with a message naming neither the field nor the
 * document that declared it. `JSON.stringify` is unaffected, which is why this survived — the
 * serialization path is the one everybody tries.
 *
 * One name and not a list, and the reason is what keeps it one: `ToPrimitive` tries `valueOf` first
 * and `toString` second, so shadowing `valueOf` alone changes nothing — the prototype's `toString`
 * still answers — and shadowing both is unreachable once `toString` itself is refused.
 * `Symbol.toPrimitive` cannot be a field name at all, because a name is a string.
 *
 * Refused rather than worked around: a non-enumerable `Symbol.toPrimitive` on the produced value
 * repairs the object the engine hands over and not the copy a consumer makes of it — measured,
 * `String(structuredClone(value))` throws again — so the defect would reappear further from its
 * cause than it is now.
 *
 * Asked of a **declared name**, not of every path segment. A record's row key is data — a filename,
 * a SKU, what the domain calls a row — and a person entitled to a row called `toString` is not
 * declaring a schema. {@link isSafeFieldPath} therefore does not consult this; the two doors that
 * declare names do.
 */
export function breaksValueConversion(name: string): boolean {
  return name.split(".").some((part) => part === "toString");
}

/**
 * True when a segment of the path is empty or a key that would reach the prototype chain.
 *
 * The half of {@link isSafeFieldPath} that is about *pollution* rather than about what an id can be
 * built from. Held apart so a caller with a more specific message for the other half can ask for
 * this reason by name, instead of answering "must not be a prototype key" to a name whose defect is
 * a space.
 *
 * Not exported from the package: it is one reading of a check whose public answer is
 * {@link isSafeFieldPath}, and a second published predicate over the same rule is a second thing to
 * keep in agreement.
 */
export function namesAPrototypeKey(name: string): boolean {
  if (name.length === 0) return true;
  return name.split(".").some((part) => MDY_FORBIDDEN_PATH_SEGMENTS.has(part));
}

/**
 * The path and every dotted path above it, outermost first: `"a.b.c"` yields `"a"`, `"a.b"`,
 * `"a.b.c"`.
 *
 * The set of prefixes that cover a path is the set of its ancestors, so anything keyed by prefix is
 * answered by lookups over this rather than by a scan: a form whose rows each register something
 * under their own path has as many entries as rows, and scanning them once per path makes every
 * write cost the size of the collection.
 */
export function ancestorsOf(name: string): string[] {
  const paths: string[] = [];
  let cut = name.indexOf(".");
  while (cut !== -1) {
    paths.push(name.slice(0, cut));
    cut = name.indexOf(".", cut + 1);
  }
  paths.push(name);
  return paths;
}

/**
 * The delimiter a generated id puts between its parts, mirrored from the id factory.
 *
 * Held here rather than imported so the lowest layer keeps no dependency on the widget contract:
 * a path is checked where paths are handled, and the widget layer's own guard says the same thing
 * from the other side.
 */
const MDY_PATH_ID_DELIMITER = "__";

/**
 * Whether a segment can be part of the id a control is given.
 *
 * A field's name becomes a widget id, and a widget id becomes the id of every part the control
 * draws. Two spellings make that impossible:
 *
 * - **whitespace**, because `aria-labelledby` and its family are space-separated lists of ids: a
 *   field named `a b` produces `aria-labelledby="a b__label"`, which resolves to two ids nobody
 *   rendered, and the control has no accessible name at all;
 * - **the delimiter**, because an id carrying it a second time cannot be taken apart again, and two
 *   fields collide on one id.
 *
 * A document naming one has always been refused at the door. A form written in code held it, and the
 * refusal arrived later from another package, at render time, about a name this guard had called
 * safe — the asymmetry the guards' own comment says is not there.
 */
function isIdSegment(part: string): boolean {
  return !/[\t\n\f\r ]/.test(part) && !part.includes(MDY_PATH_ID_DELIMITER);
}
