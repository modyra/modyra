/**
 * A document from a version this parser does not know, refused for something else.
 *
 * H-3 of `charter/fable5-hunts.md` asks whether the published schemas and the parser agree about
 * which documents exist. Part of that is which **versions** exist, and the contract publishes a
 * diagnostic for exactly this: `MDY_DYNAMIC_UNSUPPORTED_VERSION`, one of the ten codes in
 * `MDY_DYNAMIC_DIAGNOSTICS`, phrased *"Unsupported dynamic form config version"*.
 *
 * It is raised on one of the two shapes a document can have. The flat `fields` shape gets it; the
 * `schema` shape does not:
 *
 *   { version: 4, fields: [...] }     MDY_DYNAMIC_UNSUPPORTED_VERSION
 *   { version: 5, schema: {...} }     MDY_DYNAMIC_INVALID_FIELD
 *   { version: 99, schema: {...} }    MDY_DYNAMIC_INVALID_FIELD
 *   { version: null, schema: {...} }  MDY_DYNAMIC_INVALID_FIELD
 *
 * Nothing is smuggled through — every unsupported version is refused, and that is the part that
 * matters most. What is wrong is what the refusal says. A host handed a document from a newer
 * publisher reads *"invalid field"* and goes looking for the broken field; the answer is that the
 * document is from a version this reader does not have, and the code that says so exists and is
 * published.
 *
 * The same gap shows in the message the flat path does produce: *"expected 1, 2 or 3"* — while
 * version 4 is accepted in the `schema` shape. The sentence is a version behind the parser it
 * belongs to.
 *
 * The assertion is the narrow one: **a version the parser does not support is refused as a version**,
 * whichever shape the document takes. It says nothing about which versions should exist.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = { node: "field", field: { kind: "text", label: "A" } };

const asSchema = (version) => ({ version, schema: { node: "group", children: { a: leaf } } });
const asFields = (version) => ({ version, fields: [{ name: "a", kind: "text", label: "A" }] });

function refusalFor(document) {
  const parsed = parseDynamicForm(document, { mode: "strict" });
  return {
    ok: parsed.ok,
    fields: parsed.fields.length,
    codes: parsed.diagnostics.map((each) => each.code),
  };
}

/** Versions no shape of this contract has ever had. */
const UNSUPPORTED = Object.freeze([5, 99, -1, 0, 1.5, "3", null]);

battle(
  {
    claims: ["DYN-004", "DYN-003"],
    title: "a version the parser does not support is refused as a version",
    environments: ["node"],
  },
  async (ctx) => {
    const inSchemaShape = UNSUPPORTED.map((version) => ({ version, ...refusalFor(asSchema(version)) }));
    const inFieldsShape = UNSUPPORTED.map((version) => ({ version, ...refusalFor(asFields(version)) }));
    ctx.log.note("how each shape refuses a version it does not know", { inSchemaShape, inFieldsShape });

    // Two controls. A supported version must be accepted in the shape that carries it, or "these are
    // refused" would describe a parser that refuses everything. And the flat shape must already
    // produce the version diagnostic, or there would be no rule to be inconsistent with.
    const supported = refusalFor(asSchema(3));
    const flatSaysSo = inFieldsShape.every((row) => row.codes.includes("MDY_DYNAMIC_UNSUPPORTED_VERSION"));
    expectClaim(supported.ok && supported.fields === 1 && flatSaysSo, {
      claimIds: ["DYN-004"],
      what: "a supported version is refused, or the flat shape does not name the version either, so the probe is wrong before the contract is",
      detail: JSON.stringify({ supported, inFieldsShape }),
    });

    // Nothing is smuggled through: every unsupported version is refused, whatever it is called.
    expectEqual(
      inSchemaShape.filter((row) => row.fields > 0).map((row) => row.version),
      [],
      {
        claimIds: ["DYN-004"],
        what: "a document from an unsupported version produced fields, which would be the serious half of this finding",
      },
    );

    expectEqual(
      inSchemaShape
        .filter((row) => !row.codes.includes("MDY_DYNAMIC_UNSUPPORTED_VERSION"))
        .map((row) => ({ version: row.version, said: row.codes })),
      [],
      {
        claimIds: ["DYN-003", "DYN-004"],
        what: "a document from a version this parser does not have was refused for something other than its version, so a host is sent looking for a broken field instead of a newer reader",
      },
    );
  },
);
