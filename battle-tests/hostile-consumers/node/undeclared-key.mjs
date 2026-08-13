/**
 * The smallest consumer that falsifies it.
 *
 * Three lines of public API. A key the schema never declared enters through `patch()` — the call a
 * consumer makes with a server response or a restored draft — and the form can no longer answer what
 * it would submit.
 *
 * Run: node battle-tests/hostile-consumers/node/undeclared-key.mjs
 */
import { createForm, field } from "@modyra/core";

const form = createForm({ name: field("") });
form.patch({ evil: 1 });

console.log("fieldNames:", form.fieldNames());
console.log("getValue:  ", JSON.stringify(form.getValue()));
try {
  console.log("submitValue:", JSON.stringify(form.submitValue()));
} catch (error) {
  console.log("submitValue: THREW", error.message);
  process.exitCode = 1;
}
