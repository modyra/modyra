/**
 * Every condition this repository actually writes, said the other way.
 *
 * A form's conditions are moving from predicates to expressions, and a translation is only worth
 * making if the two spellings decide the same thing. That is not a claim about the operators in the
 * abstract: it is a claim about the specific predicates people wrote, over the specific values a
 * form holds — including the ones nobody writes a test for.
 *
 * So the table below is a census rather than a sample. Each row is a `when` or `asyncWhen` that
 * exists in `examples/`, `docs/guides/`, `docs/examples/` or `packages/studio-preview`, the
 * expression it becomes, and the values both are asked about. The battle asks each pair the same
 * question and requires the same answer.
 *
 * The census is the predicates that exist, not values invented to probe the operators. Where the
 * two spellings of a comparison part company at all — `NaN` and signed zero — that is a property of
 * the operators rather than of anyone's `when`, and `one-vocabulary-four-answers.battle.test.mjs`
 * beside this file is where it is attacked.
 *
 * A row marked `needs: "self"` reads the field's own value. The expression language addresses
 * fields by path and has no way to say *this one*, which is the single gap the census found — so
 * those rows are the ones that fail until it does.
 */

import { evaluateExpression, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SELF = Object.freeze({ self: true });
const p = (path) => Object.freeze({ path });

/**
 * The census. `closure` is the predicate as written, verbatim in meaning; `expr` is what it becomes;
 * `samples` are the `(own value, enclosing value)` pairs both are asked about.
 */
const CENSUS = Object.freeze([
  {
    name: 'examples + guides: form.kind === "company"',
    closure: (_value, form) => form.kind === "company",
    expr: { op: "equals", operands: [p("kind"), "company"] },
    samples: [
      [null, { kind: "company" }],
      [null, { kind: "person" }],
      [null, {}],
      [null, { kind: null }],
      [null, { kind: undefined }],
    ],
  },
  {
    name: 'guides: form["wantsInvoice"] === true',
    closure: (_value, form) => form["wantsInvoice"] === true,
    expr: { op: "equals", operands: [p("wantsInvoice"), true] },
    samples: [
      [null, { wantsInvoice: true }],
      [null, { wantsInvoice: false }],
      [null, { wantsInvoice: "true" }],
      [null, { wantsInvoice: 1 }],
      [null, {}],
    ],
  },
  {
    name: 'guides: form.address.country === "US"',
    closure: (_value, form) => form.address?.country === "US",
    expr: { op: "equals", operands: [p("address.country"), "US"] },
    samples: [
      [null, { address: { country: "US" } }],
      [null, { address: { country: "IT" } }],
      [null, { address: {} }],
      [null, {}],
    ],
  },
  {
    name: "panels/states: value.inPlay === true",
    closure: (_value, section) => section.inPlay === true,
    expr: { op: "equals", operands: [p("inPlay"), true] },
    samples: [
      [null, { inPlay: true }],
      [null, { inPlay: false }],
      [null, { inPlay: 0 }],
    ],
  },
  {
    name: "core tests: quantity !== 0, on the field's own value",
    needs: "self",
    closure: (value) => value !== 0,
    expr: { op: "notEquals", operands: [SELF, 0] },
    samples: [
      [0, {}],
      [1, {}],
      [null, {}],
      [-0, {}],
    ],
  },
  {
    name: "examples/lit: String(value ?? '').length >= 3, on the field's own value",
    needs: "self",
    closure: (value) => String(value ?? "").length >= 3,
    expr: { op: "lengthAtLeast", operands: [SELF, 3] },
    samples: [
      ["abc", {}],
      ["ab", {}],
      ["", {}],
    ],
  },
  {
    name: "guides: an async precondition on length, on the field's own value",
    needs: "self",
    closure: (value) => value.length >= 11,
    expr: { op: "lengthAtLeast", operands: [SELF, 11] },
    samples: [
      ["12345678901", {}],
      ["1234567890", {}],
      ["", {}],
    ],
  },
  {
    name: "guides: a literal pattern over the field's own value",
    needs: "self",
    closure: (value) => /^\+?[0-9 ]{6,}$/.test(value),
    expr: { op: "matches", operands: [SELF, "^\\+?[0-9 ]{6,}$"] },
    samples: [
      ["+39 011 1234", {}],
      ["nope", {}],
      ["", {}],
    ],
  },
]);

battle(
  {
    claims: ["EXP-001"],
    title: "every condition this repository writes decides the same as its expression",
    environments: ["node"],
  },
  async (ctx) => {
    // The instrument answers for itself first. A census that translated nothing, or whose rows were
    // all unreachable, would agree with everything.
    expectClaim(CENSUS.length >= 8 && CENSUS.some((row) => row.needs === undefined), {
      claimIds: ["EXP-001"],
      what: "the census is too small or has no row the language can already express, so agreement means nothing",
      detail: `rows=${CENSUS.length}`,
    });

    // A malformed expression would decide `false` everywhere and could agree with a predicate by
    // accident. Every row has to be one the contract itself accepts.
    const malformed = CENSUS.flatMap((row) => {
      const problems = validateExpression(row.expr, row.name);
      return problems.length > 0 ? [{ row: row.name, problems }] : [];
    });

    const disagreements = [];
    for (const row of CENSUS) {
      for (const [own, enclosing] of row.samples) {
        const predicate = row.closure(own, enclosing);
        const expression = evaluateExpression(row.expr, enclosing, { self: own });
        if (predicate !== expression) {
          disagreements.push({
            row: row.name,
            own: String(own),
            enclosing: JSON.stringify(enclosing),
            predicate,
            expression,
          });
        }
      }
    }

    ctx.log.note("the census, asked both ways", {
      rows: CENSUS.length,
      samples: CENSUS.reduce((total, row) => total + row.samples.length, 0),
      malformed: malformed.length,
      disagreements: disagreements.length,
    });

    expectEqual(disagreements, [], {
      claimIds: ["EXP-001"],
      what: "a condition decides differently depending on which way it is written",
    });
    expectEqual(malformed, [], {
      claimIds: ["EXP-001"],
      what: "an expression in the census is not one the contract accepts, so its agreement would be an accident",
    });

  },
);
