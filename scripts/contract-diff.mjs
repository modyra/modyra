/**
 * Compares the widget contract against its committed snapshot, prints what moved in the contract's
 * own vocabulary, and classifies the change as patch, minor or major.
 *
 * This is what a host reads instead of diffing thousands of lines of DOM between releases. The
 * classification is the part that has to be right: a renamed part or a changed relation breaks
 * every renderer and every theme built against it, while a new optional part breaks nobody.
 *
 *   node scripts/contract-diff.mjs            # print the diff and the classification
 *   node scripts/contract-diff.mjs --write    # accept the current contract as the new snapshot
 *   node scripts/contract-diff.mjs --check    # fail if the contract moved without the snapshot
 *   node scripts/contract-diff.mjs --since <ref>   # compare against the snapshot at a git ref
 *
 * `--since` is what answers "what changed in this release". Comparing against the working snapshot
 * can only ever catch a contract edit that forgot to update it: once the snapshot is updated the
 * two agree again and the change becomes invisible. Reading the snapshot as it was at a ref — the
 * release tag, or the base branch — is the only way to see a change that was correctly recorded.
 *
 * The snapshot holds only what a consumer can observe and depend on. Anything a renderer is free to
 * choose is left out on purpose: a snapshot that froze it would report a breaking change every time
 * someone reorganised an implementation detail, and a report that cries wolf stops being read.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  MDY_FORM_SHELL_CLASSES, MDY_LAYOUT_CLASSES,
  MDY_WIDGET_CONTRACTS, MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_KEYBOARD, MDY_WIDGET_KINDS,
  MDY_WIDGET_RELATIONS,
} from "../packages/widgets/dist/index.js";
// Through the door it is published from, not the barrel: this vocabulary belongs to the
// `./vocabulary` subpath, and every public name in this package answers at exactly one door.
import { MDY_SHARED_UI_CLASSES } from "../packages/widgets/dist/vocabulary.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const SNAPSHOT = resolve(root, "packages/widgets/contract-baseline/contract-snapshot.json");

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const sinceFlag = process.argv.indexOf("--since");
const since = sinceFlag === -1 ? null : process.argv[sinceFlag + 1];
if (sinceFlag !== -1 && (!since || since.startsWith("--"))) {
  console.error("contract-diff: --since needs a git ref");
  process.exit(2);
}

/** The contract as a consumer sees it: parts, where they hang, what they are, and what refers to what. */
function snapshot() {
  const kinds = {};
  for (const kind of MDY_WIDGET_KINDS) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    const parts = {};
    for (const node of definition.structure.nodes) {
      const part = definition.parts[node.part] ?? {};
      parts[node.part] = {
        element: node.element,
        parent: node.parent ?? null,
        optional: node.optional === true,
        repeated: node.repeated === true,
        role: part.role ?? null,
        classes: [...(part.classes ?? [])].sort(),
        states: [...(part.states ?? [])].sort(),
      };
    }
    kinds[kind] = {
      // How the value is read, which decides whether the kind is drawn in a box. Public: a consumer
      // theming a control reads it to know what to draw, and changing it changes what every renderer
      // draws for that kind.
      valueSlot: definition.valueSlot,
      parts,
      // Ordered as declared: a relation's `to` is a preference order, so reordering it changes
      // which element a reference resolves to and is not a cosmetic change.
      relations: (MDY_WIDGET_RELATIONS[kind] ?? []).map((relation) => ({
        from: relation.from, attribute: relation.attribute, to: [...relation.to],
      })),
      capabilities: definition.capabilities,
      // Anatomy that depends on configuration. Recorded per variant and sorted, because a variant
      // is a promise about a configured instance: gaining one widens what the kind admits, losing
      // one withdraws a shape a consumer may be rendering, and changing what one requires is the
      // same class of change as changing a kind's own required list.
      variants: Object.fromEntries(
        Object.entries(definition.variants ?? {}).map(([variant, shape]) => [variant, {
          elements: { ...shape.elements },
          required: [...shape.required].sort(),
        }]),
      ),
      // The bindings themselves, not `Object.keys` of the array — that recorded "0", "1", "2", so the
      // diff compared how *many* keys a kind declared and never which. Renaming Escape to Enter was
      // invisible; declaring Tab reported "key declared: 8".
      keyboard: (MDY_WIDGET_KEYBOARD[kind] ?? [])
        .map((b) => `${b.key === " " ? "Space" : b.key}${b.when ? `@${b.when}` : ""}:${b.intent}`)
        .sort(),
    };
  }
  return {
    contractVersion: MDY_WIDGET_CONTRACT_VERSION,
    kinds,
    scale: scaleTokens(),
    shared: sharedClassNames(),
  };
}

/**
 * The class names that belong to no kind, which are public surface all the same.
 *
 * Everything above is reached through a kind's anatomy, so a name outside one was invisible here:
 * the shared button, the overlay machinery, a layout's own boxes, the form shell. Seven of them are
 * selected on by the themes shipped in this repository, so the dependency was real while a rename
 * would have passed as an internal change — and `contract:diff` said so, by omission.
 *
 * **Named one at a time, not discovered by shape.** A vocabulary is sometimes an array and sometimes
 * a dictionary, and a flat dictionary is the degenerate case of a table with one column — a rule
 * that reads the shape cannot tell the two apart, and quietly stops covering whichever one it did
 * not anticipate. Adding a vocabulary here is a line; guessing at them is a rule that goes wrong in
 * silence.
 *
 * **Names, not values**, for the reason the scale gives above: what a class *is* belongs to a theme,
 * and what a consumer cannot survive is a name that stops answering.
 */
function sharedClassNames() {
  const vocabularies = {
    sharedUi: MDY_SHARED_UI_CLASSES,
    layout: MDY_LAYOUT_CLASSES,
    formShell: MDY_FORM_SHELL_CLASSES,
  };
  const named = {};
  for (const [name, vocabulary] of Object.entries(vocabularies)) {
    const values = Array.isArray(vocabulary) ? vocabulary : Object.values(vocabulary);
    named[name] = [...new Set(values.flat().filter((one) => typeof one === "string"))].sort();
  }
  return named;
}

/**
 * The scale's step names, which are public surface.
 *
 * A consumer builds a theme by setting these; renaming one breaks them exactly as renaming a part
 * does, and until now nothing here could see it. The names are read from the sheet rather than listed,
 * so a step added or renamed shows up without anybody remembering to record it.
 *
 * **Names, not values.** A theme is expected to change what a step *is* — that is what a theme is for
 * — so recording values would report every theme as a contract change. What a consumer cannot survive
 * is a name that stops answering.
 */
function scaleTokens() {
  const sheet = readFileSync(resolve(root, "packages/styles/src/modyra-scale.css"), "utf8");
  // Declarations only: a `var(--mdy-…)` reading a step is a use, not a definition, and counting it
  // would make the snapshot depend on which rules happen to consume which step.
  const declared = [...sheet.matchAll(/^\s*(--mdy-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
  return [...new Set(declared)].sort();
}

/** `major` breaks a consumer, `minor` gives it something new, `patch` changes nothing it can see. */
const SEVERITY = { patch: 0, minor: 1, major: 2 };
const changes = [];
const record = (severity, scope, message) => changes.push({ severity, scope, message });

const current = snapshot();

if (write) {
  writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`snapshot written: ${MDY_WIDGET_KINDS.length} kinds at contract version ${current.contractVersion}`);
  process.exit(0);
}

let baseline;
let baselineName;
try {
  if (since) {
    const path = relative(root, SNAPSHOT);
    baseline = JSON.parse(execFileSync("git", ["show", `${since}:${path}`], { cwd: root, encoding: "utf8" }));
    baselineName = `the snapshot at ${since}`;
  } else {
    baseline = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    baselineName = "the committed snapshot";
  }
} catch (error) {
  console.error(
    since
      ? `Cannot read the contract snapshot at ${since}: ${error.message.split("\n")[0]}`
      : `No contract snapshot at ${SNAPSHOT}. Create one with --write.`,
  );
  process.exit(2);
}

if (baseline.contractVersion !== current.contractVersion) {
  record("major", "contract", `contract version changed: ${baseline.contractVersion} → ${current.contractVersion}`);
}

// The scale is compared before the kinds because a step that stops answering breaks every theme built
// on it, whichever kinds happen to use it.
const heldScale = Array.isArray(baseline.scale) ? baseline.scale : null;
if (heldScale === null) {
  record("minor", "scale", `scale steps now recorded: ${current.scale.length} step(s)`);
} else {
  for (const step of heldScale) {
    if (!current.scale.includes(step)) record("major", "scale", `step removed: ${step}`);
  }
  for (const step of current.scale) {
    if (!heldScale.includes(step)) record("minor", "scale", `step added: ${step}`);
  }
}

// The same comparison for the names that belong to no kind. A class a theme selects on breaks that
// theme when it is renamed, and whether the name sits inside a kind's anatomy makes no difference to
// the stylesheet that stops matching.
const heldShared = baseline.shared ?? null;
if (heldShared === null) {
  const counted = Object.values(current.shared).reduce((sum, names) => sum + names.length, 0);
  record("minor", "shared", `class names outside a kind now recorded: ${counted} across `
    + `${Object.keys(current.shared).length} vocabular(y|ies)`);
} else {
  for (const [vocabulary, names] of Object.entries(heldShared)) {
    const now = current.shared[vocabulary] ?? [];
    for (const name of names) {
      if (!now.includes(name)) record("major", `shared.${vocabulary}`, `class removed: ${name}`);
    }
  }
  for (const [vocabulary, names] of Object.entries(current.shared)) {
    const before = heldShared[vocabulary] ?? [];
    for (const name of names) {
      if (!before.includes(name)) record("minor", `shared.${vocabulary}`, `class added: ${name}`);
    }
  }
}

for (const [kind, held] of Object.entries(baseline.kinds)) {
  const now = current.kinds[kind];
  if (!now) continue;
  if (held.valueSlot === undefined) {
    record("minor", kind, `value slot now recorded: ${now.valueSlot}`);
  } else if (held.valueSlot !== now.valueSlot) {
    // Every renderer draws this kind differently afterwards, and a theme keyed on the box is drawing
    // it for a control that no longer has one — or failing to for one that now does.
    record("major", kind, `value slot changed: ${held.valueSlot} → ${now.valueSlot}`);
  }
}

for (const kind of Object.keys(baseline.kinds)) {
  if (!current.kinds[kind]) record("major", kind, "kind removed");
}
for (const kind of Object.keys(current.kinds)) {
  if (!baseline.kinds[kind]) record("minor", kind, "new kind");
}

for (const kind of Object.keys(current.kinds).filter((k) => baseline.kinds[k])) {
  const was = baseline.kinds[kind];
  const now = current.kinds[kind];

  for (const part of Object.keys(was.parts)) {
    if (!now.parts[part]) record("major", `${kind}.${part}`, "part removed");
  }
  for (const part of Object.keys(now.parts)) {
    if (was.parts[part]) continue;
    // A new part a renderer must emit is a new obligation, and every existing renderer fails it.
    const optional = now.parts[part].optional;
    record(optional ? "minor" : "major", `${kind}.${part}`, optional ? "new optional part" : "new required part");
  }

  for (const part of Object.keys(now.parts).filter((p) => was.parts[p])) {
    const a = was.parts[part];
    const b = now.parts[part];
    const at = `${kind}.${part}`;

    if (a.element !== b.element) record("major", at, `element changed: ${a.element} → ${b.element}`);
    if (a.parent !== b.parent) record("major", at, `parent changed: ${a.parent ?? "none"} → ${b.parent ?? "none"}`);
    if (a.role !== b.role) record("major", at, `role changed: ${a.role ?? "none"} → ${b.role ?? "none"}`);
    if (a.repeated !== b.repeated) record("major", at, `cardinality changed: ${a.repeated ? "0..n" : "0..1"} → ${b.repeated ? "0..n" : "0..1"}`);
    // Optional becoming required is a new obligation; required becoming optional takes one away,
    // which no consumer that already met it can notice.
    if (a.optional !== b.optional) {
      record(b.optional ? "minor" : "major", at, `presence changed: ${a.optional ? "optional" : "required"} → ${b.optional ? "optional" : "required"}`);
    }

    for (const gone of a.classes.filter((c) => !b.classes.includes(c))) {
      // Themes select on these. A class that stops being emitted is a rule that stops matching.
      record("major", at, `class removed: ${gone}`);
    }
    for (const added of b.classes.filter((c) => !a.classes.includes(c))) {
      record("minor", at, `class added: ${added}`);
    }
    for (const gone of a.states.filter((s) => !b.states.includes(s))) {
      record("major", at, `state removed: ${gone}`);
    }
    for (const added of b.states.filter((s) => !a.states.includes(s))) {
      record("minor", at, `state added: ${added}`);
    }
  }

  const relationKey = (relation) => `${relation.from}[${relation.attribute}]`;
  const wasRelations = new Map(was.relations.map((r) => [relationKey(r), r]));
  const nowRelations = new Map(now.relations.map((r) => [relationKey(r), r]));
  for (const [key, relation] of wasRelations) {
    if (!nowRelations.has(key)) record("major", kind, `relationship removed: ${key} → ${relation.to.join(", ")}`);
  }
  for (const [key, relation] of nowRelations) {
    if (!wasRelations.has(key)) record("minor", kind, `relationship added: ${key} → ${relation.to.join(", ")}`);
    else {
      const before = wasRelations.get(key).to;
      if (before.join(",") !== relation.to.join(",")) {
        record("major", kind, `relationship retargeted: ${key} → ${before.join(", ")} became ${relation.to.join(", ")}`);
      }
    }
  }

  // Over the union of both sides. Iterating the *current* capabilities alone could never see one
  // that had been withdrawn — it is not there to iterate — which is the change the compatibility
  // table calls major and the only one this comparison exists to catch.
  /**
   * Whether a capability's new value takes away something its old value promised.
   *
   * Three shapes of the same loss: the capability is gone, it has become falsy, or it is still an
   * object and no longer answers a question it used to. Only the first two were checked, so a
   * reshaped capability — the kind a consumer destructures — classified as minor.
   */
  const withdrawsInformation = (before, value) => {
    if (before === undefined || before === false) return false;
    if (value === undefined || value === false) return true;
    if (typeof before !== "object" || before === null) return false;
    // An object answered questions by key. A value that is not an object answers none of them, so
    // every one of them is withdrawn — `{ event }` becoming a string takes `.event` with it just as
    // surely as deleting the property would.
    if (typeof value !== "object" || value === null) return true;
    return Object.keys(before).some((key) => !(key in value));
  };

  const capabilityNames = new Set([
    ...Object.keys(now.capabilities ?? {}),
    ...Object.keys(was.capabilities ?? {}),
  ]);
  for (const capability of capabilityNames) {
    const value = now.capabilities?.[capability];
    const before = was.capabilities?.[capability];
    if (JSON.stringify(before) !== JSON.stringify(value)) {
      // Withdrawing a capability breaks a consumer relying on it; granting one cannot. Withdrawal
      // is not only the capability disappearing: a capability that keeps its name and loses a
      // property withdraws that property, and `caps.x.event` stops resolving exactly as
      // `caps.x === true` stopped holding when the boolean became a union.
      record(withdrawsInformation(before, value) ? "major" : "minor", kind,
        `capability ${capability}: ${JSON.stringify(before) ?? "none"} → ${JSON.stringify(value)}`);
    }
  }

  /**
   * A binding recorded as `Key@phase:intent`, with the phase absent where it answers in both.
   *
   * Dropping the phase *widens* a binding: a key that answered only while open now answers always,
   * and nobody who relied on the open behaviour loses it. Compared as strings that reads as one
   * binding removed and another added — a major and a minor for a change that takes nothing away.
   *
   * The disagreement is worth more than either verdict: the string comparison is right that the old
   * spelling is gone, and wrong about what a consumer can survive. So the widening is recognised
   * here rather than argued around at each call site.
   */
  const widens = (gone) => {
    const [head, intent] = gone.split(":");
    const [key] = head.split("@");
    return head.includes("@") && now.keyboard.includes(`${key}:${intent}`);
  };
  for (const gone of was.keyboard.filter((k) => !now.keyboard.includes(k))) {
    if (widens(gone)) {
      record("minor", kind, `key now answers in every phase: ${gone.split("@")[0]}`);
      continue;
    }
    record("major", kind, `key no longer declared: ${gone}`);
  }
  for (const added of now.keyboard.filter((k) => !was.keyboard.includes(k))) {
    record("minor", kind, `key declared: ${added}`);
  }

  // Variants, over the union of both sides — a withdrawn one is not there to iterate on the current
  // side, and withdrawing a shape a consumer may be rendering is the loss this comparison is for.
  const wasVariants = was.variants ?? {};
  const nowVariants = now.variants ?? {};
  for (const variant of new Set([...Object.keys(wasVariants), ...Object.keys(nowVariants)])) {
    const before = wasVariants[variant];
    const after = nowVariants[variant];
    if (before && !after) { record("major", kind, `variant withdrawn: ${variant}`); continue; }
    if (!before && after) { record("minor", kind, `variant declared: ${variant}`); continue; }
    for (const part of new Set([...(before.required ?? []), ...(after.required ?? [])])) {
      const wasRequired = (before.required ?? []).includes(part);
      const nowRequired = (after.required ?? []).includes(part);
      // Requiring more of a configured instance is the same class of change as requiring more of a
      // kind: an adapter that did not draw it stops conforming.
      if (!wasRequired && nowRequired) record("major", kind, `variant ${variant} now requires ${part}`);
      if (wasRequired && !nowRequired) record("minor", kind, `variant ${variant} no longer requires ${part}`);
    }
    for (const part of new Set([...Object.keys(before.elements ?? {}), ...Object.keys(after.elements ?? {})])) {
      const from = before.elements?.[part];
      const to = after.elements?.[part];
      if (from !== to) record("major", kind, `variant ${variant} element changed: ${part} ${from ?? "—"} → ${to ?? "—"}`);
    }
  }
}

const level = changes.reduce((worst, change) => (SEVERITY[change.severity] > SEVERITY[worst] ? change.severity : worst), "patch");

if (changes.length === 0) {
  console.log(`Contract unchanged against ${baselineName} — ${MDY_WIDGET_KINDS.length} kinds at version ${current.contractVersion}.`);
  console.log("\nclassification: patch");
  process.exit(0);
}

const byScope = new Map();
for (const change of changes) {
  if (!byScope.has(change.scope)) byScope.set(change.scope, []);
  byScope.get(change.scope).push(change);
}
for (const [scope, scoped] of byScope) {
  console.log(`${scope}:`);
  for (const change of scoped) console.log(`  ${change.message}  [${change.severity}]`);
}

console.log(`\nclassification: ${level}`);
console.log(`  ${changes.filter((c) => c.severity === "major").length} major · ${changes.filter((c) => c.severity === "minor").length} minor`);

if (process.argv.includes("--require-changeset")) {
  const declared = declaredReleaseLevel();
  console.log(`\nchangesets declare: ${declared ?? "nothing"}`);
  if (SEVERITY[declared ?? "patch"] < SEVERITY[level]) {
    console.error(
      `\nCONTRACT CHANGE UNDERSTATED — the contract moved by a ${level}, `
      + `but the pending changesets declare ${declared ?? "no release"}.`,
    );
    console.error(`Add a changeset marking a @modyra package as "${level}".`);
    process.exit(1);
  }
  console.log("the declared release covers the contract change");
}

if (check) {
  console.error("\nCONTRACT MOVED — review the classification above, then accept it with `npm run contract:snapshot`.");
  process.exit(1);
}

/**
 * The largest bump the pending changesets ask for, across every Modyra package.
 *
 * Any of them will do, because `fixed: [["@modyra/*"]]` moves the workspace as one version: a minor
 * on the engine releases the contract as a minor whether or not the contract's own package is
 * named. Checking only `@modyra/widgets` would demand a second changeset that changes no version.
 */
function declaredReleaseLevel() {
  let highest = null;
  for (const file of readdirSync(resolve(root, ".changeset"))) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const text = readFileSync(resolve(root, ".changeset", file), "utf8");
    const frontmatter = text.split("---")[1];
    if (!frontmatter) continue;
    for (const [, bump] of frontmatter.matchAll(/"@modyra\/[^"]+"\s*:\s*(patch|minor|major)/g)) {
      if (highest === null || SEVERITY[bump] > SEVERITY[highest]) highest = bump;
    }
  }
  return highest;
}
