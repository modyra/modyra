/**
 * The small published pieces a form is assembled from.
 *
 * Working through the exports no battle had ever imported turned up two findings and a lot of code
 * that holds. This is the second kind, kept rather than discarded: each of these is a published
 * function a consumer can call directly, and each answers a question the rest of the engine leans
 * on — what shape a kind holds, whether a range is half-filled, whether a document node is an
 * expression or a reference, which fields survive a hostile list.
 *
 * They are here together because they share one property worth pinning: each is *permissive about
 * emptiness and strict about everything else*. Emptiness is `required`'s question, and a validator
 * that answered it too would make a field that is merely blank report two things. Getting that
 * boundary wrong in either direction is quiet — a field that nags before it is filled, or one that
 * accepts a shape it cannot hold — which is why it is asserted rather than assumed.
 */

import {
  assertNeverField,
  completeRange,
  createConsoleDiagnostics,
  createSilentDiagnostics,
  isExpression,
  isPathRef,
  parseDynamicFields,
  valueShape,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["VAL-004"],
    title: "a shape check refuses what a kind cannot hold and stays out of required's way",
    environments: ["node"],
  },
  async (ctx) => {
    const number = valueShape("number");
    ctx.log.note("the shape a number field holds", {});

    for (const value of [3, 0, -1]) {
      expectEqual(number(value), [], {
        claimIds: ["VAL-004"],
        what: `a number field refused ${JSON.stringify(value)}`,
      });
    }

    for (const value of ["3", [], {}, true]) {
      expectClaim(number(value).length > 0, {
        claimIds: ["VAL-004"],
        what: `a number field accepted ${JSON.stringify(value)}`,
      });
    }

    // Emptiness is not this validator's question. A field that is merely blank must not report a
    // shape error as well as a missing value.
    for (const empty of [null, undefined]) {
      expectEqual(number(empty), [], {
        claimIds: ["VAL-004"],
        what: `a blank field reported a shape error for ${String(empty)}`,
      });
    }

    // A range is complete when both ends are set or neither is — and a cleared date input reports
    // `""` rather than null, so the two must be treated alike or a range ends up empty *and*
    // incomplete at once.
    const range = completeRange();
    for (const [value, complete] of [
      [{ start: "a", end: "b" }, true],
      [{ start: "", end: "" }, true],
      [{ start: "a", end: null }, false],
      [{ start: null, end: "b" }, false],
      [{ start: "a", end: "" }, false],
    ]) {
      const answered = range(value).length === 0;
      ctx.log.note("a range, whole or half-filled", { value, complete: answered });
      expectEqual(answered, complete, {
        claimIds: ["VAL-004"],
        what: `${JSON.stringify(value)} was judged ${answered ? "complete" : "incomplete"}`,
      });
    }

    // Not a range at all is not this validator's business either.
    for (const other of [null, "x", 3]) {
      expectEqual(range(other), [], {
        claimIds: ["VAL-004"],
        what: `${JSON.stringify(other)} was judged as though it were a range`,
      });
    }
  },
);

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "a hostile field list loses exactly the fields that are hostile",
    environments: ["node"],
  },
  async (ctx) => {
    // A flat field list is a document's other shape, and it arrives from the same places. What must
    // survive is the good field; what must not is the duplicate and the name that is a path into
    // something else.
    const parsed = parseDynamicFields([
      { name: "keep", kind: "text" },
      { name: "dup", kind: "text" },
      { name: "dup", kind: "text" },
      { name: "__proto__", kind: "text" },
      { name: "", kind: "text" },
    ]);
    const names = parsed.map((each) => each.name);
    ctx.log.note("what survived a hostile field list", { names });

    expectEqual(names, ["keep", "dup"], {
      claimIds: ["SEC-001", "DYN-001"],
      what: "the surviving fields are not the ones that should have survived",
    });

    // The control: a clean list loses nothing, so the assertion above is about the hostile entries
    // rather than about a parser that drops whatever it is given.
    const clean = parseDynamicFields([{ name: "a", kind: "text" }, { name: "b", kind: "text" }]);
    expectEqual(clean.map((each) => each.name), ["a", "b"], {
      claimIds: ["DYN-001"],
      what: "a list with nothing wrong with it lost a field",
    });

    // A kind nobody declared is refused where it is read, by name, rather than becoming a field
    // that renders as nothing.
    let refused = null;
    try {
      assertNeverField({ kind: "wormhole" });
    } catch (error) {
      refused = error.message;
    }

    expectClaim(refused !== null && refused.includes("wormhole"), {
      claimIds: ["DYN-001"],
      what: "an unknown field kind was accepted, or refused without naming itself",
      detail: String(refused),
    });
  },
);

battle(
  {
    claims: ["REA-002", "DYN-001"],
    title: "a document node says which of the two things it is, and a sink says nothing it was not given",
    environments: ["node"],
  },
  async (ctx) => {
    // An operand is a predicate or a reference to a field, and telling them apart is what lets a
    // document's condition be walked at all. Neither answers yes to the other's shape.
    for (const [value, expression, reference] of [
      [{ op: "equals", operands: [] }, true, false],
      [{ path: "a" }, false, true],
      [{}, false, false],
      [null, false, false],
      ["a", false, false],
    ]) {
      expectEqual([isExpression(value), isPathRef(value)], [expression, reference], {
        claimIds: ["DYN-001"],
        what: `${JSON.stringify(value)} was read as the wrong kind of operand`,
      });
    }

    // A silent sink is what a consumer installs to stop a library talking to their console. It has
    // to be silent about everything, including what it is handed after it was installed.
    const quiet = createSilentDiagnostics();
    const said = [];
    const realWarn = console.warn;
    const realError = console.error;
    console.warn = (...parts) => said.push(parts.join(" "));
    console.error = (...parts) => said.push(parts.join(" "));
    try {
      quiet.report({ code: "MDY_TEST", severity: "error", message: "this must not be printed" });
      createConsoleDiagnostics().report({ code: "MDY_TEST", severity: "error", message: "this must be printed" });
    } finally {
      console.warn = realWarn;
      console.error = realError;
    }
    ctx.log.note("what each sink said", { said });

    expectClaim(!said.some((line) => line.includes("must not be printed")), {
      claimIds: ["REA-002"],
      what: "the silent sink printed what it was given",
      detail: JSON.stringify(said),
    });

    // The control: the loud one does print, so the silence above is the sink rather than the report
    // never reaching either of them.
    expectClaim(said.some((line) => line.includes("must be printed")), {
      claimIds: ["REA-002"],
      what: "the console sink swallowed a report instead of printing it",
      detail: JSON.stringify(said),
    });
  },
);
