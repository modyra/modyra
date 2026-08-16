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
 *
 * Every other list the schema declares is honoured exactly, which is the second battle here and what
 * makes the first one narrow: the seventeen field kinds match the runtime's exported list, all four
 * rule effects and all ten operators are taken and anything outside them is dropped, and each of the
 * three names the schema forbids is refused by name. One list out of five is the exception.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_DYNAMIC_FIELD_KINDS, parseDynamicForm } from "@modyra/core";

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
    open: "reported, not enforced: the dynamic-contract batch map, cause C, open in battle-tests/reports/open-findings.md",
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

battle(
  {
    claims: ["DYN-001", "DYN-003", "SEC-001"],
    title: "every other list the published schema declares is the list the parser uses",
    environments: ["node"],
  },
  async (ctx) => {
    const schema = JSON.parse(readFileSync(join(REPO, "spec", "dynamic-form-v3.schema.json"), "utf8"));
    const field = { node: "field", field: { kind: "text", label: "F" } };
    const workingRule = { effect: "hidden", target: "b", when: { field: "a", operator: "equals", value: "x" } };
    const rulesKept = (rule) =>
      parseDynamicForm(
        { version: 2, schema: { node: "group", children: { a: field, b: field } }, rules: [rule] },
        { mode: "lenient" },
      ).rules?.length ?? 0;

    // The kinds, against the runtime's own exported list rather than against a copy of either.
    const specKinds = schema.$defs?.field?.properties?.kind?.enum ?? [];
    ctx.log.note("the kinds each artefact declares", { spec: specKinds.length, runtime: MDY_DYNAMIC_FIELD_KINDS.length });

    expectEqual([...specKinds].sort(), [...MDY_DYNAMIC_FIELD_KINDS].sort(), {
      claimIds: ["DYN-001"],
      what: "the field kinds the schema declares are not the ones the runtime exports",
    });

    // Every effect and operator the schema names is one the parser takes, and one it does not name
    // is one the parser drops. Both directions, because a parser that took everything would pass
    // the first half alone.
    for (const [what, list, build] of [
      ["effect", schema.$defs?.rule?.properties?.effect?.enum ?? [], (value) => ({ ...workingRule, effect: value })],
      [
        "operator",
        schema.$defs?.rule?.properties?.when?.properties?.operator?.enum ?? [],
        // The value each operator can use, because the parser checks it against the operator that
        // will read it: a list for `in`, none where the operator asks about the field alone. Written
        // as one shape for all of them, this battle would report the value being refused as the
        // operator being refused — which is what it did until the check existed.
        (value) => ({
          ...workingRule,
          when: ["isEmpty", "isNotEmpty"].includes(value)
            ? { field: "a", operator: value }
            : { field: "a", operator: value, value: ["in", "notIn"].includes(value) ? ["x"] : "x" },
        }),
      ],
    ]) {
      expectClaim(list.length > 0, {
        claimIds: ["DYN-003"],
        what: `the schema no longer declares which ${what} values exist`,
      });

      const refused = list.filter((value) => rulesKept(build(value)) === 0);
      ctx.log.note("what the parser does with a declared list", { what, declared: list.length, refused });

      expectEqual(refused, [], {
        claimIds: ["DYN-001"],
        what: `the parser refuses ${what} values the published schema declares`,
      });

      expectEqual(rulesKept(build("wormhole")), 0, {
        claimIds: ["DYN-003"],
        what: `the parser takes an ${what} the schema does not declare`,
      });
    }

    // And the names it forbids, refused by name rather than merely dropped.
    const forbidden = schema.$defs?.field?.properties?.name?.not?.enum ?? [];
    expectClaim(forbidden.length > 0, {
      claimIds: ["SEC-001"],
      what: "the schema no longer forbids any name",
    });

    for (const name of forbidden) {
      const parsed = parseDynamicForm(JSON.parse(JSON.stringify([{ name, kind: "text" }])), { mode: "lenient" });
      ctx.log.note("a name the schema forbids", { name, kept: parsed.fields.length, codes: parsed.diagnostics.map((each) => each.code) });

      expectClaim(parsed.fields.length === 0 && parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_UNSAFE_NAME"), {
        claimIds: ["SEC-001", "DYN-003"],
        what: `the name ${name} is forbidden by the schema and was kept, or dropped without saying why`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "the envelope's own fields are the shapes the published schema gives them",
    open: "reported, not enforced: the dynamic-contract batch map, cause C, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // The envelope's scalars are the part of the contract an author writes first and reads least: a
    // name at the top of a file, checked by the editor the guide points `$schema` at. What the
    // schema says about `id` is not a suggestion — it is the shape a document is underlined against.
    const schema = JSON.parse(readFileSync(join(REPO, "spec", "dynamic-form-v3.schema.json"), "utf8"));
    const declared = schema.properties?.id ?? {};
    ctx.log.note("what the published schema says an id is", { declared });

    expectEqual([declared.type, declared.minLength], ["string", 1], {
      claimIds: ["DYN-003"],
      what: "the published schema no longer declares the envelope id as a non-empty string, so this battle is asking for something nobody publishes",
    });

    const withId = (id) => parseDynamicForm(
      { version: 2, id, fields: [{ name: "a", kind: "text", label: "A" }] },
      { mode: "strict" },
    );

    // The control: the shape the schema names is accepted, so what follows is about the others.
    expectClaim(withId("business-signup").ok === true, {
      claimIds: ["DYN-001"],
      what: "an id the schema allows was refused, so nothing below is about the parser being permissive",
    });

    // And the shapes it forbids. Each is refused by an editor the moment it is typed, and taken here
    // without a word — the direction the parser is meant never to go.
    const taken = [];
    for (const id of ["", 42, null, {}, [], true]) {
      const parsed = withId(id);
      if (parsed.ok) taken.push(id);
    }
    ctx.log.note("ids the schema forbids and the parser took", { taken });

    expectEqual(taken, [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: `the parser accepted ${taken.length} envelope ids the published schema refuses, so a document can be green in an editor's terms and green in the parser's while the two disagree about it`,
      detail: () => JSON.stringify(taken),
    });
  },
);
