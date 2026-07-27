import { readFileSync } from "node:fs";
const angular = readFileSync(new URL("../packages/angular/src/lib/renderers/select/select-renderer.component.ts", import.meta.url), "utf8");
const allRenderers = [
  "checkbox/checkbox-renderer.component.ts", "colors/colors-renderer.component.ts", "datepicker/datepicker.component.ts",
  "datepicker/daterange-renderer.component.ts", "file/file-renderer.component.ts", "multiselect/multiselect-renderer.component.ts",
  "number/number-renderer.component.ts", "radio/radio-group-renderer.component.ts", "segmented-button/segmented-button-renderer.component.ts",
  "select/select-renderer.component.ts", "slider/slider-renderer.component.ts", "text/text-renderer.component.ts",
  "textarea/textarea-renderer.component.ts", "timepicker/timepicker-renderer.component.ts", "toggle/toggle-renderer.component.ts",
];
let rootConsumers = 0; let behaviorConsumers = 0;
for (const path of allRenderers) {
  const source = readFileSync(new URL(`../packages/angular/src/lib/renderers/${path}`, import.meta.url), "utf8");
  if (source.includes("widgetHasRootClass")) rootConsumers++;
  if (/\.dispatch\(|MdyWidgetRuntime/.test(source)) behaviorConsumers++;
}
const result = { status: behaviorConsumers === allRenderers.length ? "PATCH 3 READY" : "PATCH 3 BLOCKED", renderers: allRenderers.length, rootContractConsumers: rootConsumers, behaviorContractConsumers: behaviorConsumers, blockers: [] };
if (result.status !== "PATCH 3 READY") result.blockers.push("Angular behavior is not yet controller-driven for every renderer", "normalized per-control DOM parity fixtures are not yet present", "overlay placement remains framework-local");
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--require-ready") && result.status !== "PATCH 3 READY") process.exit(1);
