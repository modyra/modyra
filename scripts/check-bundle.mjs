/**
 * Tree-shaking bundle check.
 * Run after `ng build bundle-test`: asserts that importing only the typed
 * core (mdyForm/field) keeps renderers, devtools, wizard and dynamic forms
 * out of the production bundle, and prints the total JS size.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist/bundle-test/browser";
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
// 120 -> 122 (2026-07-20, FASE A field arrays): MdyTypedFormBase always links
// the array-manager wiring (constructor bookkeeping, handle-tree branch,
// array-level validator composition) even for schemas with no array() field
// — it isn't tree-shakeable away, unlike a renderer/control. Real total after
// the feature: 120.6 KB; budget kept tight just above it.
// 122 -> 125 (2026-07-20, injection prevention): the engine statically wires
// the security module (sanitizer profiles, draft-shape/server-path checks)
// at the value-write choke point — always linked by design, like the
// array-manager. Real total after the feature: 123.7 KB.
// 125 -> 129 (2026-07-22, reactivity-adapter-api plan M1-M8 + construction/
// activation split): MdyFormEngine/MdyTypedFormBase gained real methods
// every consumer links regardless of use — same non-tree-shakeable-class
// shape as the array-manager/security additions above, not accidental
// bloat: MdyReactiveScope + activate()/deactivate()/mutate(), the typed
// error classes (reactivity-errors.ts, used by the Angular adapter itself
// for its typed-error-instead-of-silent-no-op fix), and reactive-owner.ts's
// WeakMap-based handle-ownership registry. Real total after the change:
// 127.8 KB; budget kept tight just above it, same pattern as before.
const BUDGET_KB = 129;

let total = 0;
let text = "";
for (const f of files) {
  const body = readFileSync(join(dir, f), "utf8");
  total += body.length;
  text += body;
}

// Selector/class strings that survive minification if the code is bundled.
const forbidden = [
  "mdy-control-select",
  "mdy-control-datepicker",
  "mdy-control-timepicker",
  "mdy-control-colors",
  "mdy-forms-devtools",
  "mdy-form-wizard",
  "mdy-dynamic-form",
  "mdy-control-file",
];

let failed = false;
for (const marker of forbidden) {
  const present = text.includes(marker);
  if (present) failed = true;
  console.log(`${marker}: ${present ? "PRESENT ✗" : "absent ✓"}`);
}
console.log(`total JS: ${(total / 1024).toFixed(1)} KB`);
if (total > BUDGET_KB * 1024) {
  console.error(
    `Bundle size regression: total JS ${(total / 1024).toFixed(1)} KB exceeds ${BUDGET_KB} KB budget.`,
  );
  process.exit(1);
}
if (failed) {
  console.error("Tree-shaking regression: unused features leaked into the core-only bundle.");
  process.exit(1);
}
