/**
 * A document reaching for a computation, and a parser that says nothing.
 *
 * H-2 of `charter/fable5-hunts.md`, red by construction: *"a document can declare a computation (e.g.
 * a money field equal to the sum of `quantity * unitPrice` over an array's rows) and the field updates
 * as rows change."* The work order names what is missing — `expression.ts` holds predicates only, with
 * no arithmetic and no aggregation, and `parse.ts` has no `computations` slot.
 *
 * The half that is already right, and worth saying first: the **vocabulary is closed and fails
 * closed**. `multiply`, `add`, `sum` and `count` are each refused by `validateExpression` and each
 * evaluate to `false` — the direction that shuts a field rather than opening it. Nothing here is
 * asking to loosen that.
 *
 * The half that is not is what happens to an author who reaches for the feature anyway. Both of the
 * shapes a contract might plausibly offer are taken without a word:
 *
 *   { computations: [{ target: "total", expression: … }] }   ok: true, three fields, no diagnostic
 *   { field: { …, computed: { op: "multiply", … } } }        ok: true, two fields, no diagnostic
 *
 * So a document that says "total is quantity times price" parses clean, renders, and `total` never
 * moves. The author is told nothing at parse time, nothing at render time, and nothing when the form
 * submits a total somebody typed by hand or left at zero. A missing capability that is **reported**
 * is a limit; one that is accepted is a defect — the same line finding 215 draws for conditional
 * rows, where this parser refuses by name and is right to.
 *
 * The battle turns green either way the work lands: when a computation runs, or when a slot nobody
 * reads is reported. It does not name the slot the contract will choose — it asks that both shapes,
 * and any other, are either honoured or refused.
 */

import { evaluateExpression, parseDynamicForm, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = (spec) => ({ node: "field", field: spec });

/** The shapes an author would try, given a contract that carries expressions everywhere else. */
const ATTEMPTS = Object.freeze([
  {
    shape: "a computations slot on the envelope",
    document: {
      version: 4,
      schema: {
        node: "group",
        children: {
          qty: leaf({ kind: "number", label: "Qty" }),
          price: leaf({ kind: "number", label: "Price" }),
          total: leaf({ kind: "number", label: "Total" }),
        },
      },
      computations: [
        { target: "total", expression: { op: "multiply", operands: [{ path: "qty" }, { path: "price" }] } },
      ],
    },
  },
  {
    shape: "a computed expression on the field",
    document: {
      version: 4,
      schema: {
        node: "group",
        children: {
          qty: leaf({ kind: "number", label: "Qty" }),
          total: leaf({ kind: "number", label: "Total", computed: { op: "multiply", operands: [{ path: "qty" }, 2] } }),
        },
      },
    },
  },
]);

/** Operators a computation would need, none of which the closed vocabulary has. */
const ARITHMETIC = Object.freeze(["multiply", "add", "sum", "count"]);

battle(
  {
    claims: ["DYN-004", "EXP-001"],
    title: "a document that declares a computation runs it, or is told it will not",
    environments: ["node"],
  },
  async (ctx) => {
    // First the half that is right: the vocabulary is closed, and closed in the safe direction.
    const vocabulary = ARITHMETIC.map((op) => {
      const expression = { op, operands: [{ path: "qty" }, 2] };
      return {
        op,
        evaluates: evaluateExpression(expression, { qty: 3 }),
        refused: validateExpression(expression, "where").length > 0,
      };
    });
    ctx.log.note("what the closed vocabulary does with an arithmetic operator", vocabulary);

    expectClaim(
      vocabulary.every((row) => row.refused && row.evaluates === false),
      {
        claimIds: ["EXP-001"],
        what: "an operator nobody declared is not refused, or does not fail closed, which is a worse finding than this one",
        detail: JSON.stringify(vocabulary),
      },
    );

    const observed = ATTEMPTS.map((attempt) => {
      const parsed = parseDynamicForm(attempt.document, { mode: "strict" });
      return {
        shape: attempt.shape,
        accepted: parsed.ok && parsed.fields.length > 0,
        said: parsed.diagnostics.map((each) => each.code),
      };
    });
    ctx.log.note("what the parser says to a document reaching for a computation", observed);

    // The control: a document of the same shape without the computation must parse clean, so a
    // diagnostic below would be about the computation rather than about the rest of the document.
    const withoutIt = parseDynamicForm(
      {
        version: 4,
        schema: { node: "group", children: { qty: leaf({ kind: "number", label: "Qty" }), total: leaf({ kind: "number", label: "Total" }) } },
      },
      { mode: "strict" },
    );
    expectClaim(withoutIt.ok && withoutIt.fields.length === 2, {
      claimIds: ["DYN-004"],
      what: "the same document without a computation does not parse, so the probe is wrong before the contract is",
      detail: JSON.stringify(withoutIt.diagnostics.map((each) => each.code)),
    });

    expectEqual(
      observed.filter((row) => row.accepted && row.said.length === 0).map((row) => row.shape),
      [],
      {
        claimIds: ["DYN-004", "EXP-001"],
        what: "a document declaring that one field is computed from others parsed clean and renders a field that never moves, with nothing said at parse time or after",
      },
    );
  },
);
