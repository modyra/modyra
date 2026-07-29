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

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "packages/styles/src");

// The foundation proper. `modyra-base.css` is deliberately absent: it is the brand token tier
// (`--mdy-ref-*`), and reference tokens are exactly the raw brand values a foundation must not
// contain but something has to declare.
const FOUNDATION = ["modyra.css"];
const THEMES = ["modyra-modern.css", "modyra-material.css", "modyra-ios.css", "modyra-ionic.css"];

/**
 * Accepted debt, each with the reason it is still here. The audit asserts every entry is still a
 * real finding, so a fixed one cannot linger and a new one cannot hide behind an old one.
 */
const DEBT = [
  {
    id: "material-positions-colors-popup",
    reason: "Material and iOS still place the colours popup themselves, from before the anchoring contract existed. They move onto `--mdy-overlay-*` when those two themes migrate.",
    matches: (name, css) => ["modyra-material.css", "modyra-ios.css"].includes(name) && /mdy-colors__dropdown|mdy-select__dropdown/.test(css) && /position\s*:/.test(css),
  },
];

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
 * The foundation used to give `min-height: var(--mdy-input-height)` to a list of input types —
 * text, number, date, email — so a password box, a select's trigger and a picker's input each stood
 * a dozen pixels shorter than the field beside them. An enumeration cannot be right: it is only ever
 * as complete as the day it was written.
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
  for (const debt of DEBT) if (debt.matches(name, css)) debtSeen.add(debt.id);
}

const stale = DEBT.filter((debt) => !debtSeen.has(debt.id));

process.stdout.write("# Styles architecture audit\n\n");
process.stdout.write(`Foundation: ${FOUNDATION.join(", ")}\nThemes: ${THEMES.join(", ")}\n\n`);
for (const debt of DEBT) {
  if (debtSeen.has(debt.id)) process.stdout.write(`  debt: ${debt.id} — ${debt.reason}\n`);
}
for (const entry of stale) process.stdout.write(`  DEFECT: debt "${entry.id}" is no longer a finding — prune it\n`);
for (const defect of defects) process.stdout.write(`  DEFECT: ${defect}\n`);

const total = defects.length + stale.length;
process.stdout.write(total === 0 ? "\nSTYLES ARCHITECTURE CLEAN\n" : `\n${total} defect(s)\n`);

if (process.argv.includes("--check") && total > 0) process.exit(1);
process.exit(0);
