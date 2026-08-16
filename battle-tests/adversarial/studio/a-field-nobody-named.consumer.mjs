/**
 * Runs inside a packed consumer, not in the suite.
 *
 * A Studio project is a file: saved, committed, hand-edited, written by an older editor and read by a
 * newer one. `loadProject` is the door it comes through. This script takes one well-formed project
 * and the same project with a single thing missing, and reports what each door said and what the core
 * target emitted — as data, for the battle beside it to judge.
 *
 * Printed as JSON on stdout, because the battle cannot import these packages: they are private
 * workspace packages whose siblings are `workspace:*`, and only a pack-and-install resolves them.
 */

import { createBlankProject, loadProject } from "@modyra/studio-model";
import { createCoreTarget } from "@modyra/studio-target-core";

const FIELD = {
  node: "field", id: "nd_amount", name: "amount", validators: [],
  field: { kind: "number", label: "Amount" },
};

const projectWith = (node) => {
  const project = createBlankProject();
  project.schema.children = [node];
  return JSON.parse(JSON.stringify(project));
};

const target = createCoreTarget();
const formOf = (generated) => generated.files.find((each) => each.path.endsWith("form.ts"))?.content ?? "";

/** Load and generate, reporting what each step said rather than deciding anything. */
async function through(node) {
  let loaded;
  try {
    loaded = loadProject(projectWith(node));
  } catch (error) {
    return { door: error.constructor.name, message: String(error.message).slice(0, 120) };
  }
  const generated = await target.generate(loaded.project);
  return {
    door: "accepted",
    loadDiagnostics: loaded.diagnostics.length,
    generateDiagnostics: generated.diagnostics.length,
    form: formOf(generated),
  };
}

const { name: _name, ...nameless } = FIELD;
const { validators: _validators, ...unvalidated } = FIELD;

const refusals = {};
for (const [what, input] of [
  ["notAnObject", null],
  ["schemaNotAnObject", { ...projectWith(FIELD), schema: "nope" }],
  ["futureVersion", { ...projectWith(FIELD), studioVersion: 99 }],
]) {
  try {
    loadProject(input);
    refusals[what] = "accepted";
  } catch (error) {
    refusals[what] = error.constructor.name;
  }
}

process.stdout.write(JSON.stringify({
  sound: await through(FIELD),
  nameless: await through(nameless),
  strangeKind: await through({ ...FIELD, field: { ...FIELD.field, kind: "wormhole" } }),
  noValidators: await through(unvalidated),
  groupNoChildren: await through({ node: "group", id: "nd_g", name: "g" }),
  refusals,
}));
