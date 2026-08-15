#!/usr/bin/env node
/**
 * Contract coverage of the visual surface.
 *
 * Every other audit in this repo compares a renderer with another renderer, or a renderer with a
 * theme. None of them asks the question that matters most: **is this class one the contract names?**
 * That is why a third of the shipped CSS could be a private agreement between one renderer and one
 * theme, invisible to a green board — and why a theme rule for `--focused` sat next to a renderer
 * emitting `--active` without anything noticing.
 *
 * So: take every `mdy-*` class the three adapters emit and every one the themes style, and hold both
 * against what `@modyra/widgets` can actually produce — root classes, part classes, part states, the
 * chip, the layout and the field shell. Anything left over is off contract, in one of three ways:
 *
 *   drift — a renderer emits it and a theme styles it, but the contract never agreed to it
 *   unstyled — the contract or a renderer has it, and no theme paints it
 *   dead — a theme styles it and no renderer emits it
 *
 * Those three take their candidates from what renderers emit and what themes style. A class the
 * **contract declares** that neither of them touches is in none of the three sets, so it produced no
 * finding of any kind — which is where eleven declared popup placement classes sat while this audit
 * exited 0. That is the fourth way:
 *
 *   unpainted — the contract declares it and no theme paints it
 *
 * Its candidates come from the contract instead, so it is the one category that can see a rule
 * nobody has adopted. It is deliberately **not** phrased as "and no renderer emits it": emission is
 * detected by scanning string literals, and a renderer that asks the contract for its classes —
 * `rootClasses`, `partClasses` — writes no literal to find. Claiming those are unemitted would
 * report a defect that is not there.
 *
 * Findings are held in a versioned allowlist that may only ever shrink. A new off-contract class
 * fails `--check`; an allowlist entry that is no longer a finding is reported as stale, so the list
 * cannot quietly outlive what it was covering. The unpainted set is allowlisted and gated the same
 * way, under `_unpainted`, so a contract class that stops being painted cannot arrive unnoticed.
 *
 * Usage:
 *   node scripts/audit-contract-style-coverage.mjs          # report
 *   node scripts/audit-contract-style-coverage.mjs --check  # exit 1 on new findings or stale entries
 *   node scripts/audit-contract-style-coverage.mjs --write  # reseed the allowlist from today's findings
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  MDY_CHIP_CLASSES,
  MDY_FIELD_SHELL_CLASSES,
  MDY_FORM_SHELL_CLASSES,
  MDY_LAYOUT_CLASSES,
  MDY_OVERLAY_PORTAL_CLASS,
  MDY_POPUP_CLASS,
  MDY_WIDGET_KINDS,
  MDY_STATE_EXPRESSION,
  MDY_WIDGET_CONTRACTS,
  multiselectChipClasses,
  stateClass,
  widgetStateClasses,
} from "../packages/widgets/dist/index.js";
import { MDY_SHARED_UI_CLASSES } from "../packages/widgets/dist/vocabulary.js";

const ROOT = resolve(import.meta.dirname, "..");
const ALLOWLIST_PATH = join(ROOT, "scripts/contract-coverage-allowlist.json");
const STYLES_DIR = join(ROOT, "packages/styles/src");
const ADAPTERS = {
  angular: join(ROOT, "packages/angular/src/lib"),
  lit: join(ROOT, "packages/lit/src"),
  plain: join(ROOT, "packages/plain/src"),
};

const check = process.argv.includes("--check");
const write = process.argv.includes("--write");

// ─── What the contract can produce ───────────────────────────────────────────

/**
 * Every class `@modyra/widgets` is able to put on an element.
 *
 * Built from the contract rather than listed here, so the set grows the moment a part or a state is
 * declared — the audit can never be more permissive than the contract it is checking against.
 */
function contractClasses() {
  const out = new Set([
    MDY_POPUP_CLASS,
    MDY_OVERLAY_PORTAL_CLASS,
    ...Object.values(MDY_FIELD_SHELL_CLASSES),
    // The form's own parts, which belong to no field and to no kind: a refusal naming no field has
    // nowhere else to be shown.
    ...Object.values(MDY_FORM_SHELL_CLASSES),
    ...Object.values(MDY_LAYOUT_CLASSES),
    ...Object.values(MDY_CHIP_CLASSES),
    // The classes that belong to no single kind: the overlay panel and its backdrop, the button, the
    // inline-error tooltip. The contract names them in one table and this audit did not read it, so
    // nine classes the contract declares were reported as being outside it and lived in the
    // allowlist for that reason alone.
    ...MDY_SHARED_UI_CLASSES,
  ]);
  for (const kind of MDY_WIDGET_KINDS) for (const c of widgetStateClasses(kind)) out.add(c);
  // The chip is a primitive rather than a part of one widget: its variants come from the function
  // every renderer asks, so the audit asks the same function rather than restating the answer.
  for (const mode of ["single", "multi"]) {
    for (const role of ["option", "value"]) {
      for (const selected of [false, true]) {
        for (const removable of [false, true]) {
          for (const c of multiselectChipClasses({ mode, role, selected, removable })) out.add(c);
        }
      }
    }
  }
  // The chip's own states, which a renderer reaches through `partClasses` on a multiselect.
  for (const state of ["selected", "removable"]) out.add(stateClass(MDY_CHIP_CLASSES.block, state));
  return out;
}

// ─── What is actually out there ──────────────────────────────────────────────

function* walk(dir, ext) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path, ext);
    else if (entry.name.endsWith(ext) && !entry.name.endsWith(".spec.ts")) yield path;
  }
}

/** A class name and nothing else: no trailing hyphen, no path, no interpolation. */
const CLASS_NAME = /^mdy-[a-z0-9]+(?:[-_]+[a-z0-9]+)*$/;

/** Comments are documentation, and documentation shows markup. `<mdy-text …>` in a doc block is not
 * a class a renderer emits, and counting it reports a widget that does not exist. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Class-position `mdy-*` tokens in a source file.
 *
 * Only string literals are considered, and only whole tokens within them, because that is where a
 * class is written — in a `class="…"`, a `classList.add`, a `classMap` key or a selector passed to
 * `querySelector`. Scanning the raw text instead would count an import path
 * (`./mdy-required.directive`), a template-literal key (`mdy-vd-${n}`) and a tag name in a comment.
 *
 * Element names are excluded separately: an Angular `selector:` and a Lit `@customElement` name look
 * exactly like classes and are not.
 */
function classTokens(source, exclude) {
  const found = new Set();
  const clean = stripComments(source);
  // Backticks are taken separately and allowed to span lines: an Angular inline `template:` is one
  // multi-line template literal, and a single-line rule would skip every class in every renderer.
  const literals = [
    ...[...clean.matchAll(/`((?:[^\\`]|\\.)*)`/g)].map((m) => m[1]),
    ...[...clean.matchAll(/(["'])((?:[^\\\n])*?)\1/g)].map((m) => m[2]),
  ];
  for (const literal of literals) {
    for (const raw of literal.split(/[\s,>+~[\]="']+/)) {
      // A selector passed to `querySelector`, and an Angular `[class.x]` binding, are the same
      // vocabulary written with punctuation around it.
      const token = raw.replace(/^[.#]/, "").replace(/^class\./, "").split(":")[0];
      if (CLASS_NAME.test(token) && !exclude.has(token)) found.add(token);
    }
  }
  return found;
}

/** Names that are elements, not classes: an Angular component selector or a Lit custom element. */
function elementNames(source) {
  const names = [
    ...[...source.matchAll(/selector:\s*["'`]([^"'`]+)["'`]/g)].flatMap((m) => m[1].split(/[\s,]+/)),
    ...[...source.matchAll(/(?:@customElement|customElements\.define|customElements\.get)\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
    // Lit registers its catalog as a table of `["mdy-select-field", MdySelectFieldElement]` pairs,
    // where the tag never meets `customElements.define` in the same expression.
    ...[...source.matchAll(/\[\s*["'`](mdy-[a-z0-9-]+)["'`]\s*,\s*Mdy\w*Element\s*\]/g)].map((m) => m[1]),
  ];
  return new Set(names.map((n) => n.replace(/^[.[]/, "").replace(/[\]].*$/, "")));
}

function emittedClasses() {
  const sources = [];
  for (const [adapter, dir] of Object.entries(ADAPTERS)) {
    for (const file of walk(dir, ".ts")) sources.push([adapter, readFileSync(file, "utf8")]);
  }
  // Element names are collected per adapter, across all of that adapter's files. Across all of them
  // would be wrong: `mdy-dynamic-form` is an Angular component selector *and* the class the
  // framework-free renderer puts on its form, and excluding it everywhere would hide a real class.
  // Per-file would be wrong too: Lit names its elements in a registry and uses them elsewhere.
  const elements = new Map();
  for (const [adapter, source] of sources) {
    if (!elements.has(adapter)) elements.set(adapter, new Set());
    for (const name of elementNames(source)) elements.get(adapter).add(name);
  }
  const byClass = new Map();
  for (const [adapter, source] of sources) {
    for (const token of classTokens(source, elements.get(adapter))) {
      if (!byClass.has(token)) byClass.set(token, new Set());
      byClass.get(token).add(adapter);
    }
  }
  return byClass;
}

function styledClasses() {
  const byClass = new Map();
  for (const file of readdirSync(STYLES_DIR).filter((f) => f.endsWith(".css"))) {
    // Comments go first, as they already do on the TypeScript side. A class *named in prose* — most
    // often the note saying why a rule was deleted — is not a class the stylesheet styles, and
    // counting it kept the removed rule alive in the audit long after the rule was gone.
    const source = stripComments(readFileSync(join(STYLES_DIR, file), "utf8"));
    for (const m of source.matchAll(/\.(mdy-[a-zA-Z0-9_-]+)/g)) {
      if (!byClass.has(m[1])) byClass.set(m[1], new Set());
      byClass.get(m[1]).add(file);
    }
  }
  return byClass;
}

// ─── The verdict ─────────────────────────────────────────────────────────────

const contract = contractClasses();
const emitted = emittedClasses();
const styled = styledClasses();

const findings = [];
for (const className of new Set([...emitted.keys(), ...styled.keys()])) {
  if (contract.has(className)) continue;
  const where = emitted.get(className);
  const themes = styled.get(className);
  findings.push({
    class: className,
    kind: where && themes ? "drift" : where ? "unstyled" : "dead",
    adapters: where ? [...where].sort() : [],
    themes: themes ? [...themes].sort() : [],
  });
}
findings.sort((a, b) => a.class.localeCompare(b.class));

// Classes the contract names that nothing paints — the fourth category, and the only one whose
// candidates come from the contract rather than from what is already in use. A declared class no
// theme paints is a rule a renderer can adopt and see nothing happen.
const unpainted = [...contract].filter((c) => !styled.has(c)).sort();

const rawAllowlist = (() => {
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  } catch {
    return {};
  }
})();

const allowlist = new Set(Object.keys(rawAllowlist).filter((k) => !k.startsWith("_")));
const unpaintedAllowlist = rawAllowlist._unpainted ?? {};

const fresh = findings.filter((f) => !allowlist.has(f.class));
const stale = [...allowlist].filter((c) => !findings.some((f) => f.class === c)).sort();

const freshUnpainted = unpainted.filter((c) => !(c in unpaintedAllowlist));
const staleUnpainted = Object.keys(unpaintedAllowlist).filter((c) => !unpainted.includes(c)).sort();

if (write) {
  const entries = Object.fromEntries(findings.map((f) => [f.class, { kind: f.kind, adapters: f.adapters, themes: f.themes }]));
  // An existing reason is kept: it says *why* a declared class goes unpainted, which is the whole
  // value of the entry and is not recoverable by measuring again.
  const unpaintedEntries = Object.fromEntries(
    unpainted.map((c) => [c, unpaintedAllowlist[c] ?? "unreviewed"]),
  );
  writeFileSync(ALLOWLIST_PATH, `${JSON.stringify({
    _note: "Classes outside the widget contract. This list may only ever shrink: each batch contractualises some of it. Reseed with --write only when deliberately recording a new baseline.",
    _generated: `${findings.length} findings`,
    _unpaintedNote: "Contract classes no theme paints, each with the reason it is acceptable. Same rule: may only ever shrink. 'unreviewed' means nobody has decided yet — it is a to-do, not a verdict.",
    _unpainted: unpaintedEntries,
    ...entries,
  }, null, 2)}\n`);
  console.log(`Wrote ${relative(ROOT, ALLOWLIST_PATH)} with ${findings.length} findings and ${unpainted.length} unpainted contract classes.`);
  process.exit(0);
}

/**
 * Whether each kind delivers the way it says it shows "unusable" — `MDY_STATE_EXPRESSION`.
 *
 * The rest of this audit compares *classes*, so it can only see one of the two mechanisms in use.
 * Seven kinds express `disabled`/`error` through a structural selector on the native control
 * instead, and for those the class comparison has nothing to compare: half the expression of the
 * state sat outside everything checked here.
 *
 * `"class"` is answered by the existing comparison — the modifier is a contract class like any
 * other. `"structural"` is answered here: some theme rule must mention one of the kind's own classes
 * *and* test `:disabled`, `[disabled]` or `aria-invalid`. That is a weaker check than a named class,
 * deliberately: the point is to tell a kind that shows the state from one that shows nothing, not to
 * dictate the selector.
 */
function structuralStateCoverage() {
  const themeSource = readdirSync(STYLES_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => stripComments(readFileSync(join(STYLES_DIR, f), "utf8")))
    .join("\n");
  // Selectors only: a declaration block mentioning `disabled` in a custom property name is not a
  // rule reaching the state.
  // `:not(:disabled)` styles the *enabled* state and is common on hover rules. Counting it reported
  // the checkbox as covered after its only real `:disabled` rule had been deleted — a rule that
  // matches when the state is absent is not a rule that shows the state.
  const withoutNegations = (selector) => selector.replace(/:not\([^)]*\)/g, "");
  const selectors = themeSource.split("}").map((rule) => withoutNegations(rule.split("{")[0] ?? ""));
  const reaching = selectors.filter((s) => /:disabled|\[disabled\]|aria-invalid/.test(s));

  // Only classes this kind alone declares. The shared shell vocabulary — `mdy-renderer`,
  // `mdy-label`, `mdy-control__errors` — belongs to all seventeen, so matching on it says a rule
  // written for some other kind covers this one. `.mdy-renderer select:disabled` reported `file` as
  // covered on the first run of this check, which is the whole failure it is meant to detect.
  const owners = new Map();
  for (const kind of MDY_WIDGET_KINDS) {
    for (const part of Object.values(MDY_WIDGET_CONTRACTS[kind].parts)) {
      for (const className of part.classes ?? []) {
        owners.set(className, (owners.get(className) ?? new Set()).add(kind));
      }
    }
  }

  const uncovered = [];
  for (const kind of MDY_WIDGET_KINDS) {
    if (MDY_STATE_EXPRESSION[kind] !== "structural") continue;
    const own = [...owners].filter(([, kinds]) => kinds.size === 1 && kinds.has(kind)).map(([c]) => c);
    const hit = reaching.some((selector) => own.some((className) => selector.includes(className)));
    if (!hit) uncovered.push(kind);
  }
  return uncovered;
}

const structurallyUncovered = structuralStateCoverage();

console.log("# Contract coverage of the visual surface\n");
console.log(`Contract can produce: ${contract.size} classes`);
console.log(`Renderers emit: ${emitted.size}   Themes style: ${styled.size}`);
console.log(`Contract classes no theme paints: ${unpainted.length}\n`);

for (const kind of ["drift", "unstyled", "dead"]) {
  const group = findings.filter((f) => f.kind === kind);
  const label = { drift: "off contract, live in renderers and themes", unstyled: "emitted by a renderer, no theme paints it", dead: "styled by a theme, no renderer emits it" }[kind];
  console.log(`## ${kind} — ${label}: ${group.length}`);
  for (const f of group) {
    const covered = allowlist.has(f.class) ? " " : "+";
    console.log(`  ${covered} ${f.class}${f.adapters.length ? `  <- ${f.adapters.join(",")}` : ""}${f.themes.length ? `  [${f.themes.length} theme${f.themes.length > 1 ? "s" : ""}]` : ""}`);
  }
  console.log("");
}

console.log(`## unpainted — the contract declares it, no theme paints it: ${unpainted.length}`);
for (const c of unpainted) {
  const reason = unpaintedAllowlist[c];
  console.log(`  ${reason === undefined ? "+" : " "} ${c}${reason ? `  — ${reason}` : ""}`);
}
console.log("");

console.log(`Total off contract: ${findings.length}   allowlisted: ${findings.length - fresh.length}   new: ${fresh.length}   stale entries: ${stale.length}`);
console.log(`Unpainted contract classes: ${unpainted.length}   allowlisted: ${unpainted.length - freshUnpainted.length}   new: ${freshUnpainted.length}   stale entries: ${staleUnpainted.length}`);

if (check) {
  let failed = false;
  if (fresh.length) {
    console.error(`\n${fresh.length} class(es) outside the contract and not allowlisted:`);
    for (const f of fresh) console.error(`  ${f.class} (${f.kind})`);
    failed = true;
  }
  if (stale.length) {
    console.error(`\n${stale.length} allowlist entr(ies) no longer needed — remove them:`);
    for (const c of stale) console.error(`  ${c}`);
    failed = true;
  }
  if (freshUnpainted.length) {
    console.error(`\n${freshUnpainted.length} contract class(es) no theme paints and not allowlisted:`);
    for (const c of freshUnpainted) console.error(`  ${c}`);
    console.error("Paint it, stop declaring it, or record under _unpainted why it is acceptable.");
    failed = true;
  }
  if (staleUnpainted.length) {
    console.error(`\n${staleUnpainted.length} _unpainted entr(ies) now painted — remove them:`);
    for (const c of staleUnpainted) console.error(`  ${c}`);
    failed = true;
  }
  if (structurallyUncovered.length) {
    console.error(`\n${structurallyUncovered.length} kind(s) declare a structural state expression and no theme reaches it:`);
    for (const k of structurallyUncovered) console.error(`  ${k} — disabled and error are announced and never shown`);
    console.error("Add a rule reaching :disabled/aria-invalid for that kind, or change its MDY_STATE_EXPRESSION.");
    failed = true;
  }
  if (failed) process.exit(1);
  console.log("\nCONTRACT COVERAGE CLEAN");
}
