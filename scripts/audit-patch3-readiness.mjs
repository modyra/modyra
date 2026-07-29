import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const rendererRoot = resolve(root, "packages/angular/src/lib/renderers");
const renderers = {
  checkbox: "checkbox/checkbox-renderer.component.ts",
  colors: "colors/colors-renderer.component.ts",
  datepicker: "datepicker/datepicker.component.ts",
  daterange: "datepicker/daterange-renderer.component.ts",
  file: "file/file-renderer.component.ts",
  multiselect: "multiselect/multiselect-renderer.component.ts",
  number: "number/number-renderer.component.ts",
  radio: "radio/radio-group-renderer.component.ts",
  segmented: "segmented-button/segmented-button-renderer.component.ts",
  select: "select/select-renderer.component.ts",
  slider: "slider/slider-renderer.component.ts",
  text: "text/text-renderer.component.ts",
  textarea: "textarea/textarea-renderer.component.ts",
  timepicker: "timepicker/timepicker-renderer.component.ts",
  toggle: "toggle/toggle-renderer.component.ts",
};
const behaviorEvidence = {
  checkbox: ["dispatchValueIntent", "dispatchValueBlur"],
  colors: ["colorValueTransition", "dispatchValueIntent"],
  datepicker: ["dateValueTransition", "dateDraftTransition"],
  daterange: ["dateRangeValueTransition", "dateRangeDraftTransition"],
  file: ["fileSelectionTransition", "dispatchValueIntent"],
  multiselect: ["multiselectValueTransition", "multiselectOverlayAction"],
  number: ["dispatchValueIntent", "dispatchValueBlur"],
  radio: ["dispatchValueIntent", "dispatchValueBlur"],
  segmented: ["optionNavigationIndex", "dispatchValueIntent"],
  select: ["MdyWidgetRuntime", "selectKeyboardAction"],
  slider: ["dispatchValueIntent", "dispatchValueBlur"],
  text: ["dispatchValueIntent", "dispatchValueBlur"],
  textarea: ["dispatchValueIntent", "dispatchValueBlur"],
  timepicker: ["timeDraftTransition", "timeInputTransition"],
  toggle: ["dispatchValueIntent", "dispatchValueBlur"],
};
const scalarBase = readFileSync(resolve(root, "packages/angular/src/lib/control/control.directive.ts"), "utf8");
let rootContractConsumers = 0;
let behaviorContractConsumers = 0;
const missingBehavior = [];
for (const [kind, relative] of Object.entries(renderers)) {
  const source = readFileSync(resolve(rendererRoot, relative), "utf8");
  if (source.includes("widgetHasRootClass")) rootContractConsumers++;
  const evidenceSource = kind === "text" ? `${source}\n${scalarBase}` : source;
  const missing = behaviorEvidence[kind].filter((token) => !evidenceSource.includes(token));
  if (missing.length === 0) behaviorContractConsumers++;
  else missingBehavior.push({ kind, missing });
}
const overlaySource = readFileSync(resolve(root, "packages/angular/src/lib/core/overlay-control.directive.ts"), "utf8");
// `anchorOverlay` is how a renderer consumes the shared placement policy now: it takes the measured
// geometry and returns the decision *and* the coordinates. `decideOverlayPlacement` is the policy it
// calls, and a renderer reaching for it directly is still consuming the contract — either satisfies
// this. What must never pass is a renderer computing a placement of its own.
const sharedOverlayPlacement = overlaySource.includes("anchorOverlay") || overlaySource.includes("decideOverlayPlacement");
const sharedOverlayLifecycle = overlaySource.includes("overlayLifecycleTransition");
const fixturePath = resolve(root, "packages/widgets/contract-baseline/angular-dom/source-parity.json");
const fixtureFailures = [];
let parityFixtures = 0;
if (existsSync(fixturePath)) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  for (const [kind, evidence] of Object.entries(fixture.controls)) {
    const source = readFileSync(resolve(rendererRoot, evidence.renderer), "utf8");
    const missing = evidence.tokens.filter((token) => !source.includes(token));
    if (missing.length === 0) parityFixtures++;
    else fixtureFailures.push({ kind, missing });
  }
}
const projectionPath = resolve(root, "packages/widgets/contract-baseline/angular-dom/contract-projection.json");
const projectionFailures = [];
let contractPartProjections = 0;
let ariaProjections = 0;
if (existsSync(projectionPath)) {
  const projection = JSON.parse(readFileSync(projectionPath, "utf8"));
  for (const [kind, evidence] of Object.entries(projection.controls)) {
    const source = readFileSync(resolve(rendererRoot, evidence.renderer), "utf8");
    const missingParts = evidence.contractProjection.parts.filter((token) => !source.includes(token));
    const missingAria = evidence.contractProjection.aria.filter((token) => !source.includes(token));
    if (missingParts.length === 0) contractPartProjections++;
    if (missingAria.length === 0) ariaProjections++;
    if (missingParts.length || missingAria.length) projectionFailures.push({ kind, missingParts, missingAria });
  }
}
const blockers = [];
if (behaviorContractConsumers !== Object.keys(renderers).length) blockers.push("Angular behavior evidence is incomplete");
if (!sharedOverlayPlacement || !sharedOverlayLifecycle) blockers.push("overlay policy remains framework-local");
if (parityFixtures !== Object.keys(renderers).length) blockers.push(`normalized per-control DOM parity fixtures cover ${parityFixtures}/${Object.keys(renderers).length} renderers`);
if (contractPartProjections !== Object.keys(renderers).length || ariaProjections !== Object.keys(renderers).length) blockers.push("contract parts and ARIA are not yet projected by every renderer");
const result = {
  status: blockers.length === 0 ? "PATCH 3 READY" : "PATCH 3 BLOCKED",
  renderers: Object.keys(renderers).length,
  rootContractConsumers,
  behaviorContractConsumers,
  sharedOverlayPlacement,
  sharedOverlayLifecycle,
  parityFixtures,
  contractPartProjections,
  ariaProjections,
  projectionFailures,
  missingBehavior,
  fixtureFailures,
  blockers,
};
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--require-ready") && result.status !== "PATCH 3 READY") process.exit(1);
