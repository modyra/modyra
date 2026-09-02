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
 * The text of every object-literal argument passed to one door, brace-matched.
 *
 * A regex cannot find the closing brace of `{ mode: this.mode(), selected }` — nested calls carry
 * their own braces and parentheses — so the end is found by counting, not by matching.
 */
function objectCallSites(code, name) {
  const sites = [];
  const opener = new RegExp(`\\b${name}\\s*\\(\\s*\\{`, "g");
  for (const match of code.matchAll(opener)) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = start; i < code.length; i += 1) {
      const ch = code[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) { sites.push(code.slice(start, i + 1)); break; }
      }
    }
  }
  return sites;
}

/**
 * The raw text of each positional argument at every call to one door.
 *
 * Split at depth zero: an argument that is itself a call — `this.position()` — carries parentheses,
 * and a comma inside them belongs to it, not to the argument list.
 */
function positionalCallSites(code, name) {
  const sites = [];
  const opener = new RegExp(`\\b${name}\\s*\\(`, "g");
  for (const match of code.matchAll(opener)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let current = "";
    const args = [];
    for (let i = start; i < code.length; i += 1) {
      const ch = code[i];
      if (ch === "(" || ch === "{" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "}" || ch === "]") {
        depth -= 1;
        if (depth === 0) { if (current.trim() !== "") args.push(current.trim()); break; }
      }
      if (ch === "," && depth === 1) { args.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    sites.push(args);
  }
  return sites;
}

/**
 * Every argument list a call site stands for, given the domains its door declares per position.
 *
 * `argDomains: [null, ["above", "overlay"]]` says the first argument must be written as a literal
 * and the second may be an expression varying over two values. The narrow domain is the point:
 * `popupPlacementClass` answers with a class for `above` and `overlay` and with nothing for every
 * other placement, so two entries cover what the door can put on a page. A domain is what the door
 * *declares*, never what the reader infers — an inferred one would invent classes.
 */
function argumentListsFor(args, argDomains) {
  let lists = [[]];
  for (let i = 0; i < args.length; i += 1) {
    const literal = args[i].match(/^(["'`])([^"'`]*)\1$/);
    if (literal) {
      lists = lists.map((list) => [...list, literal[2]]);
      continue;
    }
    const domain = argDomains?.[i];
    if (!Array.isArray(domain)) return null;
    lists = lists.flatMap((list) => domain.map((value) => [...list, value]));
    if (lists.length > COMBINATION_CAP) return null;
  }
  return lists;
}

/** How many argument combinations one call site may be expanded into before the reader stops. */
const COMBINATION_CAP = 64;

/**
 * An object-literal argument as its keys, each classified as literal, expression, or absent.
 *
 * **The three cases are not the same and collapsing them breaks in both directions.** A key written
 * as a literal is fixed. A key written as an expression varies over the domain its door declares. A
 * key that is not there at all takes the function's own default — which is why "just union
 * everything the door can produce" is wrong: `multiselectChipClasses({ mode: expr, role: "value" })`
 * cannot produce `--removable`, because nothing passes `removable`. A blind union overstates, and a
 * gate that overstates is as broken as one that loses classes; it merely fails on the other side.
 */
function objectArgumentKeys(text) {
  const body = text.trim();
  if (!body.startsWith("{") || !body.endsWith("}")) return null;
  const keys = new Map();
  let depth = 0;
  let current = "";
  const flush = () => {
    const part = current.trim();
    current = "";
    if (part === "") return;
    const colon = part.indexOf(":");
    // `{ selected }` — shorthand is a variable, so it is an expression under another spelling.
    if (colon === -1) return keys.set(part.replace(/^\.\.\./, "").trim(), { expression: true });
    const key = part.slice(0, colon).trim().replace(/^["'`]|["'`]$/g, "");
    const value = part.slice(colon + 1).trim();
    const literal = value.match(/^(["'`])([^"'`]*)\1$/);
    if (literal) return keys.set(key, { literal: literal[2] });
    if (value === "true" || value === "false") return keys.set(key, { literal: value === "true" });
    keys.set(key, { expression: true });
  };
  for (const ch of body.slice(1, -1)) {
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) { flush(); continue; }
    current += ch;
  }
  flush();
  return keys;
}

/**
 * Every record the reader must resolve for one call site: literals fixed, expressions over their
 * declared domain, absent keys left out so the door's own default applies.
 */
function recordsFor(keys, domains) {
  let records = [{}];
  for (const [key, form] of keys) {
    if ("literal" in form) {
      records = records.map((record) => ({ ...record, [key]: form.literal }));
      continue;
    }
    const domain = domains?.[key];
    // A key the door declares no domain for cannot be expanded, and guessing one would invent
    // classes. The call site keeps the key out of the record and is reported as perimeter instead.
    if (!Array.isArray(domain)) return null;
    records = records.flatMap((record) => domain.map((value) => ({ ...record, [key]: value })));
    if (records.length > COMBINATION_CAP) return null;
  }
  return records;
}

/**
 * Every `door(…)` call in a blob of source, resolved through the contract.
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

    let answered = 0;
    if (door.resolve) {
      // Positional arguments, each either written as a literal or expanded over the domain its door
      // declares for that position. A door with no `argDomains` answers only fully literal calls,
      // which is what every door did before: the declaration is what widens it, never a guess here.
      for (const args of positionalCallSites(code, door.name)) {
        const lists = argumentListsFor(args, door.argDomains);
        if (!lists) continue;
        for (const list of lists) {
          for (const cls of door.resolve(list) ?? []) classes.add(cls);
        }
        answered += 1;
      }
    }

    // Doors whose argument is an object are read key by key. A door that declares `resolveObject`
    // asks for a record; the domains it declares are what an expression key is expanded over, so
    // nothing here is guessed and the domain lives beside the door instead of inside a gate.
    if (door.resolveObject) {
      for (const site of objectCallSites(code, door.name)) {
        const keys = objectArgumentKeys(site);
        const records = keys && recordsFor(keys, door.domains);
        if (!records) continue;
        for (const record of records) {
          for (const cls of door.resolveObject(record) ?? []) classes.add(cls);
        }
        answered += 1;
      }
    }

    resolved += answered;
    // A call this reader could not answer: either the door declares itself unresolvable, or its
    // arguments were expressions it has no declared domain for. Both are perimeter, said out loud.
    const unanswered = allSites - answered;
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
