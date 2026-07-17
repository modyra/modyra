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
  return name.split(".").every(part => !MDY_FORBIDDEN_PATH_SEGMENTS.has(part));
}
