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
import { MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_CONTRACTS, popupPlacementClass } from "../packages/widgets/dist/index.js";

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
const perFile = {};
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  // Classes a renderer takes from the contract instead of spelling out. The grep below only sees
  // literals, so a renderer that moved onto `multiselectChipClasses` would look like one that
  // stopped emitting the chip variants — and the golden would quietly lose the very classes it
  // exists to protect. What the contract guarantees is asserted in `packages/widgets/test`.
  const fromContract = source.includes("multiselectChipClasses")
    // The option variants only: `mdy-chip--value` is the taken-value chip, which a renderer emits
    // by asking for role "value" — this one does not.
    ? ["mdy-chip", "mdy-chip--centered", "mdy-chip--counter", "mdy-chip--selected"]
    : [];
  // Same reason, for a popup's placement. A renderer that names it through the catalog reads to the
  // grep as one that stopped emitting `--above`/`--overlay` — the classes are still on the element at
  // runtime, computed rather than spelled. Ask the contract what the call produces for the kind the
  // renderer passes, so the golden keeps guarding the names it exists to guard.
  for (const [, kind] of source.matchAll(/popupPlacementClass\(\s*["'`]([a-z-]+)["'`]/g)) {
    if (!MDY_WIDGET_CONTRACTS[kind]?.parts.popup) continue;
    for (const placement of ["above", "overlay"]) {
      const name = popupPlacementClass(kind, placement);
      if (name) fromContract.push(name);
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
