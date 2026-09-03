import { readFileSync } from "node:fs";
import { MDY_DYNAMIC_FIELD_KINDS } from "../packages/core/dist/index.js";
import { MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";
// Comments removed: `case "select"` written in a doc block registers no renderer, and this whole
// audit is `includes`.
const source = readFileSync("packages/plain/src/fields/index.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");
const registered = MDY_WIDGET_KINDS.filter((kind) => source.includes(`case "${kind}"`));
const missing = MDY_WIDGET_KINDS.filter((kind) => !registered.includes(kind));
const coreMissing = MDY_WIDGET_KINDS.filter((kind) => !MDY_DYNAMIC_FIELD_KINDS.includes(kind));
if (missing.length || coreMissing.length) { console.error({ missing, coreMissing }); process.exit(1); }
console.log("PLAIN FULL CATALOG COMPLETE");
console.log(`Widgets catalog kinds: ${MDY_WIDGET_KINDS.length}`);
console.log(`Core dynamic kinds: ${MDY_DYNAMIC_FIELD_KINDS.length}`);
console.log(`Plain registered kinds: ${registered.length}`);
// Derived rather than written: a report line that states a number it did not compute says the same
// thing on the day it stops being true.
console.log(`Missing kinds: ${missing.length}`);
console.log(`Kinds no core dynamic form can carry: ${coreMissing.length}`);
