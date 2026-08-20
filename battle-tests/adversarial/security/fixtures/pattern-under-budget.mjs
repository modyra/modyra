/**
 * One pattern, one input, in a process the parent can kill.
 *
 * A pattern that backtracks exponentially does not return, so the budget cannot be enforced from
 * inside the thing being budgeted: the parent spawns this, waits, and kills it. Nothing here depends
 * on a `timeout` binary, which is not present on every machine this suite runs on.
 *
 * argv: <pattern> <input>. One JSON line on stdout, then exit.
 */

import { applyFlatValidators, buildFlatFormSchema, createForm, parseDynamicForm } from "@modyra/core";

const [pattern, input] = process.argv.slice(2);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (what) => process.stdout.write(`${JSON.stringify(what)}\n`);

const document = {
  version: 2,
  fields: [{ name: "v", kind: "text", label: "V", validators: { pattern } }],
  layout: [],
};

const parsed = parseDynamicForm(document, { mode: "lenient" });
const refusals = parsed.diagnostics.filter((each) => /PATTERN/.test(each.code)).map((each) => each.code);
if (refusals.length > 0 || parsed.acceptedCount === 0) {
  say({ refused: refusals.length > 0 ? refusals : ["dropped"] });
  process.exit(0);
}

const form = createForm(buildFlatFormSchema(parsed.fields, parsed.collections), { devWarnings: false });
// The document's own rules are a second call, by design — without it the pattern is never applied and
// every measurement below would be of a rule nobody ran.
applyFlatValidators(form, parsed.fields);
await wait(20);

form.setValue({ v: " -definitely-not-matching" });
form.markAllTouched();
await wait(30);
const live = !form.getField("v")().valid();

const started = process.hrtime.bigint();
form.setValue({ v: input });
await wait(0);
form.getField("v")().valid();
say({ ms: Number(process.hrtime.bigint() - started) / 1e6, live });
form.destroy();
process.exit(0);
