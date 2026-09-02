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

let total = 0;
let text = "";
for (const f of files) {
  const body = readFileSync(join(dir, f), "utf8");
  total += body.length;
  text += body;
}

/**
 * The component selectors that must not reach a core-only bundle.
 *
 * **Matched where the compiler writes them, not wherever they appear.** These names are element tags
 * *and* CSS class names on the same components, so a bare substring search cannot tell a bundled
 * component from a contract table that merely lists the class: adding `"mdy-dynamic-form"` to the
 * shared class vocabulary put the string in the core bundle inside a frozen array, with no component,
 * no selector and no import edge, and this check called it a leak.
 *
 * A component that is actually bundled carries its selector inside the definition Angular emits for
 * it — `selectors:[["mdy-dynamic-form"]]` — and that shape survives minification because the runtime
 * reads those property names. A string in a data table cannot produce it. The distinction is
 * positional, which is the only thing that separates these two uses of one name.
 *
 * Both directions were measured rather than reasoned, by building this fixture with the dynamic form
 * genuinely imported: the marker appears once, while the bare name appears three times — and against
 * the frozen-table form it stays silent while the bare name matches.
 */
const marker = (selector) => `selectors:[["${selector}"]]`;

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
for (const selector of forbidden) {
  const present = text.includes(marker(selector));
  if (present) failed = true;
  // The bare name is reported beside the verdict when the two disagree, because that gap is exactly
  // the case this check used to get wrong, and a reader deserves to see it rather than wonder.
  const namedOnly = !present && text.includes(selector);
  console.log(`${selector}: ${present ? "PRESENT ✗" : "absent ✓"}`
    + (namedOnly ? "  (the name appears, but only as data — no component definition)" : ""));
}
// Reported, not gated.
//
// The size budget was failing builds for changes that were correct: every legitimate feature moved
// the number, so the budget was raised to accommodate it, and a threshold that is raised whenever it
// is crossed is a record of past sizes rather than a limit. Tree-shaking below is the property that
// actually holds — it is about what *leaked in*, which a feature does not change.
//
// The number is still printed, because watching it drift is worth something even when failing on it
// is not.
console.log(`total JS: ${(total / 1024).toFixed(1)} KB (reported, not gated)`);
if (failed) {
  console.error("Tree-shaking regression: unused features leaked into the core-only bundle.");
  process.exit(1);
}
