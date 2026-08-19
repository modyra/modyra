/**
 * A condition whose operands are not a list, and the reader that was supposed to refuse it.
 *
 * `SEC-004` is that a document cannot make the form stop answering. A document is untrusted input —
 * a CMS, a model's output, a server — and `parseDynamicForm` is the door it arrives at: what it meets
 * there is a diagnostic, not an exception.
 *
 * `{ op: "equals", operands: "x" }` is a condition an author reaches by writing one pair of brackets
 * less. `validateExpression` reads `operands` and calls `forEach` on it:
 *
 *     operands: null        MDY_DYNAMIC_INVALID_CONDITION, refused, the form is built without it
 *     operands: "x"         TypeError: operands.forEach is not a function
 *     operands: 7           the same
 *     operands: { a: 1 }    the same
 *     operands: true        the same
 *
 * The guard exists and is incomplete: it recognises a condition that is missing and not one that is
 * the wrong shape. `null` proves the path works, which is what makes the rest a hole rather than an
 * absence.
 *
 * Every door a condition enters reaches it — a field's `when`, a field's `asyncWhen`, a group's
 * `when`, a validation's `when`, and one nested inside an `and` — in **both** parse modes. Lenient is
 * the mode a consumer chooses to survive a document it does not control, and it throws too.
 *
 * What arrives is `operands.forEach is not a function`: an internal, naming neither the document, nor
 * the field, nor the clause. A consumer catching it learns that something in a document was wrong and
 * nothing about what or where.
 *
 * Green when a condition of any shape is refused with a diagnostic rather than thrown out of the
 * reader.
 */

import { parseDynamicForm, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The shapes `operands` may arrive as when it is not a list. */
const NOT_A_LIST = { "a string": "x", "a number": 7, "an object": { a: 1 }, "a boolean": true };

const conditionWith = (operands) => ({ op: "equals", operands });

/** One document per door a condition may be written at. */
const doors = (condition) => ({
  "a field's when": { version: 4, schema: { node: "group", children: { a: { node: "field", field: { kind: "text", label: "A" }, when: condition } } } },
  "a field's asyncWhen": { version: 4, schema: { node: "group", children: { a: { node: "field", field: { kind: "text", label: "A" }, asyncWhen: condition } } } },
  "a group's when": { version: 4, schema: { node: "group", when: condition, children: { a: { node: "field", field: { kind: "text", label: "A" } } } } },
  "a validation's when": { version: 3, fields: [{ name: "f", kind: "text", label: "L" }], validations: [{ target: "f", message: "no", when: condition }] },
  "one nested in an and": { version: 4, schema: { node: "group", children: { a: { node: "field", field: { kind: "text", label: "A" }, when: { op: "and", operands: [condition] } } } } },
});

/** What the reader does with a document: a verdict, or the name of what it threw. */
function readerOn(document, mode) {
  try {
    const parsed = parseDynamicForm(document, mode === "strict" ? { mode: "strict" } : undefined);
    return parsed.ok ? "accepted" : `refused: ${[...new Set(parsed.diagnostics.map((each) => each.code))].join(",")}`;
  } catch (error) {
    return `THREW ${error.constructor.name}`;
  }
}

battle(
  {
    claims: ["SEC-004", "DYN-003"],
    title: "a condition the reader cannot read is refused, not thrown",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a condition that is missing altogether is refused by name, so the path that
    // recognises a bad condition exists and reaches every door below.
    const missing = doors(conditionWith(null));
    const onMissing = Object.fromEntries(Object.entries(missing).map(([where, document]) => [where, readerOn(document, "strict")]));
    ctx.log.note("a condition whose operands are null", onMissing);
    expectClaim(Object.values(onMissing).every((verdict) => verdict.startsWith("refused")), {
      claimIds: ["DYN-003"],
      what: "a condition with null operands is not refused either, so there is no working guard for this to be a hole in",
      detail: JSON.stringify(onMissing),
    });

    const thrown = [];
    for (const [shape, operands] of Object.entries(NOT_A_LIST)) {
      // Directly, so the door and the reader underneath it are told apart.
      let direct;
      try {
        direct = validateExpression(conditionWith(operands), "when").length === 0 ? "accepted" : "refused";
      } catch (error) {
        direct = `THREW ${error.constructor.name}`;
      }

      for (const [where, document] of Object.entries(doors(conditionWith(operands)))) {
        for (const mode of ["strict", "lenient"]) {
          const verdict = readerOn(document, mode);
          if (verdict.startsWith("THREW")) thrown.push({ shape, where, mode, verdict });
        }
      }
      ctx.log.note("operands that are not a list", { shape, validateExpression: direct });
    }

    expectEqual(thrown, [], {
      claimIds: ["SEC-004", "DYN-003"],
      what: "a document threw out of the reader instead of being refused, so a condition written with one bracket missing stops the parse rather than being reported",
    });
  },
);
