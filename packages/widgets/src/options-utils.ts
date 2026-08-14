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

/**
 * The key an option is indexed by, when the caller has not said.
 *
 * `String(option.value)` is the obvious default and it collapses: `String({id: 1})` is
 * `"[object Object]"`, and so is every other object, so an index built from it holds one entry —
 * whichever option was written last. A user picks the first customer and the widget selects the
 * third, silently, staying internally consistent while being externally wrong.
 *
 * This package already reasoned about exactly that. `options-reconciliation`'s `sameChoice` says it
 * in its own words: *"Never loose between objects: `String()` renders every plain object as
 * `[object Object]`, so a comparison through it says two different entities are the same one."* The
 * reasoning was accepted there and simply never reached the place the key is derived.
 *
 * **A primitive keeps the key it had.** Keys are consumer-visible — they become part ids and land in
 * `aria-activedescendant` — so a value that already keys distinctly is left exactly as it was. An
 * array does too: `String(["b"])` is `"b"`, which is distinct per array and has been working.
 *
 * An object is keyed by **what it holds**, the same rule `oneOf` uses for an option
 * (ADR 0051): a list rebuilt from fresh objects by a refetch keys the same, which identity would
 * not. Depth is capped, and past it the key stops describing — two options identical for eight
 * levels and different below would share a key, which is the direction that merely fails to
 * distinguish rather than pointing at the wrong row.
 */
export function defaultOptionKey(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return String(value);
  return structuralKey(value, 0);
}

/** A plain object as a canonical string: keys sorted, so declaration order does not change a key. */
function structuralKey(value: unknown, depth: number): string {
  if (depth > 8) return "…";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => structuralKey(entry, depth + 1)).join(",")}]`;
  }
  if (value instanceof Date) return `Date(${value.getTime()})`;
  const entries = Object.keys(value as Record<string, unknown>).sort();
  return `{${entries
    .map((key) => `${JSON.stringify(key)}:${structuralKey((value as Record<string, unknown>)[key], depth + 1)}`)
    .join(",")}}`;
}
