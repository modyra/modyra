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
import { scaleStepNames } from "./lib/scale-steps.mjs";
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
    for (const [at, node] of definition.structure.nodes.entries()) {
      const part = definition.parts[node.part] ?? {};
      parts[node.part] = {
        // Where the part sits among its siblings, which `contracts.ts` states is the reading order.
        // Recorded because moving a name inside the list changes what a screen reader says next on a
        // widget that has already shipped, and nothing else in this entry moves when it does: every
        // other field describes the part itself, and a reorder changes none of them.
        order: at,
        element: node.element,
        parent: node.parent ?? null,
        optional: node.optional === true,
        presentWhen: node.presentWhen ?? null,
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
      // The native control a kind is drawn with, and whether what it holds is concealed. Both are
      // declarations an adapter implements, so both are public in the sense that matters here: a
      // renderer reads them to decide what to draw.
      //
      // `concealed` is the whole of what separates `password` from `text`. Without it in the
      // snapshot, removing it reported "Contract unchanged" and classified `patch` — the tool with
      // authority over a release being blind to the one fact that keeps a secret off the screen.
      controlType: definition.controlType,
      concealed: definition.concealed,
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
      // Every field a binding carries, not the three it used to. A binding says which key, in which
      // phase, at which part, with what held, and what happens to focus — and only the first three
      // were recorded, so `Escape` gaining `modifier: "any"` moved nothing here while it changed
      // whether a person can leave a panel with a modifier down. A gesture nobody can perform any
      // more is a break, and a field that decides whether it can be performed belongs in the record.
      keyboard: (MDY_WIDGET_KEYBOARD[kind] ?? [])
        .map((b) => [
          `${b.key === " " ? "Space" : b.key}${b.when ? `@${b.when}` : ""}:${b.intent}`,
          b.on === undefined ? "" : ` on=${b.on}`,
          b.modifier === undefined ? "" : ` mod=${b.modifier}`,
          b.by === undefined ? "" : ` by=${b.by}`,
          b.toEnd === true ? " toEnd" : "",
          b.page === true ? " page" : "",
          b.longStride === true ? " longStride" : "",
          b.restoresFocus === undefined ? "" : ` focus=${b.restoresFocus}`,
          b.requires === undefined ? "" : ` requires=${b.requires}`,
          b.awaits === undefined ? "" : ` awaits=${b.awaits}`,
        ].join(""))
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
const scaleTokens = scaleStepNames;


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

/**
 * The two declarations a renderer reads to decide what control to draw.
 *
 * Gaining one is `minor`: nothing a consumer had stops working, and a renderer that ignores it draws
 * what it drew before. Changing or losing one is `major`, and not by symmetry — an adapter that read
 * a value and no longer finds it draws something else, and for `concealed` that something else is
 * the secret in plain text.
 */
/**
 * A field absent from every kind in the baseline is a field this snapshot has just learned to
 * record — the instrument grew, not the subject.
 *
 * It is the one moment the tool knows it is the cause, and the only moment: the verdict travels into
 * a changeset, where a reader sees `minor` beside a kind and attributes it to the code. So it is
 * marked here rather than left to be inferred. Told apart by the shape of the absence — a snapshot
 * that widened lacks the key for *every* kind, while a declaration genuinely added to one kind sits
 * beside the same key present on the others.
 */
/**
 * Every field a kind record carries, and what compares it.
 *
 * The scalar list below was written by hand and named two fields. That was right when it was
 * written and it is right today — but a field added to a kind tomorrow would be compared by nothing
 * and classify as `patch`, and the list would go on looking complete. This roster is the species
 * this repository has spent the week removing: what a hand-written list does not name, it excuses.
 *
 * So the accounting is closed instead of assumed. Each kind-level field is either compared
 * structurally by a block of its own, or scalar and compared below; a field that is neither is
 * reported, because the alternative is a change to the contract that no verdict can see.
 */
const COMPARED_STRUCTURALLY = new Set(["parts", "relations", "capabilities", "variants", "keyboard"]);
// Fields the loop below compares generically. `valueSlot` is not among them: it has a comparison of
// its own further down, with wording this loop cannot produce, and listing it in both reported one
// change twice — the accounting is a question about coverage, not an instruction to compare.
const COMPARED_AS_A_VALUE = ["controlType", "concealed"];
const COMPARED_BY_ITS_OWN_BRANCH = new Set(["valueSlot"]);
const accountedFor = new Set([...COMPARED_STRUCTURALLY, ...COMPARED_AS_A_VALUE, ...COMPARED_BY_ITS_OWN_BRANCH]);
const unaccountedFields = [...new Set(
  [...Object.values(baseline.kinds), ...Object.values(current.kinds)].flatMap((kind) => Object.keys(kind)),
)].filter((field) => !accountedFor.has(field)).sort();
for (const field of unaccountedFields) {
  record("major", "contract", `kinds carry \`${field}\` and nothing compares it — give it a `
    + "comparison, or say here why a change to it cannot break a consumer");
}

const newToTheSnapshot = new Set(
  COMPARED_AS_A_VALUE.filter(
    (field) => !Object.values(baseline.kinds).some((held) => field in held),
  ),
);

for (const [kind, held] of Object.entries(baseline.kinds)) {
  const now = current.kinds[kind];
  if (!now) continue;
  for (const field of COMPARED_AS_A_VALUE) {
    const was = held[field];
    const is = now[field];
    if (was === is) continue;
    if (was === undefined) {
      record("minor", kind, newToTheSnapshot.has(field)
        ? `${field} now recorded: ${JSON.stringify(is)} — new to this snapshot, not to the contract`
        : `${field} now declared: ${JSON.stringify(is)}`);
    } else if (is === undefined) {
      record("major", kind, `${field} no longer declared (was ${JSON.stringify(was)})`);
    } else {
      record("major", kind, `${field} changed: ${JSON.stringify(was)} → ${JSON.stringify(is)}`);
    }
  }
}

/**
 * The vocabularies a consumer reads, taken across every kind rather than the one being compared.
 *
 * **Which side of a change a consumer sits on decides its size.** A binding added to a kind grants
 * a gesture, and nobody who never pressed it loses anything — additive, and that is what this
 * reported for every one. But a binding whose *intent* is new to the contract grows a vocabulary
 * consumers read back: `binding.intent` is what a renderer switches on to decide what a press does,
 * and an exhaustive switch over the old set has no arm for the new value. The gesture is a gift to
 * whoever presses it and a break for whoever reads it, and the reader is the one who ships code.
 *
 * Taken contract-wide because the vocabulary is: an intent already declared by another kind is one
 * a consumer's switch has an arm for, whichever kind it turns up on next.
 *
 * **`intent` and nothing else, and that was measured rather than assumed.** A binding also carries
 * `when` and `on`, which are read too — but every read of those is an equality test: `binding.when
 * !== phase`, `binding.on !== opener`, `!parts.includes(binding.on)`. A value new to either simply
 * fails to match, and nothing that worked stops working. `intent` is dispatched instead — `switch
 * (binding.intent)` with an arm per value and no arm for a stranger — so a value new to it makes a
 * declared gesture do nothing at a consumer who has not been rebuilt. Extending this rule to the
 * other two would report a break where none exists, which is the same defect as missing one.
 */
const intentsOf = (contract) => new Set(
  Object.values(contract.kinds).flatMap((kind) => (kind.keyboard ?? []).map(
    (entry) => entry.split(" ")[0].split(":").slice(1).join(":"))));
const knownIntents = intentsOf(baseline);

/**
 * Which binding attributes the baseline records at all — so a field this tool learned to write is
 * not reported as a contract that changed.
 *
 * The first snapshot after a field enters the record has it on no entry, so every binding that
 * declares it reads as a binding whose behaviour was retyped. That verdict travels into a changeset
 * and nobody can tell afterwards that the tool was the cause. Discriminated by the shape of the
 * absence: a field missing from *every* baseline entry is one the snapshot never carried, while a
 * field the baseline has elsewhere and this binding lost is a real withdrawal.
 */
const attributeNames = (contract) => new Set(
  Object.values(contract.kinds).flatMap((kind) => (kind.keyboard ?? []).flatMap(
    (entry) => entry.split(" ").slice(1).map((part) => part.split("=")[0]))));
const recordedAttributes = attributeNames(baseline);
const bindingFieldsNewToTheSnapshot = [...attributeNames(current)].filter((name) => !recordedAttributes.has(name));
if (bindingFieldsNewToTheSnapshot.length > 0) {
  record("minor", "keyboard", `${bindingFieldsNewToTheSnapshot.join(", ")} now recorded — `
    + "new to this snapshot, not to the contract");
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
    // When an optional part is on the page. Gaining a condition tells a renderer something it was
    // deciding for itself, and breaks nothing it already does. Changing one moves the moment it has
    // to build the part; losing one takes back a rule a renderer was reading. Both are breaking, and
    // this field was invisible here while every optional node in the contract gained one.
    // A snapshot taken before this field existed has no key for it, so both sides are normalised:
    // `undefined` from an older snapshot and `null` from a node that states no condition are the same
    // absence, and comparing them raw reports a change on every node in the contract.
    const wasWhen = a.presentWhen ?? null;
    const nowWhen = b.presentWhen ?? null;
    if (wasWhen !== nowWhen) {
      record(wasWhen === null ? "minor" : "major", at,
        `presence condition: ${wasWhen ?? "unstated"} → ${nowWhen ?? "unstated"}`);
    }

    // The reading order. A snapshot taken before this field existed has no key for it, and an absent
    // order is not order zero — comparing raw would report a move on every part in the contract the
    // first time this runs. Breaking either way: a person hears the parts in the order they are in,
    // and both directions change what they hear.
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      record("major", at, `reading order: position ${a.order} → ${b.order}`);
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
   * A binding is identified by the gesture — which key, in which phase, at which part — and the rest
   * of what it declares are that gesture's attributes.
   *
   * Compared as one string, enriching the record reads as every binding removed and a different one
   * declared: eighty findings, with a real removal invisible among them, which is the failure this
   * entry exists to prevent. So membership is asked of the gesture, and what it *does* is compared
   * separately.
   */
  // The first token and nothing else. Listing what to exclude — "no equals sign, and not `toEnd`" —
  // makes every boolean flag added later a part of the gesture's *identity* by default, so a binding
  // that declares one reads as a gesture removed and a different one added. The identity is the
  // thing that was always identity: key, phase, intent.
  const gestureOf = (entry) => entry.split(" ")[0];
  const attributesOf = (entry) => entry.slice(gestureOf(entry).length).trim();
  const wasByGesture = new Map(was.keyboard.map((entry) => [gestureOf(entry), entry]));
  const recordsNoAttributes = was.keyboard.every((entry) => attributesOf(entry) === "");
  const nowByGesture = new Map(now.keyboard.map((entry) => [gestureOf(entry), entry]));

  /**
   * Dropping the phase *widens* a binding: a key that answered only while open now answers always,
   * and nobody who relied on the open behaviour loses it. Compared as strings that reads as one
   * binding removed and another added — a major and a minor for a change that takes nothing away.
   *
   * The disagreement is worth more than either verdict: the string comparison is right that the old
   * spelling is gone, and wrong about what a consumer can survive.
   */
  const widens = (gone) => {
    const [head, intent] = gone.split(":");
    const [key] = head.split("@");
    return head.includes("@") && nowByGesture.has(`${key}:${intent}`);
  };

  for (const [gesture] of wasByGesture) {
    if (nowByGesture.has(gesture)) continue;
    if (widens(gesture)) {
      record("minor", kind, `key now answers in every phase: ${gesture.split("@")[0]}`);
      continue;
    }
    record("major", kind, `key no longer declared: ${gesture}`);
  }
  for (const [gesture, entry] of nowByGesture) {
    if (!wasByGesture.has(gesture)) {
      const intent = gesture.split(":").slice(1).join(":");
      record(knownIntents.has(intent) ? "minor" : "major", kind,
        knownIntents.has(intent)
          ? `key declared: ${entry}`
          : `key declared with an intent no consumer has read before: ${entry} — `
            + `"${intent}" is new to the vocabulary a renderer switches on`);
      continue;
    }
    const withoutNewFields = (attributes) => attributes.split(" ")
      .filter((part) => part !== "" && !bindingFieldsNewToTheSnapshot.includes(part.split("=")[0])).join(" ");
    const before = withoutNewFields(attributesOf(wasByGesture.get(gesture)));
    const after = withoutNewFields(attributesOf(entry));
    if (before === after) continue;
    // A snapshot taken before a binding's attributes were recorded has none for any of them, and an
    // absence there means "not written down", not "declared nothing". Compared raw it reports every
    // binding in the contract as changed, which buries the one that did. The guard removes itself:
    // the next snapshot carries attributes, and this is never true again.
    if (recordsNoAttributes) continue;
    // What the gesture *does* has changed: where focus lands, which part answers, what may be held
    // with it. Breaking by default — somebody who could perform it may no longer be able to, or it
    // now does something else — except a modifier widening to `any`, which only accepts more.
    const widened = !before.includes("mod=") && after.includes("mod=any");
    record(widened ? "minor" : "major", kind,
      `key changed: ${gesture} — ${before || "(nothing)"} → ${after || "(nothing)"}`);
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

/**
 * What the verdict above covers, printed with it.
 *
 * This classifies **the widget contract**: parts, relations, keyboard bindings, the shared class
 * vocabulary. It is silent on everything else a consumer can feel, and silence reads as `patch`.
 * A published tool that becomes stricter, a default that moves, an error string somebody parses —
 * all of them leave every part and relation exactly as they were, and all of them can turn a
 * consumer's green run red without them having touched anything.
 *
 * Said in the output rather than only in this comment, because the number is what gets copied into
 * a changeset, and a reader who takes `patch` for "consumers will not notice" has been told that by
 * a tool that was never asked.
 */
function sayWhatIsNotClassified() {
  console.log(
    "\n  This covers the widget contract only — parts, relations, keyboard, shared classes.\n"
      + "  A change that leaves all of those alone is `patch` here even when a consumer would notice\n"
      + "  it: a published tool grown stricter, a moved default, a parsed message. If your change is\n"
      + "  one of those and this says patch, the disagreement is the finding — say it in the changeset.",
  );
}

const level = changes.reduce((worst, change) => (SEVERITY[change.severity] > SEVERITY[worst] ? change.severity : worst), "patch");

if (changes.length === 0) {
  console.log(`Contract unchanged against ${baselineName} — ${MDY_WIDGET_KINDS.length} kinds at version ${current.contractVersion}.`);
  console.log("\nclassification: patch");
  sayWhatIsNotClassified();
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
sayWhatIsNotClassified();

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
