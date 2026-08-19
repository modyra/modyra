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
  return name.split(".").every((part) => !MDY_FORBIDDEN_PATH_SEGMENTS.has(part) && isIdSegment(part));
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
