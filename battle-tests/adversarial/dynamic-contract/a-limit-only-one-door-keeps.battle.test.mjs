/**
 * A path too long to report, and a form built from it anyway.
 *
 * `MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, and the reason is written where the constant is: a path is
 * the payload key, the draft key, the widget id, and a string every renderer carries per field.
 * Every one of those four costs is paid by the form, not by the report — so the door that builds the
 * form is the one that has to keep the limit, and it is the one door that does not check it.
 *
 * `parseDynamicForm` drops the field with `MDY_DYNAMIC_PATH_TOO_LONG`. `buildDynamicFormSchema`,
 * given the same document's root node, builds it: the value is in the form, under the path the
 * parser called unusable. In the default mode the parse still answers `ok: true`, so a consumer that
 * renders from `fields` and holds data in the built form shows no control and submits a value.
 *
 * The battle asks only that the two doors say the same thing about one document. Which way they
 * agree is the contract's to choose: refuse in both, or accept in both.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildDynamicFormSchema, createForm, parseDynamicForm } from "@modyra/core";

/** Nested groups holding one field. No collection and no rows: the path is long because it is deep. */
function documentNestedBy(depth) {
  let node = { node: "field", field: { kind: "text", label: "L", initialValue: "secret" } };
  for (let index = depth - 1; index >= 0; index -= 1) node = { node: "group", children: { [`g${index}`]: node } };
  return { version: 3, schema: node };
}

/** What each public door says about one document: does the field exist. */
function bothDoors(document) {
  const parsed = parseDynamicForm(document);
  const form = createForm(buildDynamicFormSchema(document.schema), { devWarnings: false });
  const built = JSON.stringify(form.getValue()).includes("secret");
  form.destroy();
  return {
    reported: parsed.fields.length > 0,
    built,
    ok: parsed.ok,
    codes: parsed.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

battle(
  {
    claims: ["DYN-005", "DYN-001"],
    title: "the parser and the builder answer the same about a path at the limit",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The control, and it is what makes the measurement below about the limit rather than about
    // deep documents: one level under the limit both doors report the field.
    const under = bothDoors(documentNestedBy(124));
    ctx.log.note("one level under the limit", under);
    expectEqual(under, { reported: true, built: true, ok: true, codes: [] }, {
      claimIds: ["DYN-001"],
      what: "a document just under the path limit is already refused by one of the doors, so nothing below is about the limit",
    });

    const over = bothDoors(documentNestedBy(125));
    ctx.log.note("one level over the limit", over);

    // The limit is real at the door that reports.
    expectClaim(over.codes.includes("MDY_DYNAMIC_PATH_TOO_LONG"), {
      claimIds: ["DYN-005"],
      what: "the path limit does not fire at 125 levels, so this battle no longer sits on the boundary it names",
      detail: JSON.stringify(over),
    });

    // And it has to be the same limit at the door that builds, whichever way the contract settles it.
    expectEqual(over.built, over.reported, {
      claimIds: ["DYN-005"],
      what: "one door dropped a field over the path limit and the other built it, so a form holds a value under a path the contract calls unusable",
    });
  },
);

battle(
  {
    claims: ["DYN-005"],
    title: "a value under a refused path is not a value the form quietly carries",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const document = documentNestedBy(200);
    const parsed = parseDynamicForm(document);
    const form = createForm(buildDynamicFormSchema(document.schema), { devWarnings: false });
    const value = form.getValue();
    ctx.log.note("what a consumer renders and what it would send", {
      renderable: parsed.fields.length,
      ok: parsed.ok,
      payloadCarriesTheValue: JSON.stringify(value).includes("secret"),
    });

    // A consumer renders the fields the parser reports and sends the value the form holds. With
    // nothing to render and a value to send, the field is in the payload and on no screen.
    expectClaim(!(parsed.fields.length === 0 && JSON.stringify(value).includes("secret")), {
      claimIds: ["DYN-005"],
      what: "a document produced no field to render and a payload holding the value anyway, so the value is submitted and cannot be seen",
      detail: JSON.stringify({ ok: parsed.ok, fields: parsed.fields.length, codes: parsed.diagnostics.map((d) => d.code) }),
    });

    form.destroy();
  },
);
