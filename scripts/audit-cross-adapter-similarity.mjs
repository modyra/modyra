/**
 * Two adapters writing the same function is the failure this repository keeps having.
 *
 * The import graph has never caught it: every copy imports legally, from its own package, and the
 * build is happy. What the copies do is drift — measured here, one of three light-dismiss bindings
 * was missing `pointerup`, and one of three range-cell tests compared ISO strings where the other
 * two compared dates. A behaviour written once in `@modyra/core` or `@modyra/widgets` cannot do
 * that; a behaviour written per renderer does it silently.
 *
 * So the check is textual on purpose: it does not ask whether two functions *mean* the same thing,
 * it asks whether someone typed the same body twice in two packages. Bodies are reduced to token
 * shingles, so renaming a variable or reflowing a line does not hide a copy.
 *
 * `similarity-baseline.json` is the ratchet. Every pair listed there is a duplication that exists
 * today with the reason it is still there. The suite fails on a pair that is not listed, and fails
 * again when a listed pair stops matching — a stale entry is a claim about the past, and the only
 * way to know is to run the check.
 *
 * What it does not see, measured rather than assumed:
 *
 * - a copy whose receiver was rewritten — `this.handleMove` becoming `handleMove` on every line
 *   shifts every shingle and drops the score below the threshold;
 * - a body under `MIN_TOKENS`. `isCellRangeStart` is three lines and duplicated across three
 *   renderers; it is beneath this instrument, and lowering the floor makes every accessor match.
 *
 * Both are the cost of a textual check that finishes in seconds and needs no type information. A
 * duplication this misses is still a duplication.
 *
 *   node scripts/audit-cross-adapter-similarity.mjs [--write]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BASELINE = join(root, "packages/widgets/contract-baseline/similarity-baseline.json");
/**
 * A package duplicating *itself* is a different question, and gets its own list.
 *
 * The cross-adapter threshold is calibrated for two renderers writing the same body, which is never
 * legitimate. Inside one package it often is: seven controller wrappers that differ only in the type
 * of the controller they hold *must* resemble each other. So the ceiling is separate, and so is the
 * baseline — one number sliding under the other would hide whichever moved.
 */
const INTERNAL_BASELINE = join(root, "packages/widgets/contract-baseline/similarity-internal-baseline.json");
/** Higher than the cross-adapter one: a typed variant of a shape is not a copy of it. */
const INTERNAL_THRESHOLD = 0.85;

/** The packages that derive from the contract. A copy inside one package is that package's business. */
const ADAPTERS = ["plain", "angular", "lit", "react", "preact", "vue", "svelte", "solid"];

/** Below this a body is boilerplate — a getter, a one-line delegation — and every pair would match. */
const MIN_TOKENS = 40;
/** Shingle width. Wide enough that ordinary syntax does not match, narrow enough to survive an edit. */
const K = 6;
/** Jaccard above this is a copy rather than a coincidence. Calibrated against this repository. */
const THRESHOLD = 0.72;

const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "contract-baseline"]);

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|mts|js|mjs)$/.test(entry) && !/\.(spec|test)\./.test(entry)) out.push(path);
  }
  return out;
}

/** Comments carry the prose rule, not the logic, and two identical comments are a different finding. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** A control structure is not a function, however much its head looks like one to a brace matcher. */
const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "do", "else", "try", "with", "typeof", "new",
]);

const TOKEN = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|=>|===|!==|<=|>=|&&|\|\||\?\?|[{}()[\];,.:?<>=+\-*/%!&|^~]/g;

/**
 * Every function-like body in a file, found by brace matching from a signature.
 *
 * A parser would be more exact and would also have to be kept in step with the syntax every adapter
 * uses; the question here is only "where does a body start and end", which braces answer.
 */
function bodies(source, path) {
  const text = stripComments(source);
  const found = [];
  const SIGNATURE =
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function\s+|(?:public|private|protected)\s+(?:async\s+)?|const\s+|let\s+)?([A-Za-z_$][\w$]*)\s*(?:=\s*(?:async\s*)?)?\([^)]*\)\s*(?::[^{;=]+)?(?:=>\s*)?\{/g;
  let match;
  while ((match = SIGNATURE.exec(text)) !== null) {
    const open = text.indexOf("{", match.index + match[0].length - 1);
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === "{") depth += 1;
      else if (text[i] === "}") {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) continue;
    if (KEYWORDS.has(match[1])) { SIGNATURE.lastIndex = open + 1; continue; }
    const tokens = text.slice(open + 1, end).match(TOKEN) ?? [];
    if (tokens.length >= MIN_TOKENS) {
      found.push({ name: match[1], path, line: text.slice(0, match.index).split("\n").length, tokens });
    }
    SIGNATURE.lastIndex = open + 1;
  }
  return found;
}

function shingles(tokens) {
  const set = new Set();
  for (let i = 0; i + K <= tokens.length; i += 1) set.add(tokens.slice(i, i + K).join(" "));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (large.has(s)) shared += 1;
  return shared / (a.size + b.size - shared);
}

const units = [];
for (const adapter of ADAPTERS) {
  const dir = join(root, "packages", adapter, "src");
  let files;
  try { files = sources(dir); } catch { continue; }
  for (const file of files) {
    for (const body of bodies(readFileSync(file, "utf8"), relative(root, file))) {
      units.push({ ...body, adapter, shingles: shingles(body.tokens) });
    }
  }
}

/** Pairs of bodies that resemble each other, either across packages or within one. */
function comparePairs({ sameAdapter, threshold }) {
  const found = [];
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      if ((units[i].adapter === units[j].adapter) !== sameAdapter) continue;
      const [a, b] = [units[i].shingles.size, units[j].shingles.size];
      if (Math.min(a, b) / Math.max(a, b) < threshold) continue;
      const score = jaccard(units[i].shingles, units[j].shingles);
      if (score < threshold) continue;
      const [left, right] = [units[i], units[j]].sort((x, y) => (x.path + x.name).localeCompare(y.path + y.name));
      found.push({
        id: `${left.adapter}:${left.name}@${left.path.split("/").pop()} ≡ ${right.adapter}:${right.name}@${right.path.split("/").pop()}`,
        score: Number(score.toFixed(3)),
        left: `${left.path}:${left.line}`,
        right: `${right.path}:${right.line}`,
      });
    }
  }
  return found.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

const internal = comparePairs({ sameAdapter: true, threshold: INTERNAL_THRESHOLD });

const pairs = [];
for (let i = 0; i < units.length; i += 1) {
  for (let j = i + 1; j < units.length; j += 1) {
    if (units[i].adapter === units[j].adapter) continue;
    // Sizes that far apart cannot reach the threshold; skipping them is what makes this finish.
    const [a, b] = [units[i].shingles.size, units[j].shingles.size];
    if (Math.min(a, b) / Math.max(a, b) < THRESHOLD) continue;
    const score = jaccard(units[i].shingles, units[j].shingles);
    if (score >= THRESHOLD) {
      const [left, right] = [units[i], units[j]].sort((x, y) => (x.path + x.name).localeCompare(y.path + y.name));
      pairs.push({
        id: `${left.adapter}:${left.name} ≡ ${right.adapter}:${right.name}`,
        score: Number(score.toFixed(3)),
        left: `${left.path}:${left.line}`,
        right: `${right.path}:${right.line}`,
      });
    }
  }
}
pairs.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    threshold: THRESHOLD,
    shingle: K,
    minTokens: MIN_TOKENS,
    note: "Each entry is a duplication that exists today. The list may only get shorter.",
    pairs: pairs.map((p) => ({ ...p, reason: "recorded, not yet accounted for" })),
  }, null, 2)}\n`);
  writeFileSync(INTERNAL_BASELINE, `${JSON.stringify({
    threshold: INTERNAL_THRESHOLD,
    note: "Bodies a package duplicates within itself. A typed variant of one shape is legitimate; a copy is not, and the list may only get shorter.",
    pairs: internal.map((p) => ({ ...p, reason: "recorded, not yet accounted for" })),
  }, null, 2)}\n`);
  console.log(`Similarity baseline written: ${pairs.length} pair(s) over ${units.length} bodies.`);
  console.log(`Internal baseline written: ${internal.length} pair(s) at ${INTERNAL_THRESHOLD}.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); }
catch { console.error("No similarity baseline. Record one with --write, then account for every entry."); process.exit(1); }

const recorded = new Map(baseline.pairs.map((p) => [p.id, p]));
const seen = new Set(pairs.map((p) => p.id));
const appeared = pairs.filter((p) => !recorded.has(p.id));
const resolved = baseline.pairs.filter((p) => !seen.has(p.id));

let internalBaseline;
try { internalBaseline = JSON.parse(readFileSync(INTERNAL_BASELINE, "utf8")); }
catch { internalBaseline = { pairs: [] }; }
const internalRecorded = new Set(internalBaseline.pairs.map((p) => p.id));
const internalSeen = new Set(internal.map((p) => p.id));
const internalAppeared = internal.filter((p) => !internalRecorded.has(p.id));
const internalResolved = internalBaseline.pairs.filter((p) => !internalSeen.has(p.id));

console.log(`Bodies compared: ${units.length} across ${ADAPTERS.length} adapters`);
console.log(`Duplicated pairs: ${pairs.length} (recorded: ${baseline.pairs.length})`);
console.log(`Within one package: ${internal.length} (recorded: ${internalBaseline.pairs.length}, at ${INTERNAL_THRESHOLD})`);

if (internalAppeared.length) {
  console.error("\nA PACKAGE DUPLICATED ITSELF");
  for (const p of internalAppeared) console.error(`- ${p.id}  ${p.score}\n    ${p.left}\n    ${p.right}`);
}
if (internalResolved.length) {
  console.error("\nSTALE INTERNAL ENTRIES — these no longer match");
  for (const p of internalResolved) console.error(`- ${p.id}`);
}

if (appeared.length) {
  console.error("\nCROSS-ADAPTER DUPLICATION — a body was written twice");
  for (const p of appeared) console.error(`- ${p.id}  ${p.score}\n    ${p.left}\n    ${p.right}`);
  console.error("\nMove it into @modyra/core or @modyra/widgets, or record it with a reason:");
  console.error("  node scripts/audit-cross-adapter-similarity.mjs --write");
}
if (resolved.length) {
  console.error("\nSTALE ENTRIES — these no longer match and the list still claims they do");
  for (const p of resolved) console.error(`- ${p.id}`);
  console.error("\nRe-record: node scripts/audit-cross-adapter-similarity.mjs --write");
}
if (appeared.length || resolved.length || internalAppeared.length || internalResolved.length) process.exit(1);
console.log("CROSS-ADAPTER SIMILARITY UNCHANGED");
