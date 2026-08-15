/**
 * Runs inside a consumer that installed the packed Studio packages.
 *
 * Prints one row per option list: what the compiler said about it, and whether the compiled document
 * still carries every option. Nothing here asserts — the battle reads the rows.
 */
import { createBlankProject } from "@modyra/studio-model";
import { compileToContract } from "@modyra/studio-contract";

/** A project whose one field is a select carrying `options`. */
const projectWith = (options) => {
  const project = structuredClone(createBlankProject("options"));
  project.schema.children.push({
    node: "field",
    id: "nd-1",
    name: "plan",
    label: "Plan",
    fieldKind: "select",
    valueType: "string",
    initialValue: null,
    validators: [],
    options,
  });
  return project;
};

const LISTS = [
  ["distinct values", [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]],
  ["no options", []],
  ["two sharing a value", [{ value: "pro", label: "Pro monthly" }, { value: "pro", label: "Pro yearly" }, { value: "lite", label: "Lite" }]],
  ["a value with a space", [{ value: "New York", label: "New York" }, { value: "Paris", label: "Paris" }]],
  ["a value with the id delimiter", [{ value: "a__b", label: "Delimited" }, { value: "c", label: "C" }]],
];

const rows = LISTS.map(([what, options]) => {
  let outcome;
  try {
    outcome = compileToContract(projectWith(options));
  } catch (error) {
    return { what, threw: String(error?.message ?? error).slice(0, 120) };
  }
  const diagnostics = (outcome.diagnostics ?? []).map((entry) => entry.code ?? entry.message);
  const compiled = JSON.stringify(outcome.contract ?? outcome);
  const match = /"options":(\[[^\]]*\])/.exec(compiled);
  const carried = match === null ? [] : JSON.parse(match[1]).map((option) => option.value);
  return { what, declared: options.map((option) => option.value), diagnostics, carried };
});

process.stdout.write(JSON.stringify(rows));
