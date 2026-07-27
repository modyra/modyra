import { readFileSync } from "node:fs";
const matrix = JSON.parse(readFileSync(new URL("../packages/widgets/contract-baseline/widget-completeness.json", import.meta.url), "utf8"));
const angular = JSON.parse(readFileSync(new URL("../packages/widgets/contract-baseline/angular-ui.json", import.meta.url), "utf8"));
const required = ["controller", "typedView", "structuredAnatomy", "parts", "aria", "keyboard", "focus", "widgetsTests", "angularConsumer"];
const failures = [];
const owned = new Set();
for (const [kind, entry] of Object.entries(matrix.widgets)) {
  for (const key of required) if (entry[key] !== true) failures.push(`${kind}: ${key} is not complete`);
  for (const name of entry.classes) owned.add(name);
}
for (const name of angular.classes) if (!owned.has(name)) failures.push(`unowned Angular class: ${name}`);
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Widget completeness verified: ${Object.keys(matrix.widgets).length} controls, ${owned.size} canonical classes.`);
