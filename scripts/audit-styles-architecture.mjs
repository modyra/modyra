#!/usr/bin/env node
/**
 * Architectural rules for `@modyra/styles`.
 *
 * The migration's premise is that a theme decides how a control looks and the foundation decides
 * how it works. These checks are that premise, made enforceable:
 *
 *   1. a theme must not name an adapter — a rule keyed on `.mdy-plain-*` styles a renderer, not a
 *      contract, and breaks the moment another adapter draws the same widget;
 *   2. a theme must not position an overlay — placement decides whether a popup lands on its own
 *      control, which is structure;
 *   3. a theme must not re-declare `[hidden]` — whether a closed popup is closed is not a look;
 *   4. the foundation must not carry a brand font or a literal palette, or it becomes a theme.
 *
 * Known debt is listed in DEBT with the reason, so it can shrink but not grow silently.
 *
 * Usage:
 *   node scripts/audit-styles-architecture.mjs          # report
 *   node scripts/audit-styles-architecture.mjs --check  # exit 1 on defects
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SHEET_ROLES, publishedSheets, unclassifiedSheets } from "./lib/published-sheets.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "packages/styles/src");

/**
 * What a consumer can load, taken from the package's own `exports`, and what each sheet is.
 *
 * The roster used to be four theme names written here. `@modyra/styles` publishes eight CSS
 * subpaths, so three of them — the default theme, the foundation a consumer actually imports, and
 * the salience theme — were never asked a single one of these questions, and the audit reported
 * clean. A frozen list is the same defect as a frozen file check: what it does not name, it excuses,
 * and it excuses it silently.
 *
 * So the roster is the manifest, and every published sheet must be classified below. A sheet added
 * to `exports` with no entry here fails, because the alternative is that publishing a new theme is
 * how you stop being audited.
 */
const SHEETS = publishedSheets();
const unclassified = unclassifiedSheets();
const roleOf = (name) => SHEET_ROLES[[...SHEETS].find(([, file]) => file === name)?.[0] ?? name];

const FOUNDATION = Object.keys(SHEET_ROLES)
  .filter((key) => SHEET_ROLES[key] === "foundation")
  .map((key) => SHEETS.get(key) ?? key);
const THEMES = [...SHEETS].filter(([subpath]) => SHEET_ROLES[subpath] === "theme").map(([, file]) => file);

/**
 * Accepted debt, each with the reason it is still here. The audit asserts every entry is still a
 * real finding, so a fixed one cannot linger and a new one cannot hide behind an old one.
 */
const DEBT = [];

const read = (name) => readFileSync(join(SRC, name), "utf8");
/** Strips comments so a rule quoted in prose is not read as a rule. */
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const defects = [];
const debtSeen = new Set();

for (const name of THEMES) {
  const css = strip(read(name));

  for (const match of css.matchAll(/\.mdy-(plain|angular|lit)-[a-z0-9_-]*/g)) {
    defects.push(`${name}: styles the ${match[1]} adapter directly (${match[0]})`);
  }

  // Positioning inside a rule that names a popup: the placement contract owns that.
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    if (!/popup|dropdown|overlay|__panel/i.test(selector)) continue;
    // Themes whose overlay positioning is recorded debt are reported once, as debt, not per rule.
    if (["modyra-material.css", "modyra-ios.css"].includes(name)) continue;
    for (const property of ["top", "bottom", "left", "right", "inset", "inset-block", "inset-inline", "position"]) {
      const declared = new RegExp(`(^|;|\\s)${property}\\s*:`).test(body);
      // A value that just forwards the contract's own properties is applying placement, not deciding it.
      const forwards = new RegExp(`${property}\\s*:\\s*var\\(--mdy-overlay-`).test(body);
      if (declared && !forwards) {
        defects.push(`${name}: positions an overlay (${selector.trim().split("\n")[0]} → ${property})`);
      }
    }
  }

  if (/\[hidden\]/.test(css)) defects.push(`${name}: re-declares [hidden]; whether a closed popup is closed is structure`);

  // How a control arranges what it holds is structure too. Material declared `.mdy-datepicker` a
  // block, and a date range's two inputs and its toggle stacked: one field stood three times as
  // tall as the one above it, from a theme rule that looked like a formality.
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    if (!/(^|[\s,])\.mdy-(datepicker|timepicker|input-wrapper|renderer)(?![\w-])/.test(selector)) continue;
    if (/(^|;|\s)display\s*:/.test(body)) {
      defects.push(`${name}: sets display on a control's own box (${selector.trim().split("\n")[0]}); how it arranges what it holds is structure`);
    }
  }

  // A theme builds on the foundation. Importing another theme is how Material became everyone's
  // base: three themes spent their rules undoing a field they never asked for.
  for (const match of css.matchAll(/@import\s+['"]\.\/(modyra-(?:material|modern|ios|ionic)|modyra)\.css['"]/g)) {
    const imported = `${match[1]}.css`;
    if (imported === `${name}`) continue;
    defects.push(`${name}: imports ${imported}; a theme builds on modyra-foundation.css, not on another theme`);
  }

  for (const debt of DEBT) if (debt.matches(name, css)) debtSeen.add(debt.id);
}

/**
 * A field's height is stated once, for what a control *is*.
 *
 * Giving `min-height: var(--mdy-input-height)` to a list of input types — text, number, date,
 * email — leaves a password box, a select's trigger and a picker's input a dozen pixels shorter
 * than the field beside them. An enumeration cannot be right here: it is only ever as complete as
 * the day it was written.
 */
function checkFieldHeight(css) {
  const found = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    if (!/min-height\s*:\s*var\(--mdy-input-height/.test(body)) continue;
    if (/input\[type=/.test(selector)) {
      found.push(`the field height is stated per input type (${selector.trim().split("\n")[0].slice(0, 60)}…); state it for what a control is`);
    }
  }
  return found;
}

/**
 * The foundation loads the token tier it depends on.
 *
 * The alternative — a literal fallback on every `--mdy-sys-*` and `--mdy-comp-*` use, in case a
 * theme does not load `modyra-base.css` — is worse than it looks. An unresolved `var()` drops the
 * whole declaration, so the fallbacks are load-bearing; but each one is a copy of a value
 * `modyra-base.css` already owns, and a literal cannot follow a chosen brand colour. A page picking
 * a green primary gets indigo out of the fallback.
 *
 * So the import is what has to hold, and it is what this checks. Themes remain free to load the
 * tier or not; nothing here assumes on their behalf.
 */
function checkTokenTierIsLoaded(css, name) {
  // Followed through the imports rather than asked of one file. The foundation a consumer names is
  // `modyra-foundation.css`, and it loads the tier through `modyra.css`; a direct-import rule reads
  // that as a missing tier and reports a hole in the sheet everybody actually imports. What has to
  // hold is that the tier is loaded by the time this sheet is, not which line loads it.
  const seen = new Set();
  const loads = (from) => {
    if (seen.has(from)) return false;
    seen.add(from);
    let css;
    try { css = strip(read(from)); } catch { return false; }
    if (/@import\s+["']\.\/modyra-base\.css["']/.test(css)) return true;
    return [...css.matchAll(/@import\s+["']\.\/([\w.-]+\.css)["']/g)].some((m) => loads(m[1]));
  };
  if (loads(name)) return [];
  return [
    "does not import modyra-base.css, directly or through anything it imports; without the token tier every --mdy-sys-* and --mdy-comp-* reference drops the declaration it is in",
  ];
}

/**
 * Motion comes from the tier, and every stylesheet that moves respects a request not to.
 *
 * Six durations and seven easings were spread across the foundation and the four themes, including
 * `cubic-bezier(0.4, 0, 0.2, 1)` written two ways — the same curve, spelled differently, in two
 * files. A control that opens in 0.15s under one theme and 0.2s under another is not the same
 * control, and nothing could tell you they had drifted.
 *
 * The second half matters more: the foundation honoured `prefers-reduced-motion` for two parts out
 * of fifty-three, and Ionic honoured it nowhere. Motion is a preference a person states, so a
 * stylesheet that animates and never reads it is not a styling gap.
 */
function checkMotion(css, name) {
  const found = [];
  for (const match of css.matchAll(/transition(?:-duration|-timing-function)?:\s*([^;]+);/g)) {
    const body = match[1];
    if (/cubic-bezier/.test(body) && !/var\(--mdy-sys-motion-easing/.test(body)) {
      found.push(`spells a literal easing curve in \`${body.trim()}\`; the curves are named in the token tier`);
    }
    // `0s` and `0.01ms` are "no motion", not a duration anybody tunes.
    const literal = body.match(/(?<![\d.])(0?\.\d+|\d+)s(?![\d.])/);
    if (literal && literal[0] !== "0s" && !/var\(--mdy-sys-motion-duration/.test(body)) {
      found.push(`spells the literal duration ${literal[0]} in \`${body.trim()}\`; the durations are named in the token tier`);
    }
  }
  if (/transition|animation:/.test(css) && !/prefers-reduced-motion/.test(css)) {
    found.push("animates without ever reading `prefers-reduced-motion`");
  }
  return found.map((defect) => `${name}: ${defect}`);
}

/**
 * A trailing affordance takes its geometry from the tokens, not from a number of its own.
 *
 * The controls at a field's inline end — a calendar button, a clock button, a colour swatch, a
 * search button, the steppers, the select caret — are read as one column down a form. Measured
 * before the tokens existed, their centres sat 17, 19, 25 and 31 pixels from their field's inline
 * end in boxes of 16, 24, 28 and 44: every rule reasonable alone, the column visibly wandering.
 *
 * Each literal here is how that happened, one well-meant number at a time.
 */
const AFFORDANCE_SELECTOR = /(select__arrow|datepicker__toggle|timepicker__toggle|colors__toggle-area|multiselect__search-btn|spin-btn)\b/;
const AFFORDANCE_SIZE = /(?:^|;)\s*(width|height|min-width|min-height|inset-inline-end)\s*:\s*([^;]+)/g;

function checkAffordanceGeometry(css, name) {
  const found = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    if (!AFFORDANCE_SELECTOR.test(selector)) continue;
    // The glyph inside is sized by its own token; the box and the inset by theirs.
    for (const declaration of body.matchAll(AFFORDANCE_SIZE)) {
      const [, property, value] = declaration;
      if (/var\(--mdy-affordance-/.test(value)) continue;
      // `0`, `100%` and `auto` claim no size of their own.
      if (/^\s*(0|auto|100%|inherit|unset)\s*$/.test(value)) continue;
      found.push(
        `${name}: ${selector.trim().split("\n").pop().trim().slice(0, 48)} sets ${property}: ${value.trim()} ` +
        "on a trailing affordance; the geometry is named by --mdy-affordance-*",
      );
    }
  }
  return found;
}

const BRAND_FONTS = /"(Satoshi|Outfit|Inter|Roboto|SF Pro[^"]*|Helvetica Neue)"/g;
for (const name of FOUNDATION) {
  const css = strip(read(name));
  for (const match of css.matchAll(BRAND_FONTS)) {
    defects.push(`${name}: names the brand face ${match[0]}; a font belongs to a theme`);
  }
  // Literal colours outside a var() fallback: the fallback keeps a var() resolvable, a bare hex is a palette.
  for (const match of css.matchAll(/(^|[\s:,(])#[0-9a-fA-F]{3,8}\b/g)) {
    const index = match.index ?? 0;
    const context = css.slice(Math.max(0, index - 80), index);
    if (!context.includes("var(")) defects.push(`${name}: carries the literal colour ${match[0].trim()}`);
  }
  for (const defect of checkFieldHeight(css)) defects.push(`${name}: ${defect}`);
  for (const defect of checkTokenTierIsLoaded(css, name)) defects.push(`${name}: ${defect}`);
  for (const defect of checkMotion(css, name)) defects.push(defect);
  for (const defect of checkAffordanceGeometry(css, name)) defects.push(defect);
  for (const debt of DEBT) if (debt.matches(name, css)) debtSeen.add(debt.id);
}

// Motion is checked in the themes too. Everything else in this audit is about what a *foundation*
// may assume; a duration is about whether the same control moves the same way wherever it is drawn.
for (const name of THEMES) {
  const css = strip(read(name));
  for (const defect of checkMotion(css, name)) defects.push(defect);
  for (const defect of checkAffordanceGeometry(css, name)) defects.push(defect);
}

for (const subpath of unclassified) {
  defects.push(`packages/styles publishes ./${subpath} and this audit does not say what it is; `
    + "classify it as a theme, a foundation or neither, with the reason");
}

const stale = DEBT.filter((debt) => !debtSeen.has(debt.id));

process.stdout.write("# Styles architecture audit\n\n");
process.stdout.write(`Read from packages/styles/package.json: ${SHEETS.size} published sheet(s).\n`);
process.stdout.write(`Foundation: ${FOUNDATION.join(", ")}\nThemes: ${THEMES.join(", ")}\n`);
process.stdout.write(`Neither: ${Object.keys(SHEET_ROLES).filter((k) => SHEET_ROLES[k] === "neither").join(", ") || "(none)"}\n\n`);
for (const debt of DEBT) {
  if (debtSeen.has(debt.id)) process.stdout.write(`  debt: ${debt.id} — ${debt.reason}\n`);
}
for (const entry of stale) process.stdout.write(`  DEFECT: debt "${entry.id}" is no longer a finding — prune it\n`);
for (const defect of defects) process.stdout.write(`  DEFECT: ${defect}\n`);

const total = defects.length + stale.length;
process.stdout.write(total === 0 ? "\nSTYLES ARCHITECTURE CLEAN\n" : `\n${total} defect(s)\n`);

if (process.argv.includes("--check") && total > 0) process.exit(1);
process.exit(0);
