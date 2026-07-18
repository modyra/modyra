#!/usr/bin/env node
/**
 * Theme class-contract audit.
 *
 * Compares the class vocabulary emitted by Angular renderers (including
 * subcomponents) with the class vocabulary emitted by Lit elements and the
 * classes styled by the shipped themes.
 *
 * Usage:
 *   node scripts/audit-theme-classes.mjs         # report
 *   node scripts/audit-theme-classes.mjs --check # exit 1 on defects
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const ANGULAR_DIR = join(ROOT, "packages/angular/src/lib");
const ANGULAR_RENDERER_DIR = join(ANGULAR_DIR, "renderers");
const ANGULAR_CONTROL_DIR = join(ANGULAR_DIR, "control");
const LIT_DIR = join(ROOT, "packages/lit/src/components");
const LIT_BASE = join(ROOT, "packages/lit/src/base.ts");
const STYLES_DIR = join(ROOT, "packages/styles/src");

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

function extractAngularClasses(ts, filePath) {
  const template = findTemplate(ts, filePath);
  const host = findHostBindings(ts);
  const fromTemplate = extractTemplateClasses(template);
  return new Set([...fromTemplate, ...host]);
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
      for (const c of extractAngularClasses(ts, path)) classes.add(c);
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

function extractLitAllTokens(ts) {
  // Scan the whole file for mdy-* tokens. This is robust against nested
  // template literals and conditional class strings. Tokens ending in `-`
  // are placeholders (e.g. mdy-field-) and are ignored. CSS custom property
  // names (--mdy-*) are not class names and are skipped.
  const code = stripComments(ts);
  const classes = [];
  const tokenRe = /(?<!-)mdy-[A-Za-z0-9_-]+/g;
  let m;
  while ((m = tokenRe.exec(code)) !== null) {
    const token = m[0];
    if (!token.endsWith("-")) classes.push(token);
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

function buildLitVocabulary() {
  const baseTs = readText(LIT_BASE);
  const baseClasses = new Set([
    ...extractLitAllTokens(baseTs),
    ...extractLitDynamicClasses(baseTs),
  ]);

  const vocab = new Map();
  for (const kind of KINDS) {
    const classes = new Set(baseClasses);
    const path = litFileForKind(kind);
    if (readText(path)) {
      const ts = readText(path);
      for (const c of extractLitAllTokens(ts)) classes.add(c);
      for (const c of extractLitDynamicClasses(ts)) classes.add(c);
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

function buildMatrix(angularVocab, litVocab, themeVocab) {
  const matrix = [];
  for (const kind of KINDS) {
    const angular = angularVocab.get(kind) ?? new Set();
    const lit = litVocab.get(kind) ?? new Set();
    const a = defectsA(angular, lit);
    const b = defectsB(lit, angular, themeVocab.all);
    const c = defectsC(themeVocab.all, angular, lit);
    matrix.push({ kind, a, b, c });
  }
  return matrix;
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function printMatrix(matrix) {
  console.log("# Theme class-contract audit\n");
  let totalA = 0;
  let totalB = 0;
  let totalC = 0;
  for (const { kind, a, b, c } of matrix) {
    totalA += a.length;
    totalB += b.length;
    totalC += c.length;
    console.log(`## ${kind}`);
    if (a.length) {
      console.log(`  (a) Angular classes missing in Lit (${a.length}):`);
      for (const cls of a) console.log(`      - ${cls}`);
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
  console.log(`Totals: (a) ${totalA}, (b) ${totalB}, (c) ${totalC}`);
  return { totalA, totalB, totalC };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const angularVocab = buildAngularVocabulary();
const litVocab = buildLitVocabulary();
const themeVocab = buildThemeVocabulary();
const matrix = buildMatrix(angularVocab, litVocab, themeVocab);
const { totalA, totalB, totalC } = printMatrix(matrix);

if (process.argv.includes("--check")) {
  if (totalA > 0 || totalB > 0) {
    process.stderr.write(`Theme class-contract failed: (a) ${totalA}, (b) ${totalB}\n`);
    process.exit(1);
  }
}

process.exit(0);
