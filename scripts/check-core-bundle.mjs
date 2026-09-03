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
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
// 2026-08-01 (Milestone B, dimension 6 — the value contract): MDY_VALUE_CONTRACTS,
// matchesValueShape/explainValueMismatch (value-contracts.ts), mdyEmptyValueFor and the valueShape
// validator wired into buildDynamicFieldValidators. All always reachable from the main entry — the
// dynamic path calls them on every field — so the same "deliberate feature, not a leak" shape as
// every bump above. Verified against the message this check prints: no satellite (i18n, datetime,
// icons, devtools) appears in the whole-entry bundle. The budget was already at the line before
// this — 15.0 KB against 15 — so the headroom it looked like it had was not real.
// Real total after the change: whole entry 15.6 KB gzip, realistic surface 10.9 KB.

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

/**
 * Whether the artefact these figures are taken from was built from the source now on disk.
 *
 * The measurement reads `packages/core/dist`, never `src`, and a build directory is the one thing in
 * a shared tree that can be somebody else's: a figure taken while another build sat in `dist` is a
 * measurement of source that is not on this branch, and it reads exactly like a step change. That
 * happened while this check was being written — the same whole-entry figure came out 47.0 KB three
 * times and 46.9 KB three times, with `dist/index.js` byte-identical across both, because the files
 * beside it were not.
 *
 * Timestamps rather than content: there is nothing to compare a bundle against, and "the build is
 * older than the source" is the whole question.
 */
function newest(dir) {
  let latest = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else latest = Math.max(latest, statSync(path).mtimeMs);
    }
  };
  walk(dir);
  return latest;
}

const src = newest("packages/core/src");
const dist = newest("packages/core/dist");
console.log(`Measured from packages/core/dist, built ${new Date(dist).toISOString().slice(0, 19).replace("T", " ")}`
  + ` — not from source, and not from a tarball.`);
if (src > dist) {
  // Not a divergence — a run that cannot answer the question. Reporting either verdict off a build
  // that is not the source in hand would put a number in the guide for code nobody has.
  console.error("packages/core/src is NEWER than that build: these figures are of source that is no"
    + "\n  longer what you have. Run `npm run build:core` and measure again.");
  process.exit(1);
}

const whole = measure("whole", "packages/core/dist/index.js");
const surface = measure("surface", surfaceEntry);

console.log(`@modyra/core whole entry:        ${whole.min.toFixed(1)} KB min, ${whole.gz.toFixed(1)} KB gzip`);
console.log(`@modyra/core realistic surface:  ${surface.min.toFixed(1)} KB min, ${surface.gz.toFixed(1)} KB gzip`);

// The size is not gated; the *divergence* is.
//
// A budget raised every time a legitimate feature crosses it records past sizes rather than limiting
// future ones, and it blocked correct changes — in CI and in the release workflow. So growth passes,
// as long as it is declared: the guide's trajectory table is where a product decision about weight
// belongs, and a reader can judge it there.
//
// What fails is the guide and the measurement disagreeing. That is the defect that let the realistic
// surface go from 13.4 KB to 26.3 KB with nobody noticing — not the growth, the silence about it.
// Under this rule every new kilobyte costs one line of guide that admits it, and that line is
// precisely what the next reader needs to find.
console.log("The weight is not gated; a guide that no longer matches it is.");

/**
 * What the guide says these numbers are, so the two can be seen to disagree.
 *
 * The guide's table is the published claim; this script is the measurement behind it, and until now
 * neither knew about the other. That is the shape that produced the drift the guide itself
 * describes: "between 2026-08-10 and 2026-08-20 the realistic surface went from 13.4 KB gzip to
 * 26.3 KB, and nothing noticed". Reporting without gating is a deliberate decision — a budget raised
 * whenever a legitimate feature crosses it records past sizes instead of limiting future ones — but
 * *silence* was not part of that decision. A reader was expected to watch for a step change, and a
 * reader cannot see a step change against a figure printed in another file.
 *
 * So the divergence is stated, in both numbers, with the date the guide claims for its own. The
 * guide stays the declaration; this stays the measurement; neither is quietly corrected into the
 * other.
 */
const GUIDE = "docs/guides/comparison-form-libraries.md";
function published() {
  const doc = readFileSync(join(fileURLToPath(new URL("..", import.meta.url)), GUIDE), "utf8");
  const row = (label) => {
    const found = doc.match(new RegExp(`\\|\\s*${label}\\s*\\|[^|]*\\|\\s*\\*{0,2}([0-9.]+) KB`));
    return found ? Number(found[1]) : null;
  };
  const measured = doc.match(/^### Modyra, measured (\S+)/m);
  return { whole: row("Whole entry"), surface: row("Realistic surface"), on: measured?.[1] ?? "an unstated date" };
}

const claim = published();
if (claim.whole === null || claim.surface === null) {
  console.error(`\n${GUIDE} no longer states both figures in the shape this reads — the two cannot be`
    + " compared, which is a defect in this check rather than a clean result.");
  process.exit(1);
} else {
  // The tolerance is one published step, and it is the guide's precision that sets it.
  //
  // The guide states one decimal, so it cannot express a difference below 0.1 KB and a comparison
  // finer than that is measuring the rounding. Worse, it is not stable: this bundle compresses to
  // 46.932 KB after `npm run build:core` and to 46.967 KB after another build of the same source —
  // identical length, different bytes — which straddles the boundary between `46.9` and `47.0`. A
  // 0.05 threshold would call that a drift on one build and agreement on the next, and the flap
  // would carry no information about the library at all.
  //
  // So: a difference of at least one full step is a divergence, and the measurement is printed to
  // two decimals when one is reported, because a reader looking at 0.1 KB needs to see whether it is
  // a real move or a boundary.
  const STEP = 0.1;
  const drift = (label, mine, theirs) =>
    Math.abs(mine - theirs) < STEP ? null
      : `${label}: measured ${mine.toFixed(2)} KB, the guide publishes ${theirs.toFixed(1)} KB `
        + `(${mine > theirs ? "+" : ""}${(mine - theirs).toFixed(2)} KB since ${claim.on})`;
  const found = [drift("whole entry", whole.gz, claim.whole), drift("realistic surface", surface.gz, claim.surface)]
    .filter(Boolean);
  if (found.length === 0) {
    console.log(`${GUIDE} publishes the same two figures within its own 0.1 KB precision, measured ${claim.on}.`);
  } else {
    console.error(`\n${GUIDE} publishes figures this run does not reproduce:`);
    for (const one of found) console.error(`  ${one}`);
    console.error("  Neither number is wrong on its own, and growth is not the finding. Add the row to"
      + "\n  the guide's trajectory table and update the figures above it — a weight nobody wrote down"
      + "\n  is the thing this fails on.");
    process.exit(1);
  }
}
