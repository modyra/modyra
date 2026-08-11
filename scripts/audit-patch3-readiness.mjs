/**
 * Readiness gate for the Angular renderers, measured from source.
 *
 * Every count here answers "does this renderer's source reference the contract token it should" —
 * it greps files and never mounts a component. `sourceAriaEvidence` says a renderer names the ARIA
 * it is responsible for, or names the directive that supplies it; it does not say the attribute
 * reaches the DOM.
 *
 * That is checked by `renderers/dom-contract.spec.ts` and by the three adapters' state matrices,
 * which mount the widgets and read real elements.
 */
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
const fixturePath = resolve(root, "packages/angular/contract-baseline/angular-dom/source-parity.json");
const fixtureFailures = [];
let parityFixtures = 0;
if (existsSync(fixturePath)) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  for (const [kind, evidence] of Object.entries(fixture.controls)) {
    const source = readFileSync(resolve(rendererRoot, evidence.renderer), "utf8");
    // Same rule as the projection evidence below: binding the part is how a renderer consumes the
    // ARIA the part supplies, and repeating the attribute afterwards is what the part prevents.
    const suppliedByPart = source.includes("[mdyPart]")
      ? ["aria-invalid", "aria-required", "aria-disabled", "aria-describedby"]
      : [];
    const missing = evidence.tokens.filter(
      (token) => !source.includes(token) && !suppliedByPart.includes(token),
    );
    if (missing.length === 0) parityFixtures++;
    else fixtureFailures.push({ kind, missing });
  }
}
const projectionPath = resolve(root, "packages/angular/contract-baseline/angular-dom/contract-projection.json");
const projectionFailures = [];
let contractPartProjections = 0;
let ariaProjections = 0;
if (existsSync(projectionPath)) {
  const projection = JSON.parse(readFileSync(projectionPath, "utf8"));
  for (const [kind, evidence] of Object.entries(projection.controls)) {
    const source = readFileSync(resolve(rendererRoot, evidence.renderer), "utf8");
    // A renderer satisfies an ARIA token by spelling it **or** by binding the part that supplies it —
    // which is what the header of this file has always said, and what the implementation did not do.
    // `[mdyPart]` carries the shell projection's `aria-invalid`, `aria-required`, `aria-disabled`
    // and `aria-describedby`, so a renderer that binds it and then repeats them would be the thing
    // the part exists to prevent.
    const suppliedByPart = source.includes("[mdyPart]")
      ? ["aria-invalid", "aria-required", "aria-disabled", "aria-describedby"]
      : [];
    const missingParts = evidence.contractProjection.parts.filter((token) => !source.includes(token));
    const missingAria = evidence.contractProjection.aria.filter(
      (token) => !source.includes(token) && !suppliedByPart.includes(token),
    );
    if (missingParts.length === 0) contractPartProjections++;
    if (missingAria.length === 0) ariaProjections++;
    if (missingParts.length || missingAria.length) projectionFailures.push({ kind, missingParts, missingAria });
  }
}
const blockers = [];
if (behaviorContractConsumers !== Object.keys(renderers).length) blockers.push("Angular behavior evidence is incomplete");
if (!sharedOverlayPlacement || !sharedOverlayLifecycle) blockers.push("overlay policy remains framework-local");
if (parityFixtures !== Object.keys(renderers).length) blockers.push(`normalized per-control source parity fixtures cover ${parityFixtures}/${Object.keys(renderers).length} renderers`);
if (contractPartProjections !== Object.keys(renderers).length || ariaProjections !== Object.keys(renderers).length) blockers.push("some renderer source does not reference the contract parts and ARIA it owns");
const result = {
  status: blockers.length === 0 ? "PATCH 3 READY" : "PATCH 3 BLOCKED",
  renderers: Object.keys(renderers).length,
  rootContractConsumers,
  behaviorContractConsumers,
  sharedOverlayPlacement,
  sharedOverlayLifecycle,
  parityFixtures,
  sourcePartEvidence: contractPartProjections,
  sourceAriaEvidence: ariaProjections,
  sourceEvidenceGaps: projectionFailures,
  missingBehavior,
  fixtureFailures,
  blockers,
};
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--require-ready") && result.status !== "PATCH 3 READY") process.exit(1);
