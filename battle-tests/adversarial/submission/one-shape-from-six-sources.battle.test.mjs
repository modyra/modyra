/**
 * Six places an error comes from, and the one shape everything that draws them relies on.
 *
 * `MdyFormError` is `{ path, kind, message, payload? }`, and a renderer reads all four: `path` to put
 * the message under the right field or in the form's own summary, `kind` to decide whether it is a
 * rule, a check or something the server said, `payload` for anything else.
 *
 * The errors themselves arrive from six different places, written by different code and at different
 * times: a synchronous rule, an asynchronous check that answered, one that rejected, a server refusal
 * on a field, a server refusal on the form, and a rule inside a collection row. Nothing asserts that
 * they agree, and every renderer would be written against whichever one its author happened to try.
 *
 * The three normalisations are the part worth pinning:
 *
 * - a server refusal with no `kind` becomes `"unknown"` — a value that says the engine does not know,
 *   rather than a missing property a renderer has to guard;
 * - a `kind` the server *did* supply survives, including one that collides with a local rule's;
 * - a key the shape does not declare is dropped, which is what `payload` is for.
 */

import { createForm, field, group, minLength, record, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a renderer would read off one error. */
const shapeOf = (error) => ({
  path: error.path === null ? "null" : typeof error.path,
  kind: error.kind,
  message: typeof error.message,
  undeclared: Object.keys(error).filter((key) => !["path", "kind", "message", "payload"].includes(key)),
});

battle(
  {
    claims: ["SUB-001", "VAL-001"],
    title: "an error is the same shape whichever of the six places it came from",
    environments: ["node"],
  },
  async (ctx) => {
    const seen = [];

    const fromRule = createForm({ a: field("", [required()]) }, { devWarnings: false });
    await settled(60);
    seen.push(["a synchronous rule", fromRule.errorsFor("a")()[0]]);
    fromRule.destroy();

    const fromCheck = createForm(
      { a: field("", [], { asyncValidators: [async () => ["taken"]], asyncDebounceMs: 0 }) },
      { devWarnings: false },
    );
    fromCheck.f.a.set("x");
    await settled();
    seen.push(["an asynchronous check that answered", fromCheck.errorsFor("a")()[0]]);
    fromCheck.destroy();

    const fromRejection = createForm(
      { a: field("", [], { asyncValidators: [async () => { throw new Error("down"); }], asyncDebounceMs: 0 }) },
      { devWarnings: false },
    );
    fromRejection.f.a.set("x");
    await settled();
    seen.push(["an asynchronous check that rejected", fromRejection.errorsFor("a")()[0]]);
    fromRejection.destroy();

    const fromServer = createForm({ a: field("x") }, { devWarnings: false });
    await fromServer.submit(() => [{ path: "a", message: "already taken" }]);
    await settled(60);
    seen.push(["a server refusal on a field", fromServer.errorsFor("a")()[0]]);
    fromServer.destroy();

    const fromServerForm = createForm({ a: field("x") }, { devWarnings: false });
    await fromServerForm.submit(() => [{ path: null, message: "the service is down" }]);
    await settled(60);
    seen.push(["a server refusal on the form", fromServerForm.state.lastSubmitErrors()[0]]);
    fromServerForm.destroy();

    const fromRow = createForm(
      { rows: record(group({ code: field("", [minLength(3)]) }), { initial: { r1: { code: "a" } } }) },
      { devWarnings: false },
    );
    await settled(60);
    seen.push(["a rule inside a collection row", fromRow.errorsFor("rows.r1.code")()[0]]);
    fromRow.destroy();

    // The control: every source produced one. A source that produced nothing would agree with the
    // others about a shape neither of them has.
    const empty = seen.filter(([, error]) => error === undefined).map(([what]) => what);
    expectEqual(empty, [], {
      claimIds: ["VAL-001"],
      what: "a source produced no error at all, so its shape was never compared",
    });

    for (const [what, error] of seen) {
      const shape = shapeOf(error);
      ctx.log.note("an error, and what a renderer reads off it", { what, shape });

      expectEqual(shape.undeclared, [], {
        claimIds: ["SUB-001"],
        what: `${what} carried a key the error shape does not declare`,
        detail: JSON.stringify(error),
      });

      expectClaim(typeof error.kind === "string" && error.kind !== "" && shape.message === "string", {
        claimIds: ["SUB-001"],
        what: `${what} did not carry a kind and a message a renderer can read`,
        detail: JSON.stringify(error),
      });

      expectClaim(error.path === null || typeof error.path === "string", {
        claimIds: ["SUB-001"],
        what: `${what} carried a path that is neither a string nor null, so a renderer cannot place it`,
        detail: JSON.stringify(error),
      });
    }

    // And the three normalisations a server refusal goes through.
    const normalised = [];
    for (const [what, refusal] of [
      ["with no kind", { path: "a", message: "m" }],
      ["with a kind of its own", { path: "a", kind: "conflict", message: "m" }],
      ["with a kind a local rule also uses", { path: "a", kind: "validation", message: "m" }],
      ["with a payload", { path: "a", kind: "conflict", message: "m", payload: { retryAfter: 30 } }],
      ["with a key the shape does not declare", { path: "a", kind: "conflict", message: "m", httpStatus: 409 }],
    ]) {
      const form = createForm({ a: field("x") }, { devWarnings: false });
      await form.submit(() => [refusal]);
      await settled(60);
      normalised.push([what, form.errorsFor("a")()[0]]);
      form.destroy();
    }
    ctx.log.note("what a server refusal becomes", Object.fromEntries(normalised));

    const byWhat = Object.fromEntries(normalised);
    expectEqual(byWhat["with no kind"].kind, "unknown", {
      claimIds: ["SUB-001"],
      what: "a refusal with no kind did not become one a renderer can switch on",
    });

    expectEqual(
      [byWhat["with a kind of its own"].kind, byWhat["with a kind a local rule also uses"].kind],
      ["conflict", "validation"],
      {
        claimIds: ["SUB-001"],
        what: "a kind the server supplied was replaced by the engine's own",
      },
    );

    expectEqual(byWhat["with a payload"].payload, { retryAfter: 30 }, {
      claimIds: ["SUB-001"],
      what: "the one slot the shape declares for anything else did not survive",
    });

    expectEqual(shapeOf(byWhat["with a key the shape does not declare"]).undeclared, [], {
      claimIds: ["SUB-001"],
      what: "a key outside the declared shape reached a renderer, which reads four and would not see it",
    });
  },
);
