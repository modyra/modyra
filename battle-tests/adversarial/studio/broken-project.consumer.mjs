/**
 * Runs inside a packed consumer, not in the suite.
 *
 * Asks every shipped target the one question `analyze` exists for — can this project be generated —
 * about a project `studio-model` itself calls broken, and records what each answered and what each
 * then emitted.
 */

import { createBlankProject } from "@modyra/studio-model";
import { createAngularTarget } from "@modyra/studio-target-angular";
import { createCoreTarget } from "@modyra/studio-target-core";
import { createJsonTarget } from "@modyra/studio-target-json";
import { createReactTarget } from "@modyra/studio-target-react";

/** A field with something wrong with it, and one with nothing wrong. */
function projectWith(broken) {
  const project = createBlankProject(broken ? "Broken" : "Fine");
  project.schema.children.push({
    node: "field",
    id: "nd-1",
    name: "choice",
    label: "Choice",
    fieldKind: "select",
    valueType: "string",
    initialValue: null,
    validators: [],
    // An option field with no options is SELECT_WITHOUT_OPTIONS, severity error.
    ...(broken ? {} : { options: [{ value: "a", label: "A" }] }),
  });
  return project;
}

const rows = [];
for (const broken of [false, true]) {
  const project = projectWith(broken);
  for (const target of [createJsonTarget(), createReactTarget(), createAngularTarget(), createCoreTarget()]) {
    const analysis = await target.analyze(project);
    let files = null;
    let threw = null;
    try {
      const artifact = await target.generate(project);
      files = (artifact.files ?? []).map((file) => file.path);
      rows.push({
        broken,
        target: target.id,
        compatible: analysis.compatible,
        analyzeErrors: (analysis.diagnostics ?? []).filter((each) => each.severity === "error").map((each) => each.code),
        generateErrors: (artifact.diagnostics ?? []).filter((each) => each.severity === "error").map((each) => each.code),
        files,
      });
      continue;
    } catch (error) {
      threw = `${error.constructor.name}`;
    }
    rows.push({ broken, target: target.id, compatible: analysis.compatible, threw });
  }
}

console.log(JSON.stringify(rows));
