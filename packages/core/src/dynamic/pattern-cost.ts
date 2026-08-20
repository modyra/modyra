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
 * What is refused is a **repeated group whose body can match different lengths** — the two halves
 * that together make backtracking exponential. A fixed-length body consumes the same number of
 * characters however the match reaches it, so there is one way to divide the input and nothing to
 * backtrack over; a variable one has many, and repeating it multiplies them. Whether the repetition
 * is written as a count or left open-ended does not change the shape: `(a+){15}` writes the exponent
 * as a number and reaches seconds at thirty characters, exactly as `(a+)+` does.
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

interface Group {
  /** Where the group's body starts, for reading its alternatives back. */
  readonly start: number;
  /**
   * Whether the group's body can match runs of different lengths.
   *
   * This is the half that makes a repetition ambiguous: a body of fixed length consumes the same
   * number of characters however the match arrives at it, so the engine has one way to divide the
   * input and nothing to backtrack over. A body that can be short or long has many, and repeating it
   * multiplies them.
   */
  variable: boolean;
  /** Where each top-level alternative of this group starts. */
  readonly alternatives: number[];
}

/** How many times a quantifier may repeat what it follows. `Infinity` for the open-ended ones. */
interface Repetition {
  readonly min: number;
  readonly max: number;
  /** Index of the last character of the quantifier, so a scan can step past it. */
  readonly end: number;
}

/**
 * The quantifier at `at`, or `null` when nothing there is one.
 *
 * `{` is only a quantifier when what follows spells a count: a pattern may contain a literal brace,
 * and reading `{a}` as a repetition would make the scan lose its place.
 */
function repetitionAt(source: string, at: number): Repetition | null {
  const character = source[at];
  if (character === "*") return { min: 0, max: Infinity, end: at };
  if (character === "+") return { min: 1, max: Infinity, end: at };
  if (character === "?") return { min: 0, max: 1, end: at };
  if (character !== "{") return null;
  const close = source.indexOf("}", at);
  if (close === -1) return null;
  const body = source.slice(at + 1, close);
  const exact = /^(\d+)$/.exec(body);
  if (exact) {
    const count = Number(exact[1]);
    return { min: count, max: count, end: close };
  }
  const open = /^(\d+),\s*$/.exec(body);
  if (open) return { min: Number(open[1]), max: Infinity, end: close };
  const range = /^(\d+),\s*(\d+)$/.exec(body);
  if (range) return { min: Number(range[1]), max: Number(range[2]), end: close };
  return null;
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

/**
 * A literal character as a pattern body that matches only itself.
 *
 * `-` is not escaped: it is only special inside a character class, and `\-` is an *invalid* escape
 * under the `u` flag — so escaping it threw, the matcher came back `null`, and a hyphen became a
 * character nothing could be compared against. `([a-z]+-)*` was refused for that and nothing else.
 */
function escapeLiteral(character: string): string {
  return character.replace(/[\\^$.*+?()[\]{}|\/]/g, "\\$&");
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


/** One element of a group's body: what it can match, and how many times it may repeat. */
interface Atom {
  /** What one occurrence accepts, or `null` when that cannot be decided cheaply. */
  readonly matcher: RegExp | null;
  /** The element's own source, without its quantifier — what a union of elements is built from. */
  readonly source: string;
  readonly min: number;
  readonly max: number;
}

/**
 * The body of one alternative, split into the elements it is a sequence of.
 *
 * `null` when the body holds something this cannot read as a sequence — a backreference, an assertion
 * — which is the answer that keeps an unreadable pattern out of a refusal.
 */
function atomsOf(branch: string): Atom[] | null {
  const atoms: Atom[] = [];
  let at = 0;
  while (at < branch.length) {
    const character = branch[at]!;
    if (character === "^" || character === "$") { at += 1; continue; }
    let end = at;
    let matcher: RegExp | null = null;
    if (character === "\\") {
      const escaped = branch[at + 1];
      if (escaped === undefined) return null;
      // A backreference repeats whatever another group took, so what it accepts is not a property of
      // the source at all.
      if (/\d/.test(escaped) || escaped === "b" || escaped === "B") return null;
      end = at + 1;
      matcher = CLASS_ESCAPES.has(escaped)
        ? safeMatcher(`\\${escaped}`)
        : /[a-zA-Z]/.test(escaped)
          ? null
          : safeMatcher(escapeLiteral(LITERAL_ESCAPES[escaped] ?? escaped));
    } else if (character === "[") {
      const close = classEnd(branch, at);
      if (close === -1) return null;
      end = close;
      matcher = safeMatcher(branch.slice(at, close + 1));
    } else if (character === ".") {
      matcher = safeMatcher(".");
    } else if (character === "(") {
      // A nested group is one element, and what it accepts is everything its own elements accept.
      // Left undecidable it took the whole seam with it: a hostname's `(?:[a-z0-9-]*[a-z0-9])?`
      // sits between a letter and the dot that ends the repetition, and "cannot tell" there refused
      // the pattern the check exists to allow.
      const close = groupEnd(branch, at);
      if (close === -1) return null;
      end = close;
      matcher = groupMatcher(branch.slice(at, close + 1));
    } else if (character === ")" || character === "|") {
      return null;
    } else {
      matcher = safeMatcher(escapeLiteral(character));
    }
    const repetition = repetitionAt(branch, end + 1);
    atoms.push({
      matcher,
      source: branch.slice(at, end + 1),
      min: repetition?.min ?? 1,
      max: repetition?.max ?? 1,
    });
    at = (repetition?.end ?? end) + 1;
  }
  return atoms;
}

/**
 * Everything a group accepts, as one matcher — the union of every element of every alternative.
 *
 * Not "what it starts with": the question a seam asks is whether the stretchy part can take the
 * character that ends the repetition, and it can do that from anywhere inside itself.
 */
function groupMatcher(group: string): RegExp | null {
  const inner = group.replace(/^\((\?(:|=|!|<=|<!|<[^>]*>))?/, "").replace(/\)$/, "");
  const sources: string[] = [];
  for (const branch of topLevelAlternatives(inner)) {
    const atoms = atomsOf(branch);
    if (atoms === null) return null;
    for (const atom of atoms) {
      if (atom.matcher === null) return null;
      sources.push(atom.source);
    }
  }
  if (sources.length === 0) return null;
  return safeMatcher(sources.join("|"));
}

/** A body split on the `|` that belongs to it, skipping the ones inside groups and classes. */
function topLevelAlternatives(body: string): string[] {
  const out: string[] = [];
  let from = 0;
  let depth = 0;
  for (let at = 0; at < body.length; at += 1) {
    const character = body[at]!;
    if (character === "\\") { at += 1; continue; }
    if (character === "[") { const close = classEnd(body, at); if (close === -1) break; at = close; continue; }
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "|" && depth === 0) { out.push(body.slice(from, at)); from = at + 1; }
  }
  out.push(body.slice(from));
  return out;
}

/** A pattern body compiled to something that answers for one character, or `null` when it will not. */
function safeMatcher(body: string): RegExp | null {
  try {
    return new RegExp(`^(?:${body})$`, "u");
  } catch {
    return null;
  }
}

/** Where the group opened at `at` closes, skipping classes and escapes. */
function groupEnd(source: string, at: number): number {
  let depth = 0;
  for (let index = at; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === "\\") { index += 1; continue; }
    if (character === "[") { const close = classEnd(source, index); if (close === -1) return -1; index = close; continue; }
    if (character === "(") depth += 1;
    else if (character === ")") { depth -= 1; if (depth === 0) return index; }
  }
  return -1;
}

/**
 * Whether everything `inner` accepts, the stretchy `outer` accepts too. Undecidable counts as yes.
 *
 * Containment rather than overlap, and the difference is the whole usable half of this check. What
 * makes a seam undecidable is the stretchy part being able to *take the boundary itself* — `.` can
 * take the `a` that ends `(.*a)`, so every position is a candidate. A boundary the stretchy part can
 * only sometimes take still pins the division wherever it cannot: an author who writes
 * `[A-Za-z0-9]+[.-_]` has written a class that overlaps digits and capitals by accident, and the `.`
 * and the `_` in it are still boundaries no letter can stand in for.
 */
function containedIn(inner: Atom, outer: Atom): boolean {
  if (!inner.matcher || !outer.matcher) return true;
  return ALPHABET.every((character) => !inner.matcher!.test(character) || outer.matcher!.test(character));
}

/**
 * Whether repeating this body gives the engine more than one way to divide the same input.
 *
 * A variable element creates the *opportunity* to divide the input several ways; only ambiguity makes
 * the engine try all of them, and that is what separates a pattern that is flat at two hundred
 * characters from one that takes minutes at forty. Measured against each pattern's own near miss —
 * its repeated unit plus a character that breaks the anchor, which is what an attacker sends:
 *
 *     ^(\d{1,3}\.){3}\d{1,3}$   flat at 0.00ms from 41 characters to 201
 *     ^([a-z]+-)*[a-z]+$         flat
 *     ^(a+){15}b$                0.05 · 0.18 · 5 · 146 · 3106 at 11 · 16 · 21 · 26 · 31
 *
 * What the cheap ones have is a **forced boundary**: something the stretchy part cannot itself match
 * sits between one repetition and the next, so there is exactly one place the division can fall. A
 * dot after digits, a hyphen after letters, a comma after "anything but a comma". `(a+){15}` has
 * fifteen stretchy spans and nothing between them; `(.*a){20}` has a boundary that `.` can eat.
 *
 * So the question is asked at the seam, in the only two shapes it has:
 *
 * - the body ends stretchy, and the next repetition starts with the body's first element — pinned
 *   unless the stretchy ending accepts everything that first element does (`[A-Z][a-z]+ ?` — a
 *   space is not a capital, so the capital says where the next repetition begins);
 * - the body ends fixed, and what precedes that ending is stretchy — pinned unless the stretchy part
 *   accepts everything the ending does (`\d{1,3}\.` — a dot is not a digit, so the dot says where
 *   this repetition ends; `.*a` — a dot *is* an `a`, so nothing does).
 *
 * Undecidable is read as ambiguous, so a body this cannot take apart is still refused when it repeats.
 */
function bodyIsAmbiguous(branch: string): boolean {
  const atoms = atomsOf(branch);
  if (atoms === null || atoms.length === 0) return false;
  if (!atoms.some((atom) => atom.min !== atom.max)) return false;
  const last = atoms[atoms.length - 1]!;
  if (last.min !== last.max) return containedIn(atoms[0]!, last);
  for (let index = atoms.length - 2; index >= 0; index -= 1) {
    const atom = atoms[index]!;
    if (atom.min === atom.max) continue;
    return containedIn(last, atom);
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
      // `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<name>` — the `?` there names the kind of group and
      // is not a quantifier. Read as one it made every non-capturing group look variable, which
      // refused `(?:ab){3}`: a fixed body repeated a fixed number of times, with nothing to divide.
      let body = at + 1;
      if (source[body] === "?") {
        body += 1;
        if (source[body] === "<" && source[body + 1] !== "=" && source[body + 1] !== "!") {
          const named = source.indexOf(">", body);
          body = named === -1 ? body + 1 : named + 1;
        } else if (source[body] === "<") {
          body += 2;
        } else {
          body += 1;
        }
      }
      groups.push({ start: body, variable: false, alternatives: [body] });
      at = body - 1;
      continue;
    }
    if (character === "|") {
      groups[groups.length - 1]?.alternatives.push(at + 1);
      continue;
    }
    if (character === ")") {
      const group = groups.pop();
      if (!group) continue;
      const repetition = repetitionAt(source, at + 1);
      // Repeated at all is `max >= 2`: once is not a repetition, and a group that may be skipped is
      // not one either. Whether the count is written or open-ended does not change the shape — it
      // only writes the exponent as a number instead of leaving it as the length of the input.
      const repeats = repetition !== null && repetition.max >= 2;
      if (repeats) {
        const branches = alternativesOf(source, group, at);
        if (group.variable && branches.some(bodyIsAmbiguous)) {
          refusal = "a repeated group whose body can be divided several ways, which backtracks exponentially";
        } else if (overlap(branches)) {
          refusal = "repeated alternatives that can match the same text, which backtracks exponentially";
        }
      }
      // What this group contributes to the one around it: a variable body stays variable however it
      // is repeated, and a fixed body becomes variable when the repetition itself is variable.
      if (group.variable || (repetition !== null && repetition.min !== repetition.max)) {
        const parent = groups[groups.length - 1];
        if (parent) parent.variable = true;
      }
      if (repetition !== null) at = repetition.end;
      continue;
    }
    const repetition = repetitionAt(source, at);
    if (repetition !== null) {
      // A quantifier whose minimum and maximum differ is what makes the run around it variable.
      // `{2}` on a single character is not: it consumes two, always, and offers nothing to divide.
      if (repetition.min !== repetition.max) {
        const parent = groups[groups.length - 1];
        if (parent) parent.variable = true;
      }
      at = repetition.end;
    }
  }

  return refusal;
}
