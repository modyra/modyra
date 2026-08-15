/**
 * A whole value that names nothing the form has.
 *
 * ADR 0057 put a check on `setValue` and stated what the check is for, in its own words: it
 * "removes a way for a wrong-shaped or hostile response to silently erase what a user typed while
 * the form goes on reporting itself valid and submittable". A string, a number, `null`, `undefined`
 * and an array are refused for that reason.
 *
 * An object is the one shape it admits, and the same record states the rule that runs after:
 * a field the whole value does not name returns to its initial. Both halves are right on their own.
 * Together they leave one sequence open — `setValue({ emial: "x" })`, a single letter transposed in
 * a key, or a server response whose field was renamed — which names no field the form has, restores
 * every field to its initial, reports nothing, and leaves the form valid.
 *
 * The erasure the check was added to prevent therefore still happens, through the shape the check
 * lets through, and it is total rather than partial.
 *
 * The reset itself is decided and is asserted here as the control: `setValue({})` is the spelling
 * that means "return everything to its initial" and has to keep working. What is asserted as missing
 * is narrower — a *non-empty* whole value none of whose keys the form declares is not a reset
 * anybody wrote, and a caller learns nothing about the ones that were dropped.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A form somebody filled in, so what a write destroys is visible rather than inferred. */
function filledIn() {
  const form = createForm(
    { email: field("initial-e"), note: field("initial-n") },
    { devWarnings: true },
  );
  form.f.email.set("the user typed this");
  form.f.note.set("and this");
  return form;
}

/** Whatever the engine says through either console channel while one write runs. */
function whileWriting(run) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    run();
  } catch (error) {
    said.push(`threw: ${error.message}`);
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  return said;
}

battle(
  {
    claims: ["SEC-001", "SUB-001"],
    title: "a whole value naming no field the form has does not silently empty it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the decided behaviour: an empty object is the spelling for "everything back
    // to its initial", so the assertion below is about a value that names something rather than
    // about the reset rule.
    const deliberate = filledIn();
    deliberate.setValue({});
    ctx.log.note("the reset that is written on purpose", { value: deliberate.getValue() });

    expectEqual(deliberate.getValue(), { email: "initial-e", note: "initial-n" }, {
      claimIds: ["SUB-001"],
      what: "setValue({}) did not return every field to its initial, so ADR 0057's rule is not what runs here",
    });
    deliberate.destroy();

    // The second control: the check does refuse the shapes the record names, so what follows is the
    // one shape it admits rather than a check that never runs.
    const guarded = filledIn();
    for (const wrong of ["nope", 3, null, undefined, ["a"]]) {
      const said = whileWriting(() => guarded.setValue(wrong));
      expectClaim(said.some((line) => line.startsWith("threw:")), {
        claimIds: ["SEC-001"],
        what: `setValue(${JSON.stringify(wrong)}) was accepted, so the ADR 0057 check is not in place`,
        detail: JSON.stringify(said),
      });
    }
    expectEqual(guarded.getValue(), { email: "the user typed this", note: "and this" }, {
      claimIds: ["SEC-001"],
      what: "a refused whole value changed the form anyway",
    });
    guarded.destroy();

    // A single letter transposed. Nothing this object names exists; everything the user typed is
    // gone; the form says it is valid; nothing was reported.
    const typo = filledIn();
    const said = whileWriting(() => typo.setValue({ emial: "x" }));
    const after = typo.getValue();
    ctx.log.note("a whole value with one key, and no field by that name", {
      after,
      valid: typo.state.valid(),
      said,
    });

    expectClaim(said.length > 0, {
      claimIds: ["SEC-001"],
      what: "a whole value that names no field the form has was applied without a word",
      detail: `the form went to ${JSON.stringify(after)} and reports valid=${typo.state.valid()}`,
    });
    typo.destroy();

    // The refusal's own words, held to what the call does. A message that tells the caller to write
    // something is a promise about what that something does — and the record's consequence paragraph
    // says the opposite in as many words: `setValue({})` no longer empties a field to null but
    // returns it to its initial.
    const advised = createForm({ plan: field("pro"), note: field("") }, { devWarnings: true });
    advised.f.plan.set("enterprise");
    advised.f.note.set("typed");
    const refusal = whileWriting(() => advised.setValue({ nope: "x" })).join(" ");
    const suggested = /Pass (\S+) to (\w+)/.exec(refusal);
    ctx.log.note("what the refusal tells the caller to write", { refusal, suggested: suggested?.[0] ?? null });

    if (suggested !== null && suggested[2] === "empty") {
      advised.setValue({});
      const after = advised.getValue();
      const isEmpty = Object.values(after).every((each) => each === "" || each === null || each === undefined);
      ctx.log.note("what that advice does", { after, isEmpty });

      expectClaim(isEmpty, {
        claimIds: ["SUB-001"],
        what: "the refusal says to pass {} to empty the form, and {} returns every field to its initial instead",
        detail: `a form the user filled in became ${JSON.stringify(after)}`,
      });
    }
    advised.destroy();

    // And the partial case, which is the one a renamed server field produces: the keys that match
    // land, the key that does not is dropped, and the caller cannot tell the difference between a
    // field they meant to omit and one they misspelled.
    const partial = filledIn();
    const saidPartial = whileWriting(() => partial.setValue({ email: "e", emial: "x", note: "n" }));
    ctx.log.note("a whole value where one key of three names nothing", {
      after: partial.getValue(),
      said: saidPartial,
    });

    expectClaim(saidPartial.length > 0, {
      claimIds: ["SEC-001"],
      what: "an unknown key inside an otherwise valid whole value was dropped without a word",
      detail: JSON.stringify(partial.getValue()),
    });
    partial.destroy();
  },
);
