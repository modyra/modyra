/**
 * Two published descriptions of one document, disagreeing about an option.
 *
 * A document can be checked twice: against `spec/dynamic-form-v3.schema.json`, which an editor
 * points `$schema` at and underlines as you type, and against `parseDynamicForm`, which the guide
 * says to run before constructing a form. The guide also states the relationship between them —
 * *treat a green schema as "well-formed", never as "valid"* — which puts the parser on the strict
 * side: everything it accepts the schema accepts, and not the other way round.
 *
 * For an option's value it is the other way round. The published schema allows `string`, `number`
 * and `boolean` and nothing else; the parser accepts an object, an array and `null` without a word,
 * and `strict` answers `ok`. An author whose editor underlines an object option gets a runtime that
 * takes it.
 *
 * The allowed types are read out of the published file rather than written here, so this compares
 * two artefacts rather than an artefact against a memory of it. If the schema is widened, the battle
 * widens with it.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "..");

/** What the published contract says an option's value may be. */
function allowedOptionValueTypes() {
  const schema = JSON.parse(readFileSync(join(REPO, "spec", "dynamic-form-v3.schema.json"), "utf8"));
  const option = schema.$defs?.option;
  const type = option?.properties?.value?.type;
  return { types: Array.isArray(type) ? type : type === undefined ? null : [type], required: option?.required ?? [] };
}

const parse = (options, mode) =>
  parseDynamicForm(
    { version: 2, schema: { node: "group", children: { a: { node: "field", field: { kind: "select", label: "S", options } } } } },
    { mode },
  );

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "an option value the published schema forbids is one the parser refuses",
    environments: ["node"],
  },
  async (ctx) => {
    const { types, required } = allowedOptionValueTypes();
    ctx.log.note("what the published contract allows", { types, required });

    // The control on the reading: the file says something, and it says the three scalars. A battle
    // that read nothing would pass every assertion below.
    expectClaim(Array.isArray(types) && types.length > 0, {
      claimIds: ["DYN-003"],
      what: "the published schema no longer states what an option value may be",
      detail: JSON.stringify(types),
    });

    // And the control on the parser: a value of an allowed type is kept, so a refusal below is the
    // type rather than the option list never working.
    for (const [what, value] of [["a string", "a"], ["a number", 1], ["a boolean", true]]) {
      const parsed = parse([{ value, label: "A" }], "lenient");
      expectEqual(parsed.fields.length, 1, {
        claimIds: ["DYN-001"],
        what: `an option whose value is ${what} — which the schema allows — was dropped`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

    for (const [what, value] of [
      ["an object", { id: 1 }],
      ["an array", [1]],
      ["null", null],
    ]) {
      const lenient = parse([{ value, label: "A" }], "lenient");
      const strict = parse([{ value, label: "A" }], "strict");
      ctx.log.note("an option value outside the published types", {
        what,
        kept: lenient.fields.length,
        codes: lenient.diagnostics.map((each) => each.code),
        strictOk: strict.ok,
      });

      // The guide puts the parser on the strict side of the schema. Accepting what the schema
      // forbids is the one direction that relationship rules out.
      expectClaim(lenient.diagnostics.length > 0 || strict.ok === false, {
        claimIds: ["DYN-001", "DYN-003"],
        what: `an option whose value is ${what} is outside the published types and the parser took it without a word`,
        detail: JSON.stringify({ types, kept: lenient.fields.length, strictOk: strict.ok }),
      });
    }

    // And a property the schema requires, missing: the field is dropped, which is an answer — but
    // dropping it silently is the same silence this file's other battles are about.
    const noLabel = parse([{ value: "a" }], "lenient");
    ctx.log.note("an option missing a property the schema requires", {
      required,
      kept: noLabel.fields.length,
      codes: noLabel.diagnostics.map((each) => each.code),
    });

    expectClaim(noLabel.fields.length > 0 || noLabel.diagnostics.length > 0, {
      claimIds: ["DYN-003"],
      what: `an option missing ${JSON.stringify(required)} dropped the field and said nothing`,
      detail: JSON.stringify(noLabel),
    });
  },
);
