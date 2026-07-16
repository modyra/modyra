import { MdySelectOption } from "./types.js";

/**
 * Filters an option list by a search query string.
 *
 * Pure function — no side-effects, fully testable.
 * Used by MdySelectComponent and MdyMultiselectComponent to avoid
 * duplicating the same filtering logic.
 *
 * @param options  The full list of options to filter.
 * @param query    User-entered search string (case-insensitive, leading/trailing spaces ignored).
 * @returns        Options whose label contains `query`; returns the original array if `query` is empty.
 */
export function filterOptionsByQuery<TValue>(
  options: readonly MdySelectOption<TValue>[],
  query: string,
): readonly MdySelectOption<TValue>[] {
  const q = query.toLowerCase().trim();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}
