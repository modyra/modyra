/**
 * The one reader of class doors, shared by every gate that scans source.
 *
 * Three gates used to learn the doors one at a time — each knowing its own set of spellings, each
 * needing an edit when a door was added. That is a product of two numbers that both grow, and it
 * fails in the worst direction: the gates drift apart, so a door taught to one and not the others
 * makes two of them report classes as absent while the third sees them. The classes were on the
 * element the whole time.
 *
 * Here there is one call shape and one table. A gate asks this module what a file's door calls put on
 * the page; the shapes live in `MDY_CLASS_DOORS` inside the contract, so **a door added tomorrow is
 * one manifest entry and every gate sees it the same day**. The product becomes a sum.
 *
 * **What it does not resolve, it names.** A door whose arguments are values rather than literals
 * cannot be answered from text — `stateClass` takes a class, not a kind and a part. Those calls are
 * counted and reported as a perimeter, because a gate that stays silent about them reports the
 * classes as missing, which is the defect this exists to end. A perimeter is a fact a reader can act
 * on; a silence is one they cannot see.
 */

/**
 * Every `door("literal", "literal")` call in a blob of source, resolved through the contract.
 *
 * Comments are stripped first: a door named in prose puts nothing on an element, and counting it
 * would inflate exactly the gates this is meant to make honest.
 *
 * @param {string} source
 * @param {readonly {name: string, resolve?: (args: readonly string[]) => readonly string[], unresolvable?: string}[]} doors
 * @returns {{classes: Set<string>, resolved: number, perimeter: {door: string, reason: string, calls: number}[]}}
 */
export function classesFromDoors(source, doors) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  const classes = new Set();
  const perimeter = [];
  let resolved = 0;

  for (const door of doors) {
    // Literal arguments only, and that is the contract of this reader rather than a limitation it
    // hides: a call whose argument is an expression is counted under the door's perimeter below, not
    // guessed at. Zero-argument doors are matched too — `multiselectChipClasses()` answers alone.
    const literalCall = new RegExp(
      `\\b${door.name}\\s*\\(\\s*(?:(["'\`])([^"'\`]*)\\1\\s*(?:,\\s*(["'\`])([^"'\`]*)\\3\\s*)?)?\\)`,
      "g",
    );
    const anyCall = new RegExp(`\\b${door.name}\\s*\\(`, "g");

    const literalSites = [...code.matchAll(literalCall)];
    const allSites = (code.match(anyCall) ?? []).length;

    if (door.resolve) {
      for (const site of literalSites) {
        const args = [site[2], site[4]].filter((value) => value !== undefined);
        for (const cls of door.resolve(args) ?? []) classes.add(cls);
        resolved += 1;
      }
    }

    // A call this reader could not answer: either the door declares itself unresolvable, or its
    // arguments were expressions. Both are perimeter, and both are said out loud.
    const unanswered = allSites - (door.resolve ? literalSites.length : 0);
    if (unanswered > 0) {
      perimeter.push({
        door: door.name,
        reason: door.unresolvable ?? "called with arguments that are expressions, not literals",
        calls: unanswered,
      });
    }
  }

  return { classes, resolved, perimeter };
}

/**
 * The perimeter as a gate should print it — one line, or nothing when there is none.
 *
 * Shared so the three gates say it the same way: a reader comparing two reports should not have to
 * work out whether two different sentences mean the same thing.
 */
export function perimeterLine(perimeter) {
  if (perimeter.length === 0) return null;
  const total = perimeter.reduce((n, entry) => n + entry.calls, 0);
  return `Not resolved from source: ${total} door call(s) — `
    + perimeter.map((entry) => `${entry.door} ×${entry.calls} (${entry.reason})`).join("; ");
}
