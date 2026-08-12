/**
 * A renderer that imports the contract has not necessarily consumed it.
 *
 * `audit-widget-contract-completeness.mjs` asks whether the Angular file *mentions*
 * `MDY_WIDGET_CONTRACTS.<kind>`. A mention is what a renderer that reimplements the whole widget
 * beside it also has. Measured here: Lit's datepicker and daterange are 1283 lines carrying one
 * widgets symbol between them while `createDatepickerFieldController` goes uncalled, and six
 * accessibility projections have no adapter caller at all — every renderer that skips a controller
 * hand-writes the ARIA the projection already computes.
 *
 * So this asks the next question: is it **called**. Import lists are removed before looking, because
 * an unused import is the exact shape of the problem.
 *
 * `adoption-baseline.json` records what each adapter consumes today. Adoption may rise and may not
 * fall, and a kind that gains a controller upstream shows up here as every adapter that has not
 * taken it — which is the work list, not a failure, until the baseline says otherwise.
 *
 *   node scripts/audit-contract-adoption.mjs [--write]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

const root = new URL("..", import.meta.url).pathname;
const BASELINE = join(root, "packages/widgets/contract-baseline/adoption-baseline.json");

/** The renderers. A package that draws no markup has no kind to adopt. */
const RENDERERS = ["plain", "angular", "lit"];

/**
 * What `@modyra/widgets` offers for each kind, stated once.
 *
 * `null` is a finding rather than an omission: the kind is declared in the catalogue and no
 * controller serves it, so every renderer wires the loose transitions itself.
 */
const CONTROLLER = {
  text: "createTextFieldController", email: "createTextFieldController", password: "createTextFieldController",
  textarea: "createTextFieldController", number: "createTextFieldController", slider: "createTextFieldController",
  checkbox: "createBooleanFieldController", toggle: "createBooleanFieldController",
  radio: "createOptionFieldController", segmented: "createOptionFieldController",
  select: "createSelectController",
  multiselect: "createMultiselectFieldController",
  datepicker: "createDatepickerFieldController",
  timepicker: "createTimepickerFieldController",
  daterange: "createDaterangeFieldController",
  colors: null, file: null,
};

const PROJECTION = {
  text: "projectTextFieldA11y", email: "projectTextFieldA11y", password: "projectTextFieldA11y",
  textarea: "projectTextFieldA11y", number: "projectTextFieldA11y", slider: "projectTextFieldA11y",
  checkbox: "projectBooleanFieldA11y", toggle: "projectBooleanFieldA11y",
  radio: "projectOptionFieldA11y", segmented: "projectOptionFieldA11y",
  select: null,
  multiselect: "projectMultiselectFieldA11y",
  datepicker: "projectDatepickerFieldA11y",
  timepicker: "projectTimepickerFieldA11y",
  daterange: "projectDaterangeFieldA11y",
  colors: "projectFieldShellA11y", file: "projectFieldShellA11y",
};

const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "contract-baseline"]);

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|mts|js|mjs|html)$/.test(entry) && !/\.(spec|test)\./.test(entry)) out.push(path);
  }
  return out;
}

/** The file with its comments and its import statements removed: what is left is what runs. */
function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?/gm, " ")
    .replace(/^\s*import\s*\{[\s\S]*?\}\s*from[\s\S]*?;/gm, " ");
}

const called = {};
for (const renderer of RENDERERS) {
  const text = sources(join(root, "packages", renderer, "src"))
    .map((f) => executable(readFileSync(f, "utf8")))
    .join("\n");
  called[renderer] = (symbol) => symbol !== null && new RegExp(`\\b${symbol}\\s*[(<]`).test(text);
}

const rows = [];
for (const kind of MDY_WIDGET_KINDS) {
  for (const renderer of RENDERERS) {
    rows.push({
      id: `${renderer}:${kind}`,
      controller: CONTROLLER[kind] === null ? "none offered" : called[renderer](CONTROLLER[kind]),
      projection: PROJECTION[kind] === null ? "none offered" : called[renderer](PROJECTION[kind]),
    });
  }
}

const adopted = (v) => v === true;
const offered = (v) => v !== "none offered";
const score = {
  controllers: rows.filter((r) => adopted(r.controller)).length,
  controllersOffered: rows.filter((r) => offered(r.controller)).length,
  projections: rows.filter((r) => adopted(r.projection)).length,
  projectionsOffered: rows.filter((r) => offered(r.projection)).length,
};

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify({
    note: "What each renderer consumes today. These numbers may rise and may not fall.",
    score,
    rows: Object.fromEntries(rows.map((r) => [r.id, { controller: r.controller, projection: r.projection }])),
  }, null, 2)}\n`);
  console.log(`Adoption baseline written: controllers ${score.controllers}/${score.controllersOffered}, projections ${score.projections}/${score.projectionsOffered}.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); }
catch { console.error("No adoption baseline. Record one with --write."); process.exit(1); }

console.log(`Controllers consumed: ${score.controllers}/${score.controllersOffered} (was ${baseline.score.controllers}/${baseline.score.controllersOffered})`);
console.log(`Projections consumed: ${score.projections}/${score.projectionsOffered} (was ${baseline.score.projections}/${baseline.score.projectionsOffered})`);

const failures = [];
for (const row of rows) {
  const was = baseline.rows[row.id];
  if (!was) { failures.push(`${row.id}: a kind the baseline does not know — re-record`); continue; }
  if (adopted(was.controller) && !adopted(row.controller)) failures.push(`${row.id}: stopped consuming ${CONTROLLER[row.id.split(":")[1]]}`);
  if (adopted(was.projection) && !adopted(row.projection)) failures.push(`${row.id}: stopped consuming ${PROJECTION[row.id.split(":")[1]]}`);
  if (was.controller === "none offered" && row.controller !== "none offered" && !adopted(row.controller)) {
    failures.push(`${row.id}: a controller now exists for this kind and this renderer does not call it`);
  }
}
for (const id of Object.keys(baseline.rows)) {
  if (!rows.some((r) => r.id === id)) failures.push(`${id}: recorded and no longer produced — re-record`);
}

const unadopted = rows.filter((r) => offered(r.controller) && !adopted(r.controller));
if (unadopted.length) {
  console.log(`\nOffered and not consumed (${unadopted.length}) — the work list, not a failure:`);
  for (const r of unadopted) console.log(`  ${r.id} → ${CONTROLLER[r.id.split(":")[1]]}`);
}

if (failures.length) {
  console.error("\nCONTRACT ADOPTION FELL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("\nCONTRACT ADOPTION HELD");
