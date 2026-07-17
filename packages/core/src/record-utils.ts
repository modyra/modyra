/**
 * Shallow equality helpers for flat form-value records.
 */

/** Shallow key/value equality between two flat form-value records. */
export function shallowEqualRecords(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => Object.is(a[k], b[k]));
}
