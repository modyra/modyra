/**
 * What a compiler's printed order does not mean.
 *
 * A declaration file is emitted in whatever order the compiler happened to intern things, and two
 * of those orders carry no meaning at all: the members of a union, and the members of an object
 * type. Both are sets. A consumer cannot write code that sees the difference, so a tool that reads
 * emitted text and reports the reordering has reported the printer, not the code.
 *
 * Three tools needed this on the same day — the type-surface snapshot for unions, the same snapshot
 * again for object members, and the tsc5-vs-tsc7 comparison for both — and each learned it alone.
 * By the time they were put side by side they had already drifted: one handled single-quoted
 * literals and escaped quotes, the other only plain double quotes, and **both** split a run on `|`,
 * which corrupts a literal that contains one. So the knowledge lives here and they read it.
 */

/** Every string literal, single or double quoted, escapes included. */
const LITERAL = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;
const LITERAL_UNION = new RegExp(`(?:${LITERAL})(?:\\s*\\|\\s*(?:${LITERAL}))+`, "g");

/**
 * Runs of string literals joined by `|`, each run written in one order.
 *
 * The members are recovered by matching literals again rather than by splitting the run on `|`: a
 * literal may contain that character — `"a|b" | "c"` is two members, not three — and splitting
 * turns one union into fragments that sort into nonsense.
 */
export function sortLiteralUnions(text) {
  return String(text).replace(LITERAL_UNION, (run) => {
    const members = run.match(new RegExp(LITERAL, "g")) ?? [run];
    return [...members].sort().join(" | ");
  });
}

/**
 * Whether two emitted files say the same thing in a different order.
 *
 * Compared as a multiset of lines, after the unions inside them are put in one order. A file whose
 * lines were rearranged reads as unchanged; a file that gained, lost or altered a line does not —
 * which is the whole safety of it, because a changed declaration changes a line.
 */
export function sameIgnoringOrder(left, right) {
  const lines = (text) => sortLiteralUnions(text)
    .split("\n").map((line) => line.trim()).filter(Boolean).sort().join("\n");
  return lines(left) === lines(right);
}
