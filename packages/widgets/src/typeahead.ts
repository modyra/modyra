/**
 * Typeahead: jumping to an option by typing its name.
 *
 * What a native `<select>` does, and what a listbox has to reimplement. Typing `m`, `a`, `r` in quick
 * succession looks for `mar`, not for `r` — the characters **accumulate**, and a rule that replaces
 * the query on each keystroke can never match more than one character.
 *
 * The buffer clears after {@link MDY_TYPEAHEAD_IDLE_MS} of silence, which is the interval native
 * selects use on every major platform. That number is the whole reason the feature is usable: without
 * it, a pause mid-word and a later unrelated word merge into one query nobody typed. It also clears
 * on the events that end the interaction — Escape, a selection, the list closing, focus leaving —
 * because each of those means the next keystroke starts a new intent.
 *
 * The clock is injected rather than read from `Date.now`, so a suite can drive it directly instead of
 * waiting a real second or installing fake timers. A rule this small is not worth a test that sleeps.
 */

/** How long the buffer survives without a keystroke. Native selects use one second. */
export const MDY_TYPEAHEAD_IDLE_MS = 1000;

export interface MdyTypeaheadOptions {
  /** Milliseconds of silence after which the buffer resets. Defaults to {@link MDY_TYPEAHEAD_IDLE_MS}. */
  readonly idleMs?: number;
  /** Monotonic milliseconds. Injected so a suite can advance it without waiting. */
  readonly now?: () => number;
}

export interface MdyTypeahead {
  /**
   * Accepts a printable character and returns the query to match against.
   *
   * Returns the accumulated buffer, so a caller matches on the whole word rather than the last key.
   */
  readonly push: (character: string) => string;
  /** The buffer, without changing it. */
  readonly query: () => string;
  /** Ends the current intent: Escape, a selection, the list closing, focus leaving. */
  readonly clear: () => void;
}

/**
 * Whether a keyboard event is a character a user is typing, rather than a command.
 *
 * A single printable character with no modifier. `key.length === 1` alone would admit `Enter`'s
 * counterparts on some layouts and, more importantly, would treat `Ctrl+A` as the letter `a`.
 */
export function isTypeaheadCharacter(
  key: string,
  modifiers: { readonly ctrlKey?: boolean; readonly metaKey?: boolean; readonly altKey?: boolean } = {},
): boolean {
  if (key.length !== 1) return false;
  if (modifiers.ctrlKey === true || modifiers.metaKey === true || modifiers.altKey === true) return false;
  // A space selects in a listbox and types in a search box; the caller decides which it is, so it is
  // admitted here and rejected there rather than being silently unavailable to both.
  return true;
}

export function createTypeahead(options: MdyTypeaheadOptions = {}): MdyTypeahead {
  const idleMs = options.idleMs ?? MDY_TYPEAHEAD_IDLE_MS;
  const now = options.now ?? (() => Date.now());
  let buffer = "";
  let last = 0;

  return {
    push: (character) => {
      const at = now();
      // Strictly greater: a keystroke exactly `idleMs` after the previous one is the first of a new
      // word, which is the reading that never merges two intents by a rounding error.
      if (buffer !== "" && at - last >= idleMs) buffer = "";
      buffer += character;
      last = at;
      return buffer;
    },
    query: () => buffer,
    clear: () => {
      buffer = "";
      last = 0;
    },
  };
}

/**
 * A label and a query, in a form that can be compared character by character.
 *
 * `É` has two encodings — one code point, or `E` followed by a combining acute — and they render
 * identically. The two sides arrive from different places: labels come from a CMS, an API or a file
 * listing, and macOS hands back decomposed text, while a browser's keyboard input is composed. So a
 * user typing the accent they can see on screen filtered the list to nothing.
 *
 * `NFC` and not `NFKD`, and no accent stripping: two spellings of the *same* character are the same
 * character, and `e` is a different letter from `é`. Folding those together would make `resume` and
 * `résumé` one option, which is a separate decision with its own costs.
 */
function comparableText(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

/**
 * The option a query selects: the first whose label starts with it, case-insensitively.
 *
 * Prefix rather than substring, because that is what a user typing a name expects — `an` should reach
 * `Andorra`, not `Canada`. Ties go to declaration order, so the same query always lands in the same
 * place.
 */
export function typeaheadMatch<T extends { readonly label: string }>(
  options: readonly T[],
  query: string,
): T | null {
  if (query === "") return null;
  const needle = comparableText(query);
  return options.find((option) => comparableText(option.label).startsWith(needle)) ?? null;
}
