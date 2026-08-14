import type { MdySelectOption } from "@modyra/core";

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
  // Normalized on both sides: `É` has two encodings that render identically, labels arrive from a
  // CMS or a file listing (macOS decomposes) and keyboard input is composed. Without it the list
  // empties while the label the user is reading sits right there. `NFC` only — an accent stays a
  // different letter from the one underneath it.
  const q = query.normalize("NFC").toLowerCase().trim();
  if (!q) return options;
  return options.filter((o) => o.label.normalize("NFC").toLowerCase().includes(q));
}
