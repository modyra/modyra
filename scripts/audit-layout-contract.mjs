#!/usr/bin/env node
/**
 * Cross-adapter audit for the declarative layout contract (contract v2 `layout`).
 *
 * Three things have to line up, and each fails differently when it does not:
 *   1. every class the contract names is styled by the foundation — otherwise a layout renders
 *      as an unstyled stack and the form looks broken rather than unarranged;
 *   2. an adapter that renders layout takes its classes from `@modyra/widgets` — otherwise two
 *      adapters draw two different grids for the same declaration;
 *   3. adapters that do not render layout yet are listed, with the gap stated rather than implied.
 *
 * Usage:
 *   node scripts/audit-layout-contract.mjs          # report
 *   node scripts/audit-layout-contract.mjs --check  # exit 1 on defects
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY } from "../packages/widgets/dist/index.js";

const ROOT = resolve(import.meta.dirname, "..");
const read = (path) => {
  try {
    return readFileSync(join(ROOT, path), "utf8");
  } catch {
    return "";
  }
};

/** Where each adapter would render a form's layout, and whether it does yet. */
const ADAPTERS = [
  { name: "plain", source: "packages/plain/src/mount.ts", implements: true },
  { name: "lit", source: "packages/lit/src/adapter.ts", implements: false },
  { name: "angular", source: "packages/angular/src/lib/dynamic/mdy-dynamic-form.component.ts", implements: false },
];

/**
 * Adapters that do not render declarative layout yet. Recorded rather than waived: the audit
 * asserts this list matches reality, so an adapter can neither start rendering layout without the
 * contract nor stay missing quietly.
 */
const NOT_IMPLEMENTED = ["lit", "angular"];

const FOUNDATION = "packages/styles/src/modyra.css";

const failures = [];
const notes = [];

// 1. Every contract class is styled by the foundation.
const foundation = read(FOUNDATION);
for (const [part, className] of Object.entries(MDY_LAYOUT_CLASSES)) {
  if (!foundation.includes(`.${className}`)) failures.push(`${FOUNDATION} does not style ${part} (.${className})`);
}
if (!foundation.includes(MDY_LAYOUT_COLUMN_COUNT_PROPERTY)) {
  failures.push(`${FOUNDATION} never reads ${MDY_LAYOUT_COLUMN_COUNT_PROPERTY}, so a column row cannot know its width`);
}

// 2/3. Adapters: the ones that render layout consume the contract; the others are listed.
const missing = [];
for (const adapter of ADAPTERS) {
  const source = read(adapter.source);
  const rendersLayout = /MdyDynamicLayoutNode|layoutNodeAttributes|mdy-layout-/.test(source);
  if (!rendersLayout) {
    missing.push(adapter.name);
    continue;
  }
  if (!source.includes("MDY_LAYOUT_CLASSES") && !source.includes("layoutNodeAttributes")) {
    failures.push(`${adapter.name} renders layout without the contract (${adapter.source})`);
  }
  // A literal class string is how the two drift apart.
  for (const className of Object.values(MDY_LAYOUT_CLASSES)) {
    if (source.includes(`"${className}"`)) {
      failures.push(`${adapter.name} hardcodes "${className}" instead of taking it from the contract`);
    }
  }
}

const unexpected = missing.filter((name) => !NOT_IMPLEMENTED.includes(name));
const stale = NOT_IMPLEMENTED.filter((name) => !missing.includes(name));
for (const name of unexpected) failures.push(`${name} no longer renders layout, but is not listed as missing`);
for (const name of stale) failures.push(`${name} now renders layout — prune it from NOT_IMPLEMENTED`);
for (const name of missing) notes.push(`${name} does not render declarative layout yet`);

process.stdout.write("# Declarative layout contract audit\n\n");
process.stdout.write(`Classes: ${Object.values(MDY_LAYOUT_CLASSES).join(", ")}\n`);
process.stdout.write(`Adapters rendering layout: ${ADAPTERS.length - missing.length}/${ADAPTERS.length}\n`);
for (const note of notes) process.stdout.write(`  pending: ${note}\n`);
for (const failure of failures) process.stdout.write(`  DEFECT: ${failure}\n`);
process.stdout.write(failures.length === 0 ? "\nLAYOUT CONTRACT CONSISTENT\n" : `\n${failures.length} defect(s)\n`);

if (process.argv.includes("--check") && failures.length > 0) process.exit(1);
process.exit(0);
