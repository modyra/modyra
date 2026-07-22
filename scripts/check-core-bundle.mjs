/**
 * Core bundle guard — the numbers behind docs/guides/comparison-form-libraries.md.
 *
 * Measures, with the same esbuild+gzip methodology as the comparison doc:
 *  1. the whole `@modyra/core` entry (worst case, every export);
 *  2. a realistic typed-form surface (createForm + descriptors + validators
 *     + serverValidator + oneOf) — what a real consumer's bundler keeps.
 *
 * Budgets only ever move DOWN (or with a justified comment, like the
 * Angular bundle test). Run after `npm run build:core`.
 */
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 2026-07-21 (phase J): whole entry 10.7 KB gzip after satellites moved to
// subpath entries; realistic surface 9.3 KB. Budgets just above.
// 2026-07-22 (reactivity-adapter-api plan M1-M8 + construction/activation
// split): MdyReactiveScope, the typed error classes (reactivity-errors.ts),
// structured diagnostics (reactivity-diagnostics.ts), the handle-ownership
// WeakMap registry (reactive-owner.ts) and vanillaReactivity()'s real
// batch()/flush()/observe() are all real new code, always reachable from
// the main entry (not satellite/opt-in like i18n/datetime/icons) — same
// "deliberate feature, not a leak" shape as every budget bump above this
// one. Real total after the change: whole entry 14.1 KB gzip, realistic
// surface 10.6 KB gzip. Budgets kept tight just above both.
const WHOLE_BUDGET_KB = 15;
const SURFACE_BUDGET_KB = 11;

const outDir = join(tmpdir(), "mdy-core-bundle-check");
mkdirSync(outDir, { recursive: true });

const surfaceEntry = join(outDir, "surface-entry.mjs");
writeFileSync(
  surfaceEntry,
  'export { createForm, field, group, array, required, email, min, minLength, maxLength, pattern, crossField, serverValidator, oneOf, eachOneOf } from "@modyra/core";\n',
  "utf8",
);

function measure(label, entry) {
  const out = join(outDir, `${label}.js`);
  execFileSync(
    "npx",
    [
      "-y", "esbuild@0.25.0", entry,
      "--bundle", "--minify", "--format=esm",
      `--outfile=${out}`, "--log-level=error",
      "--alias:@modyra/core=" + process.cwd() + "/packages/core/dist/index.js",
    ],
    { stdio: "inherit" },
  );
  const min = readFileSync(out).length / 1024;
  const gz = gzipSync(readFileSync(out), { level: 9 }).length / 1024;
  return { min, gz };
}

const whole = measure("whole", "packages/core/dist/index.js");
const surface = measure("surface", surfaceEntry);

console.log(`@modyra/core whole entry:        ${whole.min.toFixed(1)} KB min, ${whole.gz.toFixed(1)} KB gzip`);
console.log(`@modyra/core realistic surface:  ${surface.min.toFixed(1)} KB min, ${surface.gz.toFixed(1)} KB gzip`);

let failed = false;
if (whole.gz > WHOLE_BUDGET_KB) {
  console.error(
    `Whole entry exceeds budget: ${whole.gz.toFixed(1)} KB > ${WHOLE_BUDGET_KB} KB — ` +
    "did something re-import a satellite module (i18n/datetime/icons/devtools) into index.ts?",
  );
  failed = true;
}
if (surface.gz > SURFACE_BUDGET_KB) {
  console.error(
    `Realistic surface exceeds budget: ${surface.gz.toFixed(1)} KB > ${SURFACE_BUDGET_KB} KB.`,
  );
  failed = true;
}
if (failed) process.exit(1);
console.log("Core bundle check OK.");
