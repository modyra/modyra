/**
 * The three shapes an operand may take, and the one that is two of them at once.
 *
 * ADR 0092 gives a condition three ways to name what it reads besides a path: `{self: true}` for the
 * value the clause is attached to, `{root: true}` for the whole form, and `{context: "key"}` for what
 * the host supplied. The package publishes a guard for each — `isSelfRef`, `isRootRef`,
 * `isContextRef` — so a consumer can tell them apart, and `expressionContextKeys` reports what a
 * condition asks its host for.
 *
 * Each shape on its own is answered by exactly one guard and accepted by `validateExpression`. An
 * operand carrying two of them is answered by **both**, accepted by the validator, and parsed clean
 * in strict mode:
 *
 *     {self: true}              isSelfRef ✓                  accepted   evaluates against the value
 *     {root: true}              isRootRef ✓                  accepted   evaluates against the form
 *     {self: true, root: true}  isSelfRef ✓  isRootRef ✓     accepted   evaluates against the value
 *
 * Which one wins is decided by the order an implementation happens to check in, and the record that
 * introduced the forms does not say. That is a contract question rather than a bug in a branch: the
 * same document is meant to mean the same thing in `@modyra/core`, the Rust SDK and the Java SDK, and
 * nothing in the published schema, the parser or the record tells the second and third which half of
 * that operand to read. No fixture carries the shape, so the conformance corpus would not catch a
 * disagreement.
 *
 * A second, smaller disagreement sits beside it: `isContextRef({context: ""})` answers **true** for an
 * operand `validateExpression` refuses. A guard that claims something the door turns away tells a
 * consumer to handle what the contract will not accept.
 *
 * Green when the two doors agree: an operand that is two things is refused where an operand is read,
 * or the guards stop claiming what the validator will not take.
 */

import {
  evaluateExpression,
  expressionContextKeys,
  isContextRef,
  isRootRef,
  isSelfRef,
  parseDynamicForm,
  validateExpression,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A document whose second field shows only when `operand` equals what the first field holds. */
const documentReading = (operand) => ({
  version: 4,
  schema: {
    node: "group",
    children: {
      a: { node: "field", field: { kind: "text", label: "A", initialValue: "x" } },
      b: { node: "field", field: { kind: "text", label: "B" }, when: { op: "equals", operands: [operand, "x"] } },
    },
  },
});

/** What every published door says about one operand. */
function doorsOn(operand) {
  const expression = { op: "equals", operands: [operand, "x"] };
  return {
    guards: [isSelfRef(operand) && "self", isRootRef(operand) && "root", isContextRef(operand) && "context"].filter(Boolean),
    validated: validateExpression(expression, "when").length === 0,
    parsed: parseDynamicForm(documentReading(operand), { mode: "strict" }).ok,
  };
}

battle(
  {
    claims: ["EXP-001", "DYN-004"],
    title: "an operand names one thing, at every door that reads it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: each shape on its own is claimed by exactly one guard and taken by both doors, so
    // what the ambiguous one finds is the combination rather than a guard that answers loosely.
    const settled = {
      self: doorsOn({ self: true }),
      root: doorsOn({ root: true }),
      context: doorsOn({ context: "tier" }),
    };
    ctx.log.note("the three shapes on their own", settled);
    expectEqual(settled, {
      self: { guards: ["self"], validated: true, parsed: true },
      root: { guards: ["root"], validated: true, parsed: true },
      context: { guards: ["context"], validated: true, parsed: false },
    }, {
      claimIds: ["EXP-001"],
      what: "a single operand shape is not answered by exactly one guard, or is refused by a door — so this battle is not about the combination",
    });

    // `{context: "tier"}` is refused by the parse and not by the validator because the document
    // declares no `requiresContext`, which is the check ADR 0092 asks for and is working.
    const both = doorsOn({ self: true, root: true });
    ctx.log.note("an operand carrying two shapes", both);

    expectClaim(both.guards.length <= 1, {
      claimIds: ["EXP-001"],
      what: "one operand is claimed by two guards, so a consumer told to read it by the published guards is told two different things",
      detail: JSON.stringify(both),
    });

    // And the door a document arrives through takes it, which is where it stops being a curiosity: the
    // same bytes reach three runtimes and nothing says which half to read.
    expectClaim(!both.parsed, {
      claimIds: ["DYN-004", "EXP-001"],
      what: "a document whose condition reads an operand that is both self and root parses clean in strict mode, so which one wins is an implementation's order of checks",
      detail: JSON.stringify({ both, evaluates: evaluateExpression({ op: "equals", operands: [{ self: true, root: true }, "x"] }, { a: 1 }, { self: "x", root: { a: 1 } }) }),
    });
  },
);

battle(
  {
    claims: ["EXP-001"],
    title: "a guard claims only what the validator will take",
    environments: ["node"],
  },
  async (ctx) => {
    // A context key is a string a host is asked for. The empty string is not a key, and the validator
    // says so; the guard published for telling the shape apart does not.
    const empty = { context: "" };
    const problems = validateExpression({ op: "equals", operands: [empty, "x"] }, "when");
    ctx.log.note("the empty context key", { isContextRef: isContextRef(empty), problems, keys: expressionContextKeys({ op: "equals", operands: [empty, "x"] }) });

    // The control: a real key is claimed and accepted, so the guard is not simply always true.
    expectClaim(isContextRef({ context: "tier" }) && validateExpression({ op: "equals", operands: [{ context: "tier" }, "x"] }, "when").length === 0, {
      claimIds: ["EXP-001"],
      what: "an ordinary context operand is not claimed and accepted, so there is no agreement here to break",
    });

    expectEqual(isContextRef(empty), problems.length === 0, {
      claimIds: ["EXP-001"],
      what: "a guard claims an operand the validator refuses, so a consumer telling the shapes apart handles one the contract will not take",
    });
  },
);
