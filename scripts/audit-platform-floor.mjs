/**
 * The platform this library promises to work on, and every feature it uses below that line.
 *
 * The repository reached its current shape one rule at a time — 85 uses of `:has()`, 144 of
 * `color-mix()` — with nothing declaring where the floor is. That is not a problem while every
 * feature happens to be old enough; it becomes one silently, the first time a rule lands that is
 * newer than the browsers somebody is actually using, because nothing anywhere would say so.
 *
 * A floor nobody enforces is a floor nobody has. So this fails the build, and the allowlist beside
 * it is the price: a feature below the line is allowed **with a fallback that a check
 * demonstrates**. A fallback stated in a comment is a claim nobody has tested, and the two are
 * indistinguishable from here.
 *
 * The allowlist is also the documentation of what somebody under the floor actually loses, which is
 * the question a consumer asks and nothing else in this repository answers.
 *
 *   node scripts/audit-platform-floor.mjs           # report
 *   node scripts/audit-platform-floor.mjs --check   # exit 1 on defects
 *
 * ## Two kinds of proof, because the two kinds of feature fail differently
 *
 * A **style** below the floor is inert where it is unsupported: the declaration is dropped and
 * whatever was declared before it stands. Its proof is therefore structural — every use inside an
 * `@supports`, with the fallback declared outside — and this reads it directly rather than trusting
 * a test to have covered every rule.
 *
 * A **script** below the floor throws or returns nothing, which takes the page with it unless
 * somebody wrote the branch. That branch is a claim about behaviour and only a check can hold it,
 * so the entry names the file and this asserts the file exists and exercises the feature.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const FLOOR = join(root, "packages/widgets/contract-baseline/platform-floor.json");

const STYLE_ROOTS = ["packages/styles/src"];
const SCRIPT_ROOTS = ["packages/core/src", "packages/widgets/src", "packages/plain/src", "packages/lit/src", "packages/angular/src"];

const floor = JSON.parse(readFileSync(FLOOR, "utf8"));

function collect(dir, test, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, test, out);
    else if (test.test(entry)) out.push(path);
  }
  return out;
}

/**
 * The source with its comments removed.
 *
 * Not cosmetic: three features in this repository are named only in prose explaining why they are
 * guarded, and counting those as uses reports the explanation as the defect.
 */
const withoutComments = (source, kind) => {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return kind === "style" ? stripped : stripped.replace(/\/\/[^\n]*/g, "");
};

/**
 * Every `@supports` block in a stylesheet, as the character ranges it covers.
 *
 * Brace counting rather than a parser: a stylesheet is regular enough here, and a dependency for
 * this would be a larger decision than the check is worth.
 */
function supportsRanges(css) {
  const ranges = [];
  for (const match of css.matchAll(/@supports[^{]*\{/g)) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    for (; index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    ranges.push([match.index, index]);
  }
  return ranges;
}

/**
 * A declaration whose value asks for the absence of the feature.
 *
 * `none`, and the three global keywords that mean "as if nothing had been declared". Matched right
 * after the property name, so a value that merely contains the word is not caught.
 */
const SWITCHES_OFF = /^[-\w]*\s*:\s*(none|initial|unset|revert)\b/;

const defects = [];
const report = [];

const byWhere = (where) => floor.allowed.filter((entry) => entry.where === where);
const matchers = (entry) => entry.matches.map((needle) => ({ needle, entry }));

// ── Styles: every use inside an `@supports`, and nothing below the floor left undeclared ────────

const styleEntries = byWhere("style").flatMap(matchers);
for (const file of STYLE_ROOTS.flatMap((dir) => collect(join(root, dir), /\.css$/))) {
  const raw = readFileSync(file, "utf8");
  const css = withoutComments(raw, "style");
  const ranges = supportsRanges(css);
  const inside = (index) => ranges.some(([from, to]) => index > from && index < to);

  for (const { needle, entry } of styleEntries) {
    let uses = 0;
    let unguarded = 0;
    for (let at = css.indexOf(needle); at !== -1; at = css.indexOf(needle, at + 1)) {
      // A declaration that switches the feature *off* is not a use of it. `backdrop-filter: none`
      // under reduced motion asks for the plain surface a browser without the feature already has,
      // so requiring a guard there would demand a fallback for the fallback.
      if (SWITCHES_OFF.test(css.slice(at, at + needle.length + 24))) continue;
      uses += 1;
      if (!inside(at)) {
        unguarded += 1;
        defects.push(`${file.slice(root.length)}: \`${needle}\` used outside \`@supports\` — ${entry.feature} is below the floor and its fallback is the guard`);
      }
    }
    if (uses > 0) report.push({ feature: entry.feature, file: file.slice(root.length), uses, unguarded });
  }
}

// ── Scripts: every entry's fallback named, and the check that names it real ─────────────────────

const scriptFiles = SCRIPT_ROOTS.flatMap((dir) => collect(join(root, dir), /\.ts$/));
const scriptSources = new Map(scriptFiles.map((file) => [file, withoutComments(readFileSync(file, "utf8"), "script")]));

for (const entry of byWhere("script")) {
  const used = [...scriptSources].filter(([, source]) => entry.matches.some((needle) => source.includes(needle)));
  if (used.length === 0) {
    defects.push(`${entry.feature}: allowed below the floor and used nowhere — an entry nobody needs is a promise nobody is keeping`);
    continue;
  }
  report.push({ feature: entry.feature, file: `${used.length} file(s)`, uses: used.length, unguarded: 0 });

  if (typeof entry.provenBy !== "string") {
    defects.push(`${entry.feature}: below the floor with no \`provenBy\` — a fallback nothing exercises is a claim, not a fallback`);
    continue;
  }
  let proof;
  try { proof = readFileSync(join(root, entry.provenBy), "utf8"); }
  catch { defects.push(`${entry.feature}: \`provenBy\` names ${entry.provenBy}, which does not exist`); continue; }
  const exercised = entry.matches.filter((needle) => proof.includes(needle));
  if (exercised.length === 0) {
    defects.push(`${entry.feature}: ${entry.provenBy} never mentions ${entry.matches.join(" or ")} — it proves something else`);
  }
}

// ── Every entry says what is lost, because that is what a consumer reads ────────────────────────

for (const entry of floor.allowed) {
  if (!Object.hasOwn(floor.roles, entry.role ?? "")) {
    defects.push(`${entry.feature}: role \`${entry.role}\` is not one the floor declares`);
  }
  for (const field of ["lost", "fallback", "baseline"]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      defects.push(`${entry.feature}: \`${field}\` is empty — an allowlist that does not say what is lost documents nothing`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────────

console.log(`# The platform floor\n`);
console.log(`Floor: Baseline ${floor.floor.baseline}, declared ${floor.floor.declaredOn}.`);
console.log(`Below it, and allowed: ${floor.allowed.length}\n`);
for (const entry of floor.allowed) {
  const seen = report.filter((r) => r.feature === entry.feature);
  const uses = seen.reduce((total, r) => total + r.uses, 0);
  const bad = seen.reduce((total, r) => total + r.unguarded, 0);
  console.log(`  ${entry.feature}  [${entry.role}]  ${uses} use(s)${bad > 0 ? `, ${bad} unguarded` : ""}`);
  console.log(`    without it: ${entry.lost}`);
}

if (defects.length > 0) {
  console.error(`\nPLATFORM FLOOR BREACHED (${defects.length})\n`);
  for (const defect of defects) console.error(`- ${defect}`);
  console.error(`\nEither guard the use, or add it to ${FLOOR.slice(root.length)} with what is lost and the check that proves the fallback.`);
  if (process.argv.includes("--check")) process.exit(1);
} else {
  console.log(`\nPLATFORM FLOOR HELD`);
}
