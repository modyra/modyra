/**
 * The one value in a document that is never measured against the kind it belongs to.
 *
 * A document says what a field starts as. The parser checks a **collection's** starting value against
 * its shape — a record's must be an object keyed by row key, an array's must be an array, and either
 * mistake is refused by name. A **field's** is not checked at all.
 *
 * So `{ kind: "text", initialValue: 42 }` parses clean in the strictest mode there is, and the form it
 * makes is invalid before anybody has touched it: `This field holds string`, about a value the user
 * never entered.
 *
 * The knowledge to check it is published and used elsewhere. `MDY_VALUE_CONTRACTS` says what each kind
 * holds, `matchesValueShape` answers for a value against a shape, and the engine calls that same
 * judgement one layer later — which is why the form is invalid rather than broken. The check exists
 * and the door does not use it.
 *
 * Both halves are asserted: the collection cases are the control, because a parser that checked no
 * initial at all would be a different finding and this one would be misleading.
 */

import { MDY_VALUE_CONTRACTS, buildDynamicFormSchema, createForm, matchesValueShape, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 110) => new Promise((resolve) => setTimeout(resolve, ms));

const wrap = (child) => ({ version: 2, id: "f", schema: { node: "group", children: { x: child } } });

const asField = (initialValue) => wrap({ node: "field", field: { kind: "text", label: "A", initialValue } });
const asRecord = (initialValue) => wrap({
  node: "record",
  item: { node: "group", children: { c: { node: "field", field: { kind: "text", label: "C" } } } },
  initialValue,
});
const asArray = (initialValue) => wrap({
  node: "array",
  item: { node: "field", field: { kind: "text", label: "T" } },
  initialValue,
});

battle(
  {
    claims: ["DYN-001", "VAL-004"],
    title: "a starting value a kind cannot hold is refused where the document declares it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a collection's starting value is measured against its shape, both ways of being
    // wrong. So the parser does check initials, and the field case below is an omission rather than
    // a policy.
    const collections = [
      ["a record given a number", asRecord(42)],
      ["a record given a list", asRecord([])],
      ["an array given a number", asArray(42)],
      ["an array given an object", asArray({})],
    ];
    for (const [what, document] of collections) {
      const parsed = parseDynamicForm(document, { mode: "strict" });
      ctx.log.note("a collection's starting value", { what, ok: parsed.ok, codes: parsed.diagnostics.map((each) => each.code) });

      expectClaim(parsed.ok === false, {
        claimIds: ["DYN-001"],
        what: `${what} was accepted, so the parser does not check a collection's initial either and this battle is about something else`,
        detail: () => JSON.stringify(parsed.diagnostics),
      });
    }

    // And the knowledge the field case would need, published and answering.
    expectEqual(
      [matchesValueShape(MDY_VALUE_CONTRACTS.text.shape, 42), matchesValueShape(MDY_VALUE_CONTRACTS.text.shape, "ok")],
      [false, true],
      {
        claimIds: ["VAL-004"],
        what: "the published shape checker does not answer for a text field's value, so there is nothing for the parser to have used",
      },
    );

    // The field's own starting value, in the strictest mode there is.
    const taken = [];
    for (const initial of [42, {}, [], true]) {
      const parsed = parseDynamicForm(asField(initial), { mode: "strict" });
      if (parsed.ok) taken.push(initial);
    }
    ctx.log.note("starting values a text field was given", { taken });

    expectEqual(taken, [], {
      claimIds: ["DYN-001", "VAL-004"],
      what: `a text field was given ${taken.length} starting values it cannot hold and the document was accepted each time`,
      detail: () => JSON.stringify(taken),
    });
  },
);

battle(
  {
    claims: ["VAL-004"],
    title: "a form is not born invalid by a document the parser accepted",
    environments: ["node"],
  },
  async (ctx) => {
    // What the acceptance costs: the form exists, nobody has touched it, and it is already refusing.
    const form = createForm(buildDynamicFormSchema({
      node: "group",
      children: { a: { node: "field", field: { kind: "text", label: "A", initialValue: 42 } } },
    }), { devWarnings: false });
    await settled();

    const born = {
      value: form.getValue(),
      valid: form.state.valid(),
      canSubmit: form.state.canSubmit(),
      errors: form.errorsFor("a")().map((each) => each.message),
    };
    ctx.log.note("a form as its document made it", born);
    form.destroy();

    expectClaim(born.valid === true, {
      claimIds: ["VAL-004"],
      what: "a document the parser accepted made a form that is invalid before anybody touched it",
      detail: () => JSON.stringify(born),
    });
  },
);
