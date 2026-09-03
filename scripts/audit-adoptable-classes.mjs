/**
 * How many class literals a renderer writes that a door would have answered.
 *
 * The census counts `mdy-` class literals per package. That number says how much contract logic is
 * written by hand; it does not say how much of it *could stop being*. "The descent is finished" is a
 * claim about the second, and it was being asserted from the first — 356 literals against a column
 * counting custom element tags, which is an irreducible residue and not a target.
 *
 * So this asks the question the claim actually rests on: **of the classes a renderer spells out, how
 * many are in the set the doors can produce?** Those are adoption work that still exists. The rest
 * are either the renderer's own decisions or classes no door offers, and the two are different
 * findings — the second is a gap in the contract, not debt in the renderer.
 *
 * **The producible set is enumerated from the declarations, never guessed.** Each door is expanded
 * over the domain it declares: parts from the widget contract, presentations from the kind's own
 * `presentationClasses`, positional arguments from `argDomains`, object keys from `domains`. A door
 * that declares itself unresolvable is *not* expanded, and its range is reported as a perimeter —
 * `stateClass` takes a class and a state, so the classes it can produce are unbounded from here, and
 * a literal that only `stateClass` could have made will read as un-adoptable in this count. That
 * direction is stated rather than hidden: this number is a **lower bound** on adoptable work.
 *
 *   node scripts/audit-adoptable-classes.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const { MDY_CLASS_DOORS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, MDY_FIELD_STATE_CLASSES } =
  await import(new URL("../packages/widgets/dist/index.js", import.meta.url).href);

/** Every class the doors can put on an element, expanded over the domains they declare. */
function producibleClasses() {
  const classes = new Set();
  /** For each producible class, one call that produces it — so a batch has the replacement, not just the target. */
  const madeBy = new Map();
  const perimeter = [];
  const add = (values, how) => {
    for (const c of values ?? []) {
      classes.add(c);
      if (how && !madeBy.has(c)) madeBy.set(c, how);
    }
  };
  const partsOf = (kind) => Object.keys(MDY_WIDGET_CONTRACTS[kind]?.parts ?? {});
  const presentationsOf = (kind) => Object.keys(MDY_WIDGET_CONTRACTS[kind]?.presentationClasses ?? {});

  // `stateClass` declares itself unresolvable — it takes a class and a state, so its range is open.
  // But the contract publishes the pairings that matter: which base reflects which states. Those are
  // expanded, and **only those**: crossing every base with every state would invent classes the
  // contract never declares — `mdy-label--open` — and a producible set that is too wide reclassifies
  // a renderer's own decision as adoption owed. That is the direction that manufactures work, and it
  // is the one this measure exists to avoid.
  const PAIRINGS = [
    [MDY_FIELD_STATE_CLASSES.field, MDY_FIELD_STATE_CLASSES.fieldStates],
    [MDY_FIELD_STATE_CLASSES.control, MDY_FIELD_STATE_CLASSES.controlStates],
    [MDY_FIELD_STATE_CLASSES.label, MDY_FIELD_STATE_CLASSES.labelStates],
  ];
  for (const [base, modifiers] of PAIRINGS) {
    // Composed directly, not through `stateClass`. Those arrays hold **modifiers** — the string that
    // lands after the `--` — while `stateClass` takes a **state name** and looks its modifier up.
    // Some spellings coincide ("open" is both) and some do not: `stateClass(label, "has-error")`
    // returns `mdy-label--undefined`, a class that cannot exist, because "has-error" is already the
    // modifier. One word, two things, and it produced a phantom in the producible set on the first
    // attempt — the exact over-production this measure must not commit.
    for (const modifier of modifiers ?? []) add([`${base}--${modifier}`], `"${base}--${modifier}" — declared by MDY_FIELD_STATE_CLASSES`);
  }

  for (const door of MDY_CLASS_DOORS) {
    if (door.unresolvable) {
      perimeter.push(`${door.name} — ${door.unresolvable}`);
      continue;
    }
    if (door.resolvePath) {
      for (const kind of MDY_WIDGET_KINDS) for (const part of partsOf(kind)) add(door.resolvePath(kind, part), `${door.name}(<kind>, "${part}")`);
      continue;
    }
    if (door.resolveObject) {
      const domains = door.domains ?? {};
      const records = Object.keys(domains).reduce(
        (acc, key) => acc.flatMap((record) => domains[key].map((value) => ({ ...record, [key]: value }))),
        [{}],
      );
      for (const record of records) add(door.resolveObject(record), `${door.name}(${JSON.stringify(record)})`);
      continue;
    }
    if (!door.resolve) { perimeter.push(`${door.name} — a shape this reader has not been taught`); continue; }
    // Positional. The second argument's domain is whatever the door declares; where it declares
    // none, the door takes a part or a presentation, and which of the two is read from the contract
    // rather than assumed — asking presentationClass for a part name throws by design.
    const declared = door.argDomains?.[1];
    for (const kind of MDY_WIDGET_KINDS) {
      const second = declared ?? [...partsOf(kind), ...presentationsOf(kind)];
      for (const value of second) {
        try { add(door.resolve([kind, value]), `${door.name}(<kind>, "${value}")`); } catch { /* the door refuses what the kind does not have */ }
      }
    }
  }
  return { classes, perimeter, madeBy };
}

const { classes: producible, perimeter, madeBy } = producibleClasses();

// A class name is written two ways and both are the same fact: bare in a `class` attribute, and
// with a leading dot in a `querySelector`. The first reading saw only the bare form and missed 52
// distinct names across the three renderers — including the one that sent me looking, plain's
// `".mdy-chip"`, which decides where focus lands when a panel opens.
//
// The dot also settles the tag question: a custom element tag is never written with one, so a dotted
// literal is a class even when its text matches a tag.
const CLASS_LITERAL = /["'`](\.)?(mdy-[a-z0-9_-]+)/g;
const ELEMENT_TAG = /["'`](mdy-[a-z]+(?:-[a-z]+)*)["'`]\s*[,)\]]/g;
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

function sourcesOf(dir) {
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const path = join(at, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (/\.(ts|js|mjs)$/.test(entry) && !/\.spec\.ts$|\.test\./.test(entry)) out.push(path);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const PACKAGES = ["plain", "lit", "angular"];
console.log("# Class literals a door would have answered\n");
console.log(`The doors can produce ${producible.size} distinct class(es), expanded over the domains`);
console.log("they declare. A literal in that set is adoption still owed; one outside it is either the");
console.log("renderer's own decision or a class no door offers, and those are different findings.\n");

let totalAdoptable = 0;
for (const pkg of PACKAGES) {
  const dir = join(ROOT, "packages", pkg, pkg === "angular" ? "src/lib" : "src");
  const adoptable = new Map();
  const own = new Set();
  for (const file of sourcesOf(dir)) {
    const source = strip(readFileSync(file, "utf8"));
    const tags = new Set([...source.matchAll(ELEMENT_TAG)].map((m) => m[1]));
    for (const [, dotted, name] of source.matchAll(CLASS_LITERAL)) {
      if (!dotted && tags.has(name)) continue;
      if (producible.has(name)) {
        if (!adoptable.has(name)) adoptable.set(name, relative(ROOT, file));
      } else own.add(name);
    }
  }
  totalAdoptable += adoptable.size;
  console.log(`${pkg.padEnd(9)} ${String(adoptable.size).padStart(4)} distinct class(es) a door produces`
    + `  ·  ${String(own.size).padStart(4)} no door offers`);
  const shown = process.argv.includes("--all") ? [...adoptable] : [...adoptable].slice(0, 8);
  for (const [name, where] of shown) {
    console.log(`    ${name.padEnd(34)} ${(madeBy.get(name) ?? "?").padEnd(46)} ${where}`);
  }
  if (process.argv.includes("--own")) for (const n of [...own].slice(0, 10)) console.log(`    (no door) ${n}`);
  if (adoptable.size > shown.length) console.log(`    … and ${adoptable.size - shown.length} more (--all to list them)`);
}

console.log(`\nAdoptable across the three renderers: ${totalAdoptable} distinct class name(s).`);
// The kind is written `<kind>` on purpose, and the reason is a defect waiting to be committed.
//
// A part's answer is not always the same across kinds: `partClasses(kind, "label")` gives
// `mdy-label` for sixteen kinds and **`mdy-toggle__label`** for toggle. So a batch that pasted the
// kind this tool happened to enumerate first would write `partClasses("text", "label")` into a
// toggle renderer and change the class it emits — a defect that reads as clean adoption in the diff,
// because the line it replaced was correct only where the contract does not differentiate.
//
// The part is the transferable half; the kind belongs to the call site.
console.log("The kind is shown as `<kind>`: it is the site's own, never the one enumerated here. A");
console.log("part does not always answer the same across kinds — partClasses(kind, \"label\") is");
console.log("mdy-label for sixteen and mdy-toggle__label for toggle — so pasting a kind from this");
console.log("report would change what a renderer emits while looking like adoption.");
console.log("This is a LOWER bound. `stateClass` is expanded only over the base-to-states pairings");
console.log("the contract publishes, so a state modifier on any other base — a calendar cell, a");
console.log("swatch — is counted as un-adoptable even where stateClass would produce it. Widening");
console.log("that would need the pairing declared, not guessed. Doors still unexpanded:");
for (const one of perimeter) console.log(`  ${one}`);
