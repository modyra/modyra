#!/usr/bin/env node
/**
 * Theme class-contract audit.
 *
 * Compares the class vocabulary each renderer *writes in its source* — Angular components and their
 * subcomponents against Lit elements — with the classes styled by the shipped themes.
 *
 * **Written, not emitted, and the difference is the whole caveat.** A class a renderer asks the
 * contract for at runtime is on the element and invisible to a scanner reading text. The report says
 * so in its own output rather than only here, because a reader who takes these counts for what the
 * page carries will read a successful migration as a renderer losing classes.
 *
 * Usage:
 *   node scripts/audit-theme-classes.mjs         # report
 *   node scripts/audit-theme-classes.mjs --check # exit 1 on defects
 */

import { readFileSync, readdirSync } from "node:fs";
import { MDY_CHIP_CLASSES, MDY_CONTRACT_VOCABULARIES, MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES, MDY_WIDGET_CONTRACTS, partClasses, popupPlacementClass, stateClass } from "../packages/widgets/dist/index.js";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Every class name the contract publishes, derived from its own index of vocabularies.
 *
 * Derived rather than listed, for the reason the index exists: a list kept beside it covers the
 * collections somebody thought of, and the one nobody added is the one this audit silently keeps
 * calling a divergence. `MDY_FIELD_STATE_CLASSES` names bases and states separately, so a state
 * class is composed the way a renderer composes it rather than only its two halves being collected.
 */
const CONTRACT_CLASSES = (() => {
  const found = new Set();
  // A catalogue may point back at one it is reachable from, so the walk remembers where it has been.
  const seen = new Set();
  const take = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("mdy-") && !value.endsWith("-")) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) return;
      seen.add(value);
      for (const one of value) take(one);
      return;
    }
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return;
      seen.add(value);
      for (const one of Object.values(value)) take(one);
    }
  };
  for (const { value } of MDY_CONTRACT_VOCABULARIES) take(value);

  const S = MDY_FIELD_STATE_CLASSES;
  for (const [key, base] of Object.entries(S)) {
    if (typeof base !== "string" || !base.startsWith("mdy-")) continue;
    const states = S[`${key}States`];
    if (!Array.isArray(states)) continue;
    for (const state of states) found.add(`${base}--${state}`);
  }
  return found;
})();


const ANGULAR_DIR = join(ROOT, "packages/angular/src/lib");
const ANGULAR_RENDERER_DIR = join(ANGULAR_DIR, "renderers");
const ANGULAR_CONTROL_DIR = join(ANGULAR_DIR, "control");
const LIT_DIR = join(ROOT, "packages/lit/src/components");
const LIT_BASE = join(ROOT, "packages/lit/src/base.ts");
const STYLES_DIR = join(ROOT, "packages/styles/src");

// Known Angular→Lit parity gaps: type-a defects listed here are reported as
// "pending" instead of failing --check, so the contract stays enforceable
// for new regressions while the Lit renderers catch up. An entry that has
// stopped being a defect is flagged as stale, so the list only ever shrinks.
const ALLOWLIST_PATH = join(ROOT, "scripts/theme-parity-allowlist.json");

function loadParityAllowlist() {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    const map = new Map();
    for (const [kind, classes] of Object.entries(raw)) {
      if (!kind.startsWith("_")) map.set(kind, new Set(classes));
    }
    return map;
  } catch {
    return new Map();
  }
}

const KINDS = [
  "text",
  "textarea",
  "number",
  "checkbox",
  "toggle",
  "radio-group",
  "segmented",
  "select",
  "multiselect",
  "slider",
  "datepicker",
  "daterange",
  "timepicker",
  "colors",
  "file",
];

const ANGULAR_MAIN = {
  text: "renderers/text/text-renderer.component.ts",
  textarea: "renderers/textarea/textarea-renderer.component.ts",
  number: "renderers/number/number-renderer.component.ts",
  checkbox: "renderers/checkbox/checkbox-renderer.component.ts",
  toggle: "renderers/toggle/toggle-renderer.component.ts",
  "radio-group": "renderers/radio/radio-group-renderer.component.ts",
  segmented: "renderers/segmented-button/segmented-button-renderer.component.ts",
  select: "renderers/select/select-renderer.component.ts",
  multiselect: "renderers/multiselect/multiselect-renderer.component.ts",
  slider: "renderers/slider/slider-renderer.component.ts",
  datepicker: "renderers/datepicker/datepicker.component.ts",
  daterange: "renderers/datepicker/daterange-renderer.component.ts",
  timepicker: "renderers/timepicker/timepicker-renderer.component.ts",
  colors: "renderers/colors/colors-renderer.component.ts",
  file: "renderers/file/file-renderer.component.ts",
};

// ─── File reading ────────────────────────────────────────────────────────────

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function* walkDir(dir, ext) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(path, ext);
    } else if (entry.name.endsWith(ext)) {
      yield path;
    }
  }
}

// ─── Angular template extraction ─────────────────────────────────────────────

function findTemplate(ts, filePath) {
  // Inline template.
  const inline = ts.match(/template:\s*`([\s\S]*?)`/);
  if (inline) return inline[1];
  // External templateUrl.
  const urlMatch = ts.match(/templateUrl:\s*['"]([^'"]+)['"]/);
  if (urlMatch && filePath) {
    const dir = dirname(filePath);
    return readText(join(dir, urlMatch[1]));
  }
  return "";
}

function findHostBindings(ts) {
  const match = ts.match(/host:\s*\{([\s\S]*?)\}/);
  if (!match) return [];
  const body = match[1];
  const classes = [];
  const classRe = /"([^"]+)"/g;
  let m;
  while ((m = classRe.exec(body)) !== null) {
    classes.push(...tokenizeClassList(m[1]));
  }
  return classes;
}

/**
 * Classes a renderer asks the contract for instead of spelling.
 *
 * `partClasses(kind, part)` returns what the element wears — the part's own classes, or the shell's
 * vocabulary where the part declares none — so a renderer reading its classes from the contract puts
 * them on the element without any of them appearing in its source as a literal. An audit that reads
 * only the literal reports the difference as a renderer that stopped drawing the part.
 *
 * The function is called rather than the tables read, for the reason `popupPlacementClass` is: the
 * fallback to the shell vocabulary lives in the accessor, and a copy of it here would answer
 * differently the moment either moved.
 *
 * A kind or part the contract does not declare makes it throw, and that contributes nothing —
 * whatever the renderer was supposed to draw stays missing and the audit still asks about it.
 * Recognising the call is not the same as trusting it.
 *
 * Shared by both collectors: either renderer may reach the contract this way, and a second copy of
 * this would answer differently the moment one of them was edited.
 */
function classesAskedOfTheContract(ts) {
  const found = [];
  const re = /partClasses\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*,\s*["'`]([A-Za-z0-9_]+)["'`]/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    try {
      found.push(...partClasses(m[1], m[2]));
    } catch {
      // Not a part of that kind, so it names no class and none is added.
    }
  }
  return found;
}

function extractAngularClasses(ts, filePath, kind) {
  const template = findTemplate(ts, filePath);
  const host = findHostBindings(ts);
  const fromTemplate = extractTemplateClasses(template);
  // A renderer that binds `widgetContract.parts.x.classes` emits whatever the catalog says that
  // part carries — resolve it from the contract rather than looking for a literal.
  const fromContract = [];
  const contractRe = /widgetContract\.parts\.([A-Za-z0-9_]+)\.classes/g;
  const definition = MDY_WIDGET_CONTRACTS[kind === "radio-group" ? "radio" : kind];
  let m;
  while ((m = contractRe.exec(ts)) !== null) {
    fromContract.push(...(definition?.parts[m[1]]?.classes ?? []));
  }
  // The same binding, named through the catalog rather than through the component's own
  // `widgetContract` field. A renderer that reaches a part this way emits its classes just as
  // literally, and reading only the first spelling reports the difference as a Lit-only class.
  const catalogRe = /MDY_WIDGET_CONTRACTS\.([A-Za-z0-9_]+)\.parts\.([A-Za-z0-9_]+)\.classes/g;
  while ((m = catalogRe.exec(ts)) !== null) {
    fromContract.push(...(MDY_WIDGET_CONTRACTS[m[1]]?.parts[m[2]]?.classes ?? []));
  }
  fromContract.push(...classesAskedOfTheContract(ts));
  // Same for a popup's placement: the renderer names it through the catalog, so the class is on the
  // element at runtime without ever appearing as a literal here. Two spellings reach the same call —
  // the renderer computing it itself, and the renderer handing its kind to `<mdy-overlay-panel>`,
  // which computes it on the renderer's behalf.
  const placementRes = [
    /popupPlacementClass\(\s*["'`]([a-z-]+)["'`]/g,
    /\[kind\]\s*=\s*"\s*'([a-z-]+)'\s*"/g,
  ];
  for (const re of placementRes) {
    while ((m = re.exec(ts)) !== null) {
      if (!MDY_WIDGET_CONTRACTS[m[1]]?.parts.popup) continue;
      for (const placement of ["above", "overlay"]) {
        const name = popupPlacementClass(m[1], placement);
        if (name) fromContract.push(name);
      }
    }
  }
  // A component may take the chip vocabulary as a field (`readonly chip = MDY_CHIP_CLASSES`) and
  // name every chip class through the alias; a member read through it emits the class as literally
  // as the constant would.
  const aliasMatch = ts.match(/([A-Za-z0-9_$]+)\s*=\s*MDY_CHIP_CLASSES\b/);
  for (const name of aliasMatch ? [aliasMatch[1], "MDY_CHIP_CLASSES"] : ["MDY_CHIP_CLASSES"]) {
    const memberRe = new RegExp(`\\b${name}\\.([A-Za-z0-9_]+)`, "g");
    while ((m = memberRe.exec(ts)) !== null) {
      const value = MDY_CHIP_CLASSES[m[1]];
      if (value) fromContract.push(value);
    }
  }
  return new Set([...fromTemplate, ...host, ...fromContract]);
}

/** The base/modifier pairs `MDY_FIELD_STATE_CLASSES` publishes, as they are named on it. */
const STATE_FAMILIES = Object.freeze([
  ["field", "fieldStates"],
  ["control", "controlStates"],
  ["label", "labelStates"],
]);

/**
 * Whether this source composes class names out of one of those families.
 *
 * Deliberately loose: it asks whether the file *reaches for* the base and its modifier list, not how
 * it joins them. A renderer that names both is a renderer that emits the whole family — and the
 * alternative, matching the composition itself, is a scanner that reads one spelling of a `map` and
 * misses the next one, which is the failure this repair exists to remove rather than move.
 */
function referencesStateFamily(ts, base, states) {
  return ts.includes(`MDY_FIELD_STATE_CLASSES.${base}`) && ts.includes(`MDY_FIELD_STATE_CLASSES.${states}`);
}

function extractTemplateClasses(template) {
  const classes = [];

  // class="..." and [class]="'...'"
  const staticRe = /class=(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{[^}]*['"`]([^'"`]*)['"`]\})/g;
  let m;
  while ((m = staticRe.exec(template)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    classes.push(...tokenizeClassList(raw));
  }

  // [class.foo]="..."
  const bindingRe = /\[class\.([A-Za-z0-9_-]+)\]/g;
  while ((m = bindingRe.exec(template)) !== null) {
    classes.push(m[1]);
  }

  // [panelClass]="'foo bar'" — the classes Angular hands to its overlay panel. Without this the
  // audit cannot see any popup class Angular emits, and reports the other adapters' as unmatched.
  const panelClassRe = /\[panelClass\]="'([^']*)'"/g;
  while ((m = panelClassRe.exec(template)) !== null) {
    classes.push(...tokenizeClassList(m[1]));
  }

  // [ngClass]="{ 'foo': ... }"
  const ngClassRe = /\[ngClass\]="([\s\S]*?)"\s*[\]>]?/g;
  while ((m = ngClassRe.exec(template)) !== null) {
    const expr = m[1];
    const objRe = /['"`]([A-Za-z0-9_-]+)['"`]\s*:/g;
    let om;
    while ((om = objRe.exec(expr)) !== null) {
      classes.push(om[1]);
    }
  }

  return classes;
}

function tokenizeClassList(raw) {
  return raw
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c.startsWith("mdy-"));
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [`${base}.ts`, `${base}.component.ts`, join(base, "index.ts")];
  for (const c of candidates) {
    if (readText(c)) return c;
  }
  return null;
}

function collectAngularFilesForKind(kind) {
  const main = join(ANGULAR_DIR, ANGULAR_MAIN[kind]);
  const visited = new Set();
  const files = [];
  const queue = [main];
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    if (!readText(path)) continue;
    files.push(path);
    const ts = readText(path);
    // Collect relative imports inside angular src/lib.
    const importRe = /from\s+['"]([^'"]+)['"];/g;
    let m;
    while ((m = importRe.exec(ts)) !== null) {
      const resolved = resolveImportPath(path, m[1]);
      if (resolved && resolved.startsWith(ANGULAR_DIR)) {
        queue.push(resolved);
      }
    }
  }
  return files;
}

function buildAngularVocabulary() {
  const vocab = new Map();
  for (const kind of KINDS) {
    const classes = new Set();
    for (const path of collectAngularFilesForKind(kind)) {
      const ts = readText(path);
      for (const c of extractAngularClasses(ts, path, kind)) classes.add(c);
    }
    vocab.set(kind, classes);
  }
  return vocab;
}

// ─── Lit extraction ──────────────────────────────────────────────────────────

function extractLitTemplateClasses(template) {
  // Lit templates are inside html`...`. Every mdy-* token in the template
  // body is a class name (the few element/function names like mdyIcon are
  // TS identifiers, not present as mdy-* tokens in the template string).
  const classes = [];
  const tokenRe = /mdy-[A-Za-z0-9_-]+/g;
  let m;
  while ((m = tokenRe.exec(template)) !== null) {
    const token = m[0];
    if (!token.endsWith("-")) classes.push(token);
  }
  return classes;
}

function stripComments(ts) {
  return ts
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

/**
 * Module specifiers, removed before any class scan.
 *
 * A path is not a class name, and the whole-file scan cannot tell them apart: importing
 * `../mdy-part.js` made every file that binds a part contract look as though it emitted a
 * `mdy-part` class, on thirteen kinds at once.
 */
function stripModuleSpecifiers(ts) {
  return ts
    .replace(/\bfrom\s+["'][^"']*["']/g, "")
    .replace(/\bimport\s+["'][^"']*["']/g, "")
    .replace(/\bimport\(\s*["'][^"']*["']\s*\)/g, "");
}

function extractLitAllTokens(ts) {
  // Scan the whole file for mdy-* tokens. This is robust against nested
  // template literals and conditional class strings. Tokens ending in `-`
  // are placeholders (e.g. mdy-field-) and are ignored. CSS custom property
  // names (--mdy-*) are not class names and are skipped.
  const code = stripModuleSpecifiers(stripComments(ts));
  const classes = [];
  const tokenRe = /(?<!-)mdy-[A-Za-z0-9_-]+/g;
  let m;
  while ((m = tokenRe.exec(code)) !== null) {
    const token = m[0];
    if (!token.endsWith("-")) classes.push(token);
  }
  return classes;
}

/**
 * Classes a file contributes by *consuming the contract* rather than by writing a literal:
 * `MDY_FIELD_SHELL_CLASSES.x`, `this.partClass("x")` and `rootClasses` all resolve through
 * `@modyra/widgets`, so the vocabulary is read from the catalog instead of from the source text.
 */
function extractContractClasses(ts, kind) {
  const classes = [];
  // The state vocabulary, composed rather than spelled.
  //
  // `MDY_FIELD_STATE_CLASSES` publishes a base and the modifiers that may hang off it — `control`
  // with `controlStates`, `label` with `labelStates`, `field` with `fieldStates` — and a renderer
  // that builds `${base}--${state}` from them emits exactly the class a renderer that typed it
  // emits. Read as text, the composed one looks like a renderer that dropped the state, so this
  // gate punished the refactor it exists to encourage: Lit's wrapper stopped hand-writing
  // `mdy-input-wrapper--disabled` and started deriving it, and eleven classes across nine kinds
  // were reported missing while the rendered DOM carried every one of them.
  //
  // The same shape the chip alias already accepts, one level further: a member read off a published
  // constant is as literal as the constant.
  for (const [base, states] of STATE_FAMILIES) {
    if (!referencesStateFamily(ts, base, states)) continue;
    classes.push(MDY_FIELD_STATE_CLASSES[base]);
    for (const state of MDY_FIELD_STATE_CLASSES[states]) {
      classes.push(`${MDY_FIELD_STATE_CLASSES[base]}--${state}`);
    }
  }
  const shellRe = /(?:MDY_FIELD_SHELL_CLASSES|SHELL)\.([A-Za-z0-9_]+)/g;
  let shellMatch;
  while ((shellMatch = shellRe.exec(ts)) !== null) {
    const value = MDY_FIELD_SHELL_CLASSES[shellMatch[1]];
    if (value) classes.push(value);
  }
  const widgetKind = kind === "radio-group" ? "radio" : kind;
  const definition = MDY_WIDGET_CONTRACTS[widgetKind];
  if (!definition) return classes;
  if (/rootClasses|MDY_WIDGET_CONTRACTS/.test(ts)) classes.push(...definition.rootClasses);
  const partRe = /partClass\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*\)/g;
  let m;
  while ((m = partRe.exec(ts)) !== null) {
    classes.push(...(definition.parts[m[1]]?.classes ?? []));
  }
  // Modifier forms built by interpolation — `${SHELL.label}--filled`, `${this.partClass("x")}--open`
  const shellModifierRe = /\$\{SHELL\.([A-Za-z0-9_]+)\}--([A-Za-z0-9-]+)/g;
  while ((m = shellModifierRe.exec(ts)) !== null) {
    const base = MDY_FIELD_SHELL_CLASSES[m[1]];
    if (base) classes.push(`${base}--${m[2]}`);
  }
  const partModifierRe = /partClass\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*\)\}--([A-Za-z0-9-]+)/g;
  while ((m = partModifierRe.exec(ts)) !== null) {
    for (const base of definition.parts[m[1]]?.classes ?? []) classes.push(`${base}--${m[2]}`);
  }
  // The same modifier asked of the contract rather than interpolated: `partStateClass("x", "open")`
  // builds the name from the part's own first class and the state's modifier, so nothing about it
  // appears here as a literal. Without this a renderer that stopped spelling a modifier reads as one
  // that stopped emitting it, and the parity report names a class that is on the element.
  const partStateRe = /partStateClass\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*,\s*["'`]([A-Za-z0-9_]+)["'`]/g;
  while ((m = partStateRe.exec(ts)) !== null) {
    // Through the accessor, not a copy of its table: the modifier a state spells is the accessor's
    // to decide, and a second copy here would answer differently the moment either moved.
    const base = definition.parts[m[1]]?.classes?.[0];
    if (base !== undefined) classes.push(stateClass(base, m[2]));
  }
  classes.push(...classesAskedOfTheContract(ts));
  // The chip vocabulary, when a renderer takes it from the contract instead of spelling it out.
  // Without this a renderer that moved onto `multiselectChipClasses` reads as one that stopped
  // emitting chips at all, and the audit reports a parity gap that does not exist.
  const chipRe = /MDY_CHIP_CLASSES\.([A-Za-z0-9_]+)/g;
  while ((m = chipRe.exec(ts)) !== null) {
    const value = MDY_CHIP_CLASSES[m[1]];
    if (value) classes.push(value);
  }
  if (ts.includes("multiselectChipClasses")) {
    classes.push(MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.centered, MDY_CHIP_CLASSES.counter, MDY_CHIP_CLASSES.selected);
    if (/role:\s*["'`]value["'`]/.test(ts)) classes.push(MDY_CHIP_CLASSES.value);
  }
  // A component that calls `this.popupClass(…)` reflects its own kind's placement states. The base
  // resolves the kind, so nothing here is spelled — ask the catalog what the call can produce.
  if (/\bpopupClass\(/.test(ts) && definition?.parts.popup) {
    for (const placement of ["above", "overlay"]) {
      const name = popupPlacementClass(kind, placement);
      if (name) classes.push(name);
    }
  }
  return classes;
}

function extractLitDynamicClasses(ts) {
  const classes = [];
  const toggleRe = /classList\.toggle\(["'`]([A-Za-z0-9_-]+)["'`]/g;
  let m;
  while ((m = toggleRe.exec(ts)) !== null) classes.push(m[1]);
  const addRe = /classList\.add\(["'`]([A-Za-z0-9_-]+)["'`]/g;
  while ((m = addRe.exec(ts)) !== null) classes.push(m[1]);
  const rendererRe = /rendererClass\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
  while ((m = rendererRe.exec(ts)) !== null) classes.push(m[1]);
  return classes;
}

function litFileForKind(kind) {
  const baseName = `${kind}-field.ts`;
  return join(LIT_DIR, baseName);
}

function resolveLitImportPath(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  // Lit TS sources are imported with a .js extension in ESM.
  const base = resolve(dirname(fromFile), specifier.replace(/\.js$/, ""));
  const candidates = [`${base}.ts`, `${base}.js`];
  for (const c of candidates) {
    if (readText(c)) return c;
  }
  return null;
}

function buildLitVocabulary() {
  const baseTs = readText(LIT_BASE);
  const baseClasses = new Set([
    ...extractLitAllTokens(baseTs),
    ...extractLitDynamicClasses(baseTs),
  ]);

  const vocab = new Map();
  for (const kind of KINDS) {
    const classes = new Set(baseClasses);
    for (const c of extractContractClasses(baseTs, kind)) classes.add(c);
    const path = litFileForKind(kind);
    if (!readText(path)) {
      vocab.set(kind, classes);
      continue;
    }
    const ts = readText(path);
    for (const c of extractLitAllTokens(ts)) classes.add(c);
    for (const c of extractLitDynamicClasses(ts)) classes.add(c);
    for (const c of extractContractClasses(ts, kind)) classes.add(c);

    // Pull in shared style/helper files explicitly imported by this component
    // (e.g. popup-styles.ts with renderOverlayPanel) without blindly following
    // every relative import, which would over-attribute shared base classes.
    const sharedImportRe = /from\s+['"](\.\/[^'"]*(?:popup-styles|overlay|calendar-pickers)[^'"]*)['"];/g;
    let m;
    while ((m = sharedImportRe.exec(ts)) !== null) {
      const resolved = resolveLitImportPath(path, m[1]);
      if (!resolved) continue;
      const sharedTs = readText(resolved);
      for (const c of extractLitAllTokens(sharedTs)) classes.add(c);
      for (const c of extractLitDynamicClasses(sharedTs)) classes.add(c);
    }

    vocab.set(kind, classes);
  }
  return vocab;
}

// ─── Theme extraction ────────────────────────────────────────────────────────

function extractThemeClasses(css) {
  const classes = new Set();
  const re = /\.([A-Za-z0-9_-]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    if (m[1].startsWith("mdy-")) classes.add(m[1]);
  }
  return classes;
}

function buildThemeVocabulary() {
  const themeFiles = readdirSync(STYLES_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(STYLES_DIR, f));

  const perTheme = new Map();
  const all = new Set();
  for (const path of themeFiles) {
    const css = readText(path);
    const classes = extractThemeClasses(css);
    perTheme.set(relative(STYLES_DIR, path), classes);
    for (const c of classes) all.add(c);
  }
  return { perTheme, all };
}

// ─── Matrix / defects ────────────────────────────────────────────────────────

function defectsA(angular, lit) {
  return [...angular].filter((c) => !lit.has(c)).sort();
}

function defectsB(lit, angular, themes) {
  return [...lit].filter((c) => !angular.has(c) && !themes.has(c)).sort();
}

function defectsC(themes, angular, lit) {
  return [...themes].filter((c) => !angular.has(c) && !lit.has(c)).sort();
}

function buildMatrix(angularVocab, litVocab, themeVocab, allowlist) {
  const matrix = [];
  for (const kind of KINDS) {
    const angular = angularVocab.get(kind) ?? new Set();
    const lit = litVocab.get(kind) ?? new Set();
    const allowed = allowlist.get(kind) ?? new Set();
    const aAll = defectsA(angular, lit);
    // A class the contract itself declares is not a divergence between two renderers, whichever of
    // them still spells it out. This audit reads source files, so it can only see a literal — and a
    // renderer that takes the class from the shared vocabulary at runtime stops writing one. Read as
    // a difference, that is a renderer *losing* a class at the moment it stopped keeping its own
    // copy, so the audit gets more wrong the further the migration succeeds. Whether the class
    // reaches the page is a question about the page and is answered there.
    const aContract = aAll.filter((c) => CONTRACT_CLASSES.has(c));
    const aOwn = aAll.filter((c) => !CONTRACT_CLASSES.has(c));
    const a = aOwn.filter((c) => !allowed.has(c));
    const aPending = aOwn.filter((c) => allowed.has(c));
    const aStale = [...allowed].filter((c) => !aOwn.includes(c)).sort();
    const b = defectsB(lit, angular, themeVocab.all);
    const c = defectsC(themeVocab.all, angular, lit);
    matrix.push({ kind, a, aContract, aPending, aStale, b, c, seen: { angular: angular.size, lit: lit.size } });
  }
  return matrix;
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function printMatrix(matrix) {
  console.log("# Theme class-contract audit\n");
  let totalA = 0;
  let totalB = 0;
  let totalC = 0;
  let totalPending = 0;
  let totalStale = 0;
  let totalContract = 0;
  for (const { kind, a, aContract, aPending, aStale, b, c } of matrix) {
    totalContract += aContract.length;
    totalA += a.length;
    totalB += b.length;
    totalC += c.length;
    totalPending += aPending.length;
    totalStale += aStale.length;
    console.log(`## ${kind}`);
    if (a.length) {
      console.log(`  (a) Angular classes missing in Lit (${a.length}):`);
      for (const cls of a) console.log(`      - ${cls}`);
    }
    if (aContract.length) {
      console.log(`  (a°) Declared by the contract, so not a renderer's to diverge on (${aContract.length}):`);
      for (const cls of aContract) console.log(`      - ${cls}`);
    }
    if (aPending.length) {
      console.log(`  (a*) Known pending parity gaps, allowlisted (${aPending.length}):`);
      for (const cls of aPending) console.log(`      - ${cls}`);
    }
    if (aStale.length) {
      console.log(`  (!) Stale allowlist entries — parity reached, remove from allowlist (${aStale.length}):`);
      for (const cls of aStale) console.log(`      - ${cls}`);
    }
    if (b.length) {
      console.log(`  (b) Lit-only classes not in Angular or themes (${b.length}):`);
      for (const cls of b) console.log(`      - ${cls}`);
    }
    console.log(`  (c) Theme classes emitted by neither: ${c.length}`);
    if (!a.length && !b.length) {
      console.log("  No (a)/(b) defects.");
    }
    console.log();
  }
  // **What this audit read, said in the report rather than only in its code.**
  //
  // It scans source text, so it sees a class only where a renderer *writes* one. A class the
  // renderer asks the contract for at runtime is on the element and invisible here — which is not a
  // corner case but the direction the migration is going, so these numbers fall as the work
  // succeeds. They are counts of classes written recognisably, never of classes emitted.
  //
  // A kind where one side yields nothing is the shape worth stopping on: a renderer that draws no
  // classes at all is unlikely, a spelling this scanner does not know is likelier, and that is
  // exactly how four classes went missing from this audit while sitting on the element.
  const silent = matrix.filter((row) => row.seen.angular === 0 || row.seen.lit === 0);
  console.log(
    `Read from source: ${matrix.reduce((n, r) => n + r.seen.angular, 0)} class(es) written in Angular, `
      + `${matrix.reduce((n, r) => n + r.seen.lit, 0)} in Lit — written, not emitted: a class asked of `
      + `the contract at runtime reaches the element and not this scanner.`,
  );
  if (silent.length > 0) {
    console.log(
      `  ${silent.length} kind(s) where one renderer yielded no classes at all — `
        + `${silent.map((r) => r.kind).join(", ")}. A renderer that draws nothing is unlikely; a `
        + "spelling this scanner does not recognise is likelier.",
    );
  }
  console.log(
    `Totals: (a) ${totalA}, (b) ${totalB}, (c) ${totalC}` +
      (totalContract ? `, declared by the contract ${totalContract}` : "") +
      (totalPending ? `, pending allowlisted ${totalPending}` : "") +
      (totalStale ? `, stale allowlist ${totalStale}` : ""),
  );
  return { totalA, totalB, totalC, totalPending, totalStale };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const angularVocab = buildAngularVocabulary();
const litVocab = buildLitVocabulary();
const themeVocab = buildThemeVocabulary();
const matrix = buildMatrix(angularVocab, litVocab, themeVocab, loadParityAllowlist());
const { totalA, totalB, totalPending, totalStale } = printMatrix(matrix);

if (process.argv.includes("--check")) {
  if (totalA > 0 || totalB > 0) {
    process.stderr.write(`Theme class-contract failed: (a) ${totalA}, (b) ${totalB}\n`);
    process.exit(1);
  }
  if (totalPending > 0) {
    process.stderr.write(
      `Theme class-contract passed with ${totalPending} allowlisted pending parity gap(s) (scripts/theme-parity-allowlist.json)\n`,
    );
  }
  if (totalStale > 0) {
    // Failed, not warned. A stale entry is a claim about the code that stopped being true — it says
    // a parity gap is accepted where parity has since been reached — and every sibling gate in this
    // repository fails on exactly that: audit-contract-style-coverage says so in its own usage line,
    // import-cycles fails on a closed cycle still recorded, styles-architecture on debt that is no
    // longer a finding. A warning here was the odd one out, and a warning nobody must act on is how
    // an allowlist grows into an absolution.
    process.stderr.write(
      `${totalStale} stale allowlist entr(y/ies) — parity reached, prune scripts/theme-parity-allowlist.json\n`,
    );
    process.exit(1);
  }
}

process.exit(0);
