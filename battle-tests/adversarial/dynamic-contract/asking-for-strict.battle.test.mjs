/**
 * Asking a parser to be strict, in every shape the vocabulary suggests.
 *
 * `parseDynamicForm(document, options)` takes its mode as `{ mode: "strict" }`, and strict is the
 * call with a job: `docs/guides/ai-generated-forms.md` says to use it *"before publishing or
 * registering a stored contract"*. It is the gate. Lenient is for an editor preview, where partial
 * diagnostics are the point.
 *
 * The contract also exports `MdyDynamicParseMode`, a public type spelling exactly
 * `"lenient" | "strict"`. So the vocabulary offers a bare mode string as a first-class thing while
 * the function wants it wrapped, and the two shapes are not distinguishable at the call site in
 * JavaScript — which a document pipeline often is.
 *
 * Passed the wrong shape, the parser does not refuse the call. It falls to lenient, keeps the field
 * that strict would have refused, and reports success. The publish gate reports that it published a
 * checked contract, having checked nothing.
 *
 * And `null` — a nullable configuration threaded through — raises, out of a parser whose stated
 * design is that a malformed document *"produces a report, never a throw and never a partially built
 * form"*. The promise is about the document, not the options; the caller still gets an exception
 * where everything else is a diagnostic.
 *
 * The property asserted is the one that keeps the gate a gate: **asking for strict either gets
 * strict, or gets told.** Falling back to the permissive mode without a word is what makes the
 * mistake invisible, and it is the only way of asking that this battle requires to behave — a
 * caller who asks for nothing is entitled to the default.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A document strict refuses and lenient keeps: one field, one constraint written where it does not live. */
const DOCUMENT = Object.freeze({
  version: 2,
  fields: [Object.freeze({ name: "x", kind: "text", label: "X", required: true })],
});

/** Asks, and reports the verdict or the throw. */
function askWith(options) {
  try {
    const parsed = parseDynamicForm(DOCUMENT, options);
    return { ok: parsed.ok, kept: parsed.fields.length, said: parsed.diagnostics.map((each) => each.code) };
  } catch (error) {
    return { threw: error instanceof Error ? error.message : String(error) };
  }
}

battle(
  {
    claims: ["DYN-004"],
    title: "asking for strict either gets strict or gets told",
    environments: ["node"],
  },
  async (ctx) => {
    const proper = askWith({ mode: "strict" });
    const lenient = askWith({ mode: "lenient" });

    // The control: the document has to be one the two modes actually treat differently, or every
    // row below would agree for a reason that has nothing to do with how the mode was asked for.
    expectClaim(proper.ok === false && lenient.ok === true && lenient.kept === 1, {
      claimIds: ["DYN-004"],
      what: "the document is not one strict and lenient disagree about, so the battle attacks nothing",
      detail: JSON.stringify({ proper, lenient }),
    });

    // Every way of naming strict that is not the default. A caller who asks for nothing gets the
    // default and is not represented here.
    const ways = [
      { asked: 'the string "strict"', answer: askWith("strict") },
      { asked: '{ mode: "STRICT" }', answer: askWith({ mode: "STRICT" }) },
      { asked: '{ mode: "nonsense" }', answer: askWith({ mode: "nonsense" }) },
      { asked: "null", answer: askWith(null) },
    ];
    ctx.log.note("what each way of asking gets", { proper, lenient, ways });

    // Either it is strict, or something says it was not understood. Quietly answering as the
    // permissive mode is the one outcome that leaves a publish gate open while reporting success.
    expectEqual(
      ways
        .filter((entry) => entry.answer.threw === undefined && entry.answer.ok === true)
        .map((entry) => entry.asked),
      [],
      {
        claimIds: ["DYN-004"],
        what: "a mode the parser did not understand was answered as lenient and reported as success, so a publish gate passes a contract it never checked",
      },
    );

    // And nothing raises: this is a parser whose whole design is reports rather than throws.
    expectEqual(
      ways.filter((entry) => entry.answer.threw !== undefined).map((entry) => entry.asked),
      [],
      {
        claimIds: ["DYN-004"],
        what: "the parser raised instead of reporting, out of a design whose promise is a report and never a throw",
      },
    );
  },
);
