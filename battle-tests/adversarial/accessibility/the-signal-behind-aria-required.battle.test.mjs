/**
 * What tells a screen reader a field is required, along every route that can build one.
 *
 * `MDY_MARKS_REQUIRED` exists because of a regression it names in its own comment: the mark lived on
 * the validator function and did not survive `compose()`, "which is how `compose(required(), …)` came
 * to produce a field that was not marked required at all". The field's `required` signal is what
 * `aria-required` is rendered from, so a field that enforces the rule and does not carry the mark is
 * one a sighted user is told about and a screen-reader user is not.
 *
 * A fact is not an outcome: `compose(required(), …)` declares required along a path where the rule
 * would pass, because the fact describes the rule and not what it does to one value. So the mark is
 * asserted on a blank field and on a filled one alike.
 *
 * The three routes a form is built by are checked against each other rather than against a list
 * written here: a typed schema, a flat document, and a tree document. A flat document needs its
 * validators applied as a second call — `buildFlatFormSchema` builds the shape alone — and the
 * battle makes that call, because a route that enforces nothing would agree about the mark for the
 * wrong reason. The verdicts and the projected constraints are compared alongside for exactly that
 * reason.
 */

import {
  applyFlatValidators,
  buildDynamicFormSchema,
  buildFlatFormSchema,
  compose,
  composeFirst,
  createForm,
  field,
  minLength,
  parseDynamicFields,
  required,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What a field of one text cell answers about itself, whichever route built it. */
const readBack = (form) => ({
  required: form.f.x.required(),
  blankValid: form.state.valid(),
  minLength: form.f.x.constraints().minLength,
});

battle(
  {
    claims: ["A11Y-001", "VAL-004"],
    title: "a required field carries the mark whichever document route built it",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = { required: true, minLength: 3 };
    const forms = [];

    const typed = createForm({ x: field("", [required(), minLength(3)]) }, { devWarnings: false });
    forms.push(["a typed schema", typed]);

    const fields = parseDynamicFields([{ name: "x", kind: "text", label: "X", validators: declared }]);
    const flat = createForm(buildFlatFormSchema(fields), { devWarnings: false });
    applyFlatValidators(flat, fields);
    forms.push(["a flat document", flat]);

    const tree = createForm(
      buildDynamicFormSchema({
        node: "group",
        children: { x: { node: "field", field: { kind: "text", label: "X", validators: declared } } },
      }),
      { devWarnings: false },
    );
    forms.push(["a tree document", tree]);

    try {
      const answers = forms.map(([where, form]) => [where, readBack(form)]);
      ctx.log.note("what each route answers about one required field", { answers });

      // Each route enforces the rule. Without this the marks below could agree across three routes
      // that all built a form accepting anything.
      for (const [where, form] of forms) {
        expectClaim(!form.state.valid(), {
          claimIds: ["VAL-004"],
          what: `${where} built a form that is valid while its required cell is blank`,
        });
      }

      const [first, ...rest] = answers.map(([, answer]) => JSON.stringify(answer));
      expectEqual(rest, rest.map(() => first), {
        claimIds: ["A11Y-001"],
        what: "the routes disagree about the mark, the verdict or the constraint for one required field",
        detail: JSON.stringify(answers),
      });

      expectClaim(answers.every(([, answer]) => answer.required === true), {
        claimIds: ["A11Y-001"],
        what: "a field enforcing required does not carry the mark aria-required is rendered from",
        detail: JSON.stringify(answers),
      });
    } finally {
      for (const [, form] of forms) form.destroy();
    }
  },
);

battle(
  {
    claims: ["A11Y-001", "VAL-004"],
    title: "the mark describes the rule, not what the rule did to this value",
    environments: ["node"],
  },
  async (ctx) => {
    // The regression the marker exists for: a combinator that keeps the rule and loses the mark. Both
    // orders and both combinators, because an answer that depends on which was written first is one
    // that depends on how somebody happened to write the schema.
    const combinations = [
      ["compose(required, minLength)", compose(required(), minLength(3))],
      ["compose(minLength, required)", compose(minLength(3), required())],
      ["composeFirst(required, minLength)", composeFirst(required(), minLength(3))],
      ["compose(compose(required), minLength)", compose(compose(required()), minLength(3))],
    ];

    for (const [what, validator] of combinations) {
      const form = createForm({ x: field("", [validator]) }, { devWarnings: false });
      try {
        const blank = form.f.x.required();
        form.f.x.set("abcd");
        const filled = form.f.x.required();
        ctx.log.note("a composed rule, blank and filled", { what, blank, filled, valid: form.state.valid() });

        // The fact describes the rule, so it does not change when the value stops breaking it.
        expectEqual([blank, filled], [true, true], {
          claimIds: ["A11Y-001"],
          what: `${what} produced a field whose required mark depends on its current value`,
        });

        // And the rule is still there, so the mark is not the only thing that survived.
        expectClaim(form.state.valid(), {
          claimIds: ["VAL-004"],
          what: `${what} rejects a value that satisfies both rules inside it`,
          detail: JSON.stringify(form.f.x.errors().map((each) => each.message)),
        });
      } finally {
        form.destroy();
      }
    }

    // The control: a field with no such rule does not carry the mark, so the assertions above are
    // about the combinators rather than about a signal that is always true.
    const plain = createForm({ x: field("", [minLength(3)]) }, { devWarnings: false });
    try {
      expectEqual(plain.f.x.required(), false, {
        claimIds: ["A11Y-001"],
        what: "a field with no required rule reports itself as required",
      });
    } finally {
      plain.destroy();
    }
  },
);
