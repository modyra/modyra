/**
 * Source-level record of the semantic surface the Angular renderers reference.
 *
 * Scans renderer source for class names, ARIA attribute names and selectors and compares the result
 * against a stored manifest, so a change to the surface has to be reviewed rather than merged
 * unnoticed. It reads text, never a rendered document: a token appearing here means a file mentions
 * it, not that an element carries it.
 *
 * What the DOM actually renders is checked by `renderers/dom-contract.spec.ts` and by the three
 * state matrices, which mount the widgets and inspect real elements. Attributes supplied at runtime
 * by a projection are invisible to this scan and visible to those.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MDY_CLASS_DOORS, MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_CONTRACTS } from "../packages/widgets/dist/index.js";
import { classesFromDoors, perimeterLine } from "./lib/class-doors-in-source.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = join(root, "packages/angular/src/lib");
const baselinePath = join(root, "packages/angular/contract-baseline/angular-ui.json");
const check = process.argv.includes("--check");
const rendererRoots = [join(sourceRoot, "renderers"), join(sourceRoot, "control")];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    // `.html` alongside `.ts`: a renderer that keeps its markup in a `templateUrl` is invisible to
    // a `.ts`-only walk, which would leave its whole ARIA surface unguarded. The baseline records
    // each file under its own path, so the extension says which kind of file a diff grew.
    else if ((entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) || entry.endsWith(".html")) files.push(full);
  }
}
rendererRoots.forEach(walk);
const classes = new Set();
const aria = new Set();
const selectors = new Set();
const rendererModifiers = new Set();
// Door calls this scan could not answer from text. A gate that stays silent about them reports their
// classes as absent, which is the failure the doors exist to end; a perimeter is a fact a reader can
// act on, a silence is one they cannot see.
const perimeter = new Map();
const perFile = {};
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  // Classes a renderer takes from the contract instead of spelling out. The grep below sees only
  // literals, so a renderer that asks the contract for a name reads to it as one that stopped
  // drawing the part — and the golden would lose the very classes it exists to guard. The doors are
  // declared in the contract and read through the one reader every scanning gate shares, so a door
  // added to the contract is seen by all of them at once rather than taught to each separately.
  const fromDoors = classesFromDoors(source, MDY_CLASS_DOORS);
  const fromContract = [...fromDoors.classes];
  for (const entry of fromDoors.perimeter) {
    const seen = perimeter.get(entry.door) ?? { door: entry.door, reason: entry.reason, calls: 0 };
    seen.calls += entry.calls;
    perimeter.set(entry.door, seen);
  }
  // A part's classes reached through the component's own `widgetContract` field. This is a property
  // access, not a call, so no door describes it and the shared reader does not see it: a renderer
  // that stops restating a name the catalogue holds would read as one that stopped drawing the part.
  const kindMatch = /widgetKind\s*=\s*["'`]([a-z-]+)["'`]/.exec(source);
  if (kindMatch) {
    const parts = MDY_WIDGET_CONTRACTS[kindMatch[1]]?.parts;
    if (parts) {
      for (const [, part] of source.matchAll(/widgetContract\.parts\.([A-Za-z0-9_]+)\.classes/g)) {
        for (const name of parts[part]?.classes ?? []) fromContract.push(name);
      }
    }
  }
  // `\b` treats the `y` in `--mdy-slider-fill-pct` as a word boundary, so a custom property lands in
  // a manifest of *classes* looking exactly like one. Four did. The lookbehind drops them: a name
  // preceded by a hyphen is the tail of `--mdy-…` or of `data-mdy-…`, and neither is a class.
  const fileClasses = [...[...source.matchAll(/(?<![-\w])mdy-[a-z0-9_-]+/g)].map((m) => m[0]), ...fromContract].sort();
  const fileAria = [...source.matchAll(/\baria-[a-z-]+/g)].map((m) => m[0]).sort();
  const fileSelectors = [...source.matchAll(/selector:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort();
  fileClasses.forEach((value) => classes.add(value));
  fileAria.forEach((value) => aria.add(value));
  fileSelectors.forEach((value) => selectors.add(value));
  fileClasses.filter((value) => value.startsWith("mdy-renderer--")).forEach((value) => rendererModifiers.add(value));
  if (fileClasses.length || fileAria.length || fileSelectors.length) {
    perFile[relative(root, file).split("\\").join("/")] = {
      classes: [...new Set(fileClasses)], aria: [...new Set(fileAria)], selectors: [...new Set(fileSelectors)],
    };
  }
}
// Every `cls.x` a template reads must be a key the component declares.
//
// The `cls` record is typed as the wide `Readonly<Record<string, string>>` so that a component's
// declared surface does not change each time its kind gains a part. That width is what makes this
// check necessary: an unknown key is no longer a compiler error, it is `undefined` reaching the
// page as the literal text `class="undefined"`. Caught here it is a name and a list of what the
// component has, before anything ships.
const clsProblems = [];
for (const file of files) {
  if (!file.endsWith(".ts")) continue;
  const source = readFileSync(file, "utf8");
  const declaration = /protected readonly cls(?:\s*:[^=]+)?=\s*\{([\s\S]*?)\n\s*\}\s*(?:as const\s*)?;/.exec(source);
  if (!declaration) continue;
  const declared = new Set(
    [...declaration[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]),
  );
  // A template kept beside its component in a `.html` reads the same record.
  const html = file.replace(/\.ts$/, ".html");
  let markup = "";
  try { markup = readFileSync(html, "utf8"); } catch { markup = ""; }
  const used = new Set([...`${source}\n${markup}`.matchAll(/\bcls\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  for (const name of [...used].sort()) {
    if (declared.has(name)) continue;
    clsProblems.push(
      `${relative(root, file).split("\\").join("/")}: cls.${name} is read but not declared. `
      + `Declared: ${[...declared].sort().join(", ") || "none"}.`,
    );
  }
}
if (clsProblems.length > 0) {
  console.error(`Class record keys read but not declared (${clsProblems.length}):`);
  for (const line of clsProblems) console.error(`  ${line}`);
  process.exit(1);
}

const perimeterText = perimeterLine([...perimeter.values()]);
if (perimeterText) console.log(perimeterText);
const manifest = {
  schemaVersion: 1,
  // The contract this snapshot was taken against.
  //
  // Without it the audit could only notice what *Angular* changed, never what the **contract** gained:
  // it compares Angular's surface to a record of Angular's own past surface, so a part newly declared
  // and drawn by nobody leaves both sides equal and the gate green. That is how `dialUnavailable`
  // shipped declared and undrawn while plain's and lit's audits — which fail on a version they do not
  // recognise — each demanded a re-read.
  //
  // The honest requirement for a snapshot audit is not the version pin those two use, because this one
  // is not reading the contract. It is that **the snapshot may not predate the contract it is offered
  // as evidence for**: when the version moves, this record has to be taken again and looked at. That is
  // a weaker guarantee, and it should be — it is answering a weaker question. What holds Angular to
  // drawing every declared part is `renderers/open-coverage.spec.ts`.
  contractVersion: MDY_WIDGET_CONTRACT_VERSION,
  source: "packages/angular/src/lib/{control,renderers}",
  note: "Semantic surface referenced by Angular renderer source. Text scan, not rendered DOM — see dom-contract.spec.ts and the state matrices for what the widgets actually render.",
  selectors: [...selectors].sort(),
  rendererModifiers: [...rendererModifiers].sort(),
  classes: [...classes].sort(),
  aria: [...aria].sort(),
  files: perFile,
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  const expected = readFileSync(baselinePath, "utf8");
  // Said separately from the diff below, because the two mean different things to whoever reads the
  // failure: a surface that moved is a change to review, and a stale version is a record that can no
  // longer be trusted to be about the current contract at all.
  let recorded;
  try {
    recorded = JSON.parse(expected).contractVersion;
  } catch {
    recorded = undefined;
  }
  if (recorded !== MDY_WIDGET_CONTRACT_VERSION) {
    console.error(
      `Angular UI baseline was taken against widget contract version ${recorded ?? "(none recorded)"}, ` +
      `and the contract is now at ${MDY_WIDGET_CONTRACT_VERSION}.`,
    );
    console.error(
      "The snapshot cannot say whether Angular draws what the contract gained — it only compares Angular " +
      "to Angular. Re-take it and review what moved:",
    );
    console.error("Run: node scripts/audit-angular-widget-contract.mjs --write");
    process.exit(1);
  }
  if (expected !== serialized) {
    console.error("Angular UI contract differs from packages/angular/contract-baseline/angular-ui.json");
    console.error("Run: node scripts/audit-angular-widget-contract.mjs --write and review the semantic UI change.");
    process.exit(1);
  }
  console.log(
    `Angular UI source surface unchanged: ${manifest.classes.length} classes, ` +
    `${manifest.aria.length} ARIA attribute names, ${manifest.selectors.length} selectors referenced. ` +
    "Rendered DOM is checked by dom-contract.spec.ts and the state matrices.",
  );
} else {
  writeFileSync(baselinePath, serialized);
  console.log(`Wrote ${relative(root, baselinePath)}`);
}
