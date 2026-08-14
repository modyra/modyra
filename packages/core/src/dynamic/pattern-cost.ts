/**
 * Whether a pattern from a document can be made to backtrack exponentially.
 *
 * `validators.pattern` is a string that arrives from a CMS, a saved project or a POST, and the
 * engine already treats it as needing care: an unparseable source is skipped with a diagnostic, and
 * one longer than the cap never reaches `RegExp`. Syntax was checked and cost was not, so a pattern
 * whose syntax is perfect could stop the field answering:
 *
 * ```
 * (a+)+$   against 30 characters and a miss   ->  12.6 seconds
 * ```
 *
 * That is a synchronous match, so it is the whole thread: no keystroke is handled, nothing repaints.
 *
 * What is refused is **structure, not slowness** — JavaScript offers no way to bound a match's cost
 * from outside it, so the only checkable thing is the shape of the source. The two shapes below are
 * what makes backtracking exponential rather than merely quadratic; a pattern that is slow for some
 * other reason is not caught, and this is stated where the decision is (ADR 0050) rather than
 * implied by the name.
 *
 * The check is deliberately conservative. A refusal removes a rule the document's author wrote, so
 * anything this cannot decide is allowed through: bounded repetition is left alone, and an
 * alternation whose branches cannot be compared is not refused on suspicion.
 */

/** Repetition with no ceiling — the only kind that turns nesting into exponential backtracking. */
const UNBOUNDED = new Set(["*", "+"]);

interface Group {
  /** Where the group's body starts, for reading its alternatives back. */
  readonly start: number;
  /** Whether anything inside it repeats without a ceiling. */
  unbounded: boolean;
  /** Where each top-level alternative of this group starts. */
  readonly alternatives: number[];
}

/** True when `source[at]` opens an unbounded `{n,}` repetition. */
function bracesAreUnbounded(source: string, at: number): boolean {
  const close = source.indexOf("}", at);
  if (close === -1) return false;
  const body = source.slice(at + 1, close);
  return /^\d+,\s*$/.test(body);
}

/**
 * The characters an alternative can start with, or `null` when that cannot be decided cheaply.
 *
 * `null` is the answer that matters: it is what stops a branch this cannot read from being refused
 * on suspicion.
 */
function firstCharacters(branch: string): Set<string> | null {
  const head = branch[0];
  if (head === undefined) return null;
  if (head === "\\") {
    const escaped = branch[1];
    // A class escape (\d, \w, \s…) stands for a set this does not enumerate; a literal escape is
    // the character itself.
    return escaped === undefined || /[a-zA-Z]/.test(escaped) ? null : new Set([escaped]);
  }
  if (head === "[" || head === "(" || head === "." || head === "^" || head === "$") return null;
  if (head === "*" || head === "+" || head === "?" || head === "{") return null;
  // A literal that may not be there at all says nothing about what the branch starts with.
  const next = branch[1];
  if (next === "?" || next === "*") return null;
  return new Set([head]);
}

/** Top-level alternatives of a group body, given where each one starts. */
function alternativesOf(source: string, group: Group, end: number): string[] {
  const bounds = [...group.alternatives, end];
  return bounds.slice(0, -1).map((from, index) => source.slice(from, bounds[index + 1]! ));
}

/** Whether two alternatives can both match at the same position. */
function overlap(branches: string[]): boolean {
  const sets = branches.map(firstCharacters);
  for (let i = 0; i < sets.length; i += 1) {
    const a = sets[i];
    if (!a) continue;
    for (let j = i + 1; j < sets.length; j += 1) {
      const b = sets[j];
      if (!b) continue;
      for (const character of a) if (b.has(character)) return true;
    }
  }
  return false;
}

/**
 * Why this pattern is refused, or `null` when it is allowed.
 *
 * The message names the shape rather than the position: a document's author reads it in a
 * diagnostic, and "nested unbounded repetition" is the thing they have to change.
 */
export function dynamicPatternRefusal(source: string): string | null {
  const groups: Group[] = [];
  let refusal: string | null = null;

  for (let at = 0; at < source.length && refusal === null; at += 1) {
    const character = source[at]!;
    if (character === "\\") { at += 1; continue; }
    if (character === "[") {
      // A character class is opaque here: nothing inside it repeats or groups.
      const close = source.indexOf("]", at + 1);
      at = close === -1 ? source.length : close;
      continue;
    }
    if (character === "(") {
      groups.push({ start: at + 1, unbounded: false, alternatives: [at + 1] });
      continue;
    }
    if (character === "|") {
      groups[groups.length - 1]?.alternatives.push(at + 1);
      continue;
    }
    if (character === ")") {
      const group = groups.pop();
      if (!group) continue;
      const quantifier = source[at + 1];
      const repeats = quantifier !== undefined
        && (UNBOUNDED.has(quantifier) || (quantifier === "{" && bracesAreUnbounded(source, at + 1)));
      if (repeats) {
        if (group.unbounded) {
          refusal = "nested unbounded repetition, which backtracks exponentially";
        } else if (overlap(alternativesOf(source, group, at))) {
          refusal = "repeated alternatives that can match the same text, which backtracks exponentially";
        }
      }
      // A group that repeats, or that holds something repeating, makes its parent nested too.
      if (repeats || group.unbounded) {
        const parent = groups[groups.length - 1];
        if (parent) parent.unbounded = true;
      }
      continue;
    }
    if (UNBOUNDED.has(character) || (character === "{" && bracesAreUnbounded(source, at))) {
      const parent = groups[groups.length - 1];
      if (parent) parent.unbounded = true;
    }
  }

  return refusal;
}
