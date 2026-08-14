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
 * Characters used to decide whether two alternatives can start with the same thing.
 *
 * Comparing two character classes needs something to compare them *over*: `[a-z]` and `\w` are sets
 * written in different notations, and the cheap way to ask whether they intersect is to ask which of
 * these each one accepts. Printable ASCII covers what patterns are written about; the whitespace and
 * the two non-Latin letters are there so that `.` and `\n`, or `\w` and a letter outside ASCII, are
 * not called disjoint because nothing in the sample could tell them apart.
 */
const ALPHABET: readonly string[] = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) => String.fromCharCode(0x20 + index)),
  "\n", "\t", "\r", "é", "ß", "中",
];

/** Escapes that stand for a set of characters rather than for one. */
const CLASS_ESCAPES = new Set(["d", "D", "w", "W", "s", "S"]);

/** Escapes that stand for one character written unprintably. */
const LITERAL_ESCAPES: Readonly<Record<string, string>> = { n: "\n", t: "\t", r: "\r", f: "\f", v: "\v", 0: "\0" };

/** Where a character class ends, accounting for `]` as the first member and for escapes. */
function classEnd(source: string, open: number): number {
  let at = open + 1;
  if (source[at] === "^") at += 1;
  if (source[at] === "]") at += 1;
  for (; at < source.length; at += 1) {
    if (source[at] === "\\") { at += 1; continue; }
    if (source[at] === "]") return at;
  }
  return -1;
}

/**
 * What an alternative can start with, as something that answers for one character — or `null` when
 * that cannot be decided cheaply.
 *
 * `null` is the answer that matters: it is what stops a branch this cannot read from being refused on
 * suspicion. A nested group and a backreference stay undecidable deliberately.
 */
function firstMatcher(branch: string): RegExp | null {
  const head = branch[0];
  if (head === undefined) return null;

  const build = (body: string): RegExp | null => {
    try {
      return new RegExp(`^(?:${body})$`, "u");
    } catch {
      return null;
    }
  };

  if (head === "\\") {
    const escaped = branch[1];
    if (escaped === undefined) return null;
    if (CLASS_ESCAPES.has(escaped)) return optionalAfter(branch, 2) ? null : build(`\\${escaped}`);
    if (escaped === "b" || escaped === "B") return null;
    if (/\d/.test(escaped)) return null;
    const literal = LITERAL_ESCAPES[escaped];
    if (literal !== undefined) return optionalAfter(branch, 2) ? null : build(escapeLiteral(literal));
    if (/[a-zA-Z]/.test(escaped)) return null;
    return optionalAfter(branch, 2) ? null : build(escapeLiteral(escaped));
  }

  if (head === "[") {
    const close = classEnd(branch, 0);
    if (close === -1) return null;
    return optionalAfter(branch, close + 1) ? null : build(branch.slice(0, close + 1));
  }

  // `.` is a set like any other, and an accurate one matters: `(.|\n)*` is the ordinary way to write
  // "any character at all", and its two branches genuinely cannot match the same character.
  if (head === ".") return optionalAfter(branch, 1) ? null : build(".");

  if (head === "(" || head === "^" || head === "$" || head === "*" || head === "+" || head === "?" || head === "{" || head === "|") {
    return null;
  }
  return optionalAfter(branch, 1) ? null : build(escapeLiteral(head));
}

/** Whether what precedes `at` may be absent, which makes the branch's first character undecidable. */
function optionalAfter(branch: string, at: number): boolean {
  const quantifier = branch[at];
  if (quantifier === "?" || quantifier === "*") return true;
  if (quantifier !== "{") return false;
  const close = branch.indexOf("}", at);
  return close !== -1 && /^0*,/.test(branch.slice(at + 1, close));
}

/** A literal character as a pattern body that matches only itself. */
function escapeLiteral(character: string): string {
  return character.replace(/[\\^$.*+?()[\]{}|\/-]/g, "\\$&");
}

/** Top-level alternatives of a group body, given where each one starts. */
function alternativesOf(source: string, group: Group, end: number): string[] {
  const bounds = [...group.alternatives, end];
  return bounds.slice(0, -1).map((from, index) => source.slice(from, bounds[index + 1]! ));
}

/**
 * Whether two alternatives can both match at the same position.
 *
 * Written as a set intersection over {@link ALPHABET} rather than as a comparison of notations:
 * `[a-z]` and `\w` and `a` are three spellings, and what decides ambiguity is what they accept.
 * Two classes that cannot share a character — `([a-z]|[0-9])+` — are not ambiguous and are left
 * alone, because refusing them would delete a rule that is perfectly safe.
 */
function overlap(branches: string[]): boolean {
  const matchers = branches.map(firstMatcher);
  for (let i = 0; i < matchers.length; i += 1) {
    const a = matchers[i];
    if (!a) continue;
    for (let j = i + 1; j < matchers.length; j += 1) {
      const b = matchers[j];
      if (!b) continue;
      if (ALPHABET.some((character) => a.test(character) && b.test(character))) return true;
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
