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
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { publishedPackageDirs } from "./lib/published-packages.mjs";

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
/**
 * Every published package with TypeScript source, derived rather than listed.
 *
 * The roster named the eight adapters. `@modyra/core` and `@modyra/widgets` were in neither the
 * cross-package comparison nor the within-package one — **590 bodies, more than all eight adapters
 * together, that this gate had never looked at** — and behind them sat two managers sharing bodies
 * word for word. A list that names the packages it watches excuses the ones it does not, silently,
 * and the biggest two were the ones it did not.
 *
 * Derived from what a release publishes, filtered to what this gate can read. The four that join
 * beyond core and widgets — eslint-plugin, standard-schema, styles, zod — add 54 bodies and no
 * findings, which is the point: their cost is nothing and their absence would have been a roster
 * again, chosen by hand and defended by silence.
 */
const ADAPTERS = publishedPackageDirs().filter((name) => {
  const src = join(root, "packages", name, "src");
  if (!existsSync(src)) return false;
  const holdsTypeScript = (dir) => readdirSync(dir, { withFileTypes: true })
    .some((entry) => (entry.isDirectory()
      ? holdsTypeScript(join(dir, entry.name))
      : /\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)));
  return holdsTypeScript(src);
});

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
      // `open`/`end` travel with the body so a later comparison can tell nesting from resemblance.
      found.push({ name: match[1], path, line: text.slice(0, match.index).split("\n").length, tokens, open, end });
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
      // One body inside the other is not a body written twice.
      //
      // Brace matching stops at the outer closing brace, so an enclosing body carries the whole text
      // of the functions declared inside it, and the signature matches those separately. The inner
      // one's shingles are then a subset of the outer's by construction — `createCommandRuntime`
      // against the `execute` it returns measured 157 of 157, an Angular `constructor` against the
      // `effect` that is its whole body the same way. Reported as duplication it sends a reader to
      // deduplicate a function from itself, and six such pairs sat in the recorded baseline being
      // excused as known duplication.
      //
      // Recognised rather than removed: taking the nested text out of the enclosing body would
      // shrink the shell below the floor and lose the real pairs that live in the combination — two
      // were measured disappearing that way. The bodies stay whole; only the pair is skipped.
      if (units[i].path === units[j].path
        && ((units[i].open < units[j].open && units[i].end > units[j].end)
          || (units[j].open < units[i].open && units[j].end > units[i].end))) continue;
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

/**
 * A recorded pair keeps the reason someone wrote for it.
 *
 * `--write` stamped every entry with "recorded, not yet accounted for", including the ones an author
 * had already explained — one entry carried a real argument about eleven hooks mirroring one
 * structure on purpose, and the next regeneration would have replaced it with the placeholder. A
 * tool that erases the reason for an exemption leaves the exemption and destroys what justified it,
 * which is the opposite of what recording is for.
 *
 * The reason is keyed by the pair's id, so it follows the pair and disappears with it.
 */
const withKeptReason = (path) => {
  // Read here rather than taken from the comparison below: `--write` runs before the baselines are
  // loaded for comparing, so the reasons have to be fetched from disk on their own.
  let held;
  try { held = JSON.parse(readFileSync(path, "utf8")); } catch { held = undefined; }
  const reasons = new Map((held?.pairs ?? []).map((pair) => [pair.id, pair.reason]));
  return (pair) => {
    const kept = reasons.get(pair.id);
    return {
      ...pair,
      reason: kept === undefined || kept === "recorded, not yet accounted for"
        ? "recorded, not yet accounted for"
        : kept,
    };
  };
};

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    threshold: THRESHOLD,
    shingle: K,
    minTokens: MIN_TOKENS,
    note: "Each entry is a pair this gate found and someone accepted. The list may only get shorter, "
      + "and a reason written here survives the next regeneration.",
    pairs: pairs.map(withKeptReason(BASELINE)),
  }, null, 2)}\n`);
  writeFileSync(INTERNAL_BASELINE, `${JSON.stringify({
    threshold: INTERNAL_THRESHOLD,
    note: "Bodies a package duplicates within itself. A typed variant of one shape is legitimate; a copy is not, and the list may only get shorter.",
    pairs: internal.map(withKeptReason(INTERNAL_BASELINE)),
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
  // These findings had no remedy printed at all, which was survivable while the gate watched only
  // adapters and became a hole the moment it watched `core` and `widgets`: "move it into core" is
  // the advice above, and for a pair already inside core it is impossible. There is nowhere further
  // in to move it — the pair is a helper waiting to be extracted where it already lives.
  console.error("\nExtract a helper where it already lives: a pair inside one package has nowhere");
  console.error("further in to move to, so the remedy above does not apply. Or record it with a");
  console.error("reason:  node scripts/audit-cross-adapter-similarity.mjs --write");
}
if (internalResolved.length) {
  console.error("\nSTALE INTERNAL ENTRIES — these no longer match");
  for (const p of internalResolved) console.error(`- ${p.id}`);
}

if (appeared.length) {
  console.error("\nCROSS-ADAPTER DUPLICATION — a body was written twice");
  for (const p of appeared) console.error(`- ${p.id}  ${p.score}\n    ${p.left}\n    ${p.right}`);
  // Two packages sharing a body have somewhere to put it: the contract layer both depend on. This
  // list holds only those — a same-package pair is skipped where the pairs are built — so the
  // remedy here is always the same one, and the other perimeter states its own below.
  console.error("\nMove it into @modyra/core or @modyra/widgets, which both depend on, or record it");
  console.error("with a reason:  node scripts/audit-cross-adapter-similarity.mjs --write");
}
if (resolved.length) {
  console.error("\nSTALE ENTRIES — these no longer match and the list still claims they do");
  for (const p of resolved) console.error(`- ${p.id}`);
  console.error("\nRe-record: node scripts/audit-cross-adapter-similarity.mjs --write");
}
if (appeared.length || resolved.length || internalAppeared.length || internalResolved.length) process.exit(1);
console.log("CROSS-ADAPTER SIMILARITY UNCHANGED");
