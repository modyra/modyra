/**
 * Two ways a condition stops being a decision and becomes an outage or a door.
 *
 * `expression.ts` states the rule it lives by, in three places and in the same words each time. An
 * operator nobody declared decides `false`, *"because a question with no answer is not answered with
 * the one that opens: a section governed by a misspelled operator was shown to everyone, and the
 * values inside it went into the payload"*. A pattern that does not compile *"decides nothing
 * instead"*, because raising from there went through *"whatever read the form last — the submit
 * button included"*. And `validateExpression` reports what the evaluator refuses, with the two
 * halves required to agree.
 *
 * Both halves of that rule have a hole.
 *
 * **A context that answers by throwing takes the form with it.** Reading a context key is a property
 * access, and a property can be an accessor. The bag is supplied by the application rather than built
 * by the engine, so it is exactly the kind of object that is a store, a signal or a Proxy — and a
 * condition is evaluated every time the form is read, so a throw there is not a slow form but a form
 * that cannot be rendered and a submit button that raises.
 *
 * Measured before it was claimed: a *document* cannot reach this. The parser refuses a rule whose
 * `when.field` is not a declared field, and the operators that read a field's value never read into
 * it. The context is the door that is open, and this battle is about that door only.
 *
 * **An operand that claims to be a reference and is not one opens rather than closes.** The resolver
 * recognises `{path}`, `{self:true}`, `{root:true}` and `{context:"key"}`. An object carrying one of
 * those keys with a value of the wrong type — `{context: 123}`, `{self: "yes"}`, `{root: 1}` — is
 * none of them, falls through to the literal branch, and is compared as the object it is: never
 * empty, so `isNotEmpty` answers `true` and the field it guards is shown. `validateExpression`
 * refuses those same operands by name. The reporting half and the deciding half disagree, which is
 * the one thing the contract says they may not do.
 *
 * The line is drawn at *claims to be a reference* rather than at *an object I do not recognise*, and
 * the difference is not pedantic: an array is an object, so the wider rule would refuse `in` against
 * a literal list, and since `equals` became structural an option value may legitimately be an object
 * too.
 */

import { evaluateExpression, evaluateRuleCondition, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** An object that answers a read by refusing — reactive state read out of scope, a hostile Proxy. */
const refusing = (key) => ({
  get [key]() {
    throw new Error("this value refuses to be read here");
  },
});

/** Asks a question and reports what happened, rather than letting a throw end the battle. */
function ask(run) {
  try {
    return { answered: run() };
  } catch (error) {
    return { threw: error instanceof Error ? error.message : String(error) };
  }
}

battle(
  {
    claims: ["SEC-004"],
    title: "a context the host supplies does not take the form with it",
    environments: ["node"],
  },
  async (ctx) => {
    // Measured before it was written: a document cannot reach this. The parser refuses a rule whose
    // `when.field` is not a declared field, so no `rules` entry can read into a held object, and the
    // operators that do read a field's value — `isEmpty`, `equals` — never touch its properties.
    //
    // The context is the door that stays open, because it is supplied by the application rather than
    // built by the engine: a bag of role, tenant and flags is exactly the kind of object that is a
    // store, a signal or a Proxy in a real application. So the claim here is about that door and not
    // about paths, and it is Possible rather than Observed for anything else.
    const doors = [
      {
        door: "a context key that refuses to be read",
        run: (bag) => evaluateExpression({ op: "isNotEmpty", operands: [{ context: "k" }] }, {}, { context: bag }),
        refusing: refusing("k"),
        ordinary: { k: "v" },
      },
      {
        door: "a context that refuses to be enumerated",
        run: (bag) => evaluateExpression({ op: "isNotEmpty", operands: [{ context: "k" }] }, {}, { context: bag }),
        refusing: new Proxy({}, { get() { throw new Error("this value refuses to be read here"); } }),
        ordinary: { k: "v" },
      },
    ];

    const answers = doors.map((entry) => ({ door: entry.door, ...ask(() => entry.run(entry.refusing)) }));
    ctx.log.note("what the context door does when the bag refuses to be read", answers);

    // The instrument answers first, and with the real question: each door asked the same way over an
    // ordinary bag must answer `true`. Without this, "nothing threw" could mean the probe never
    // reached the value at all.
    const control = doors.map((entry) => ({ door: entry.door, ...ask(() => entry.run(entry.ordinary)) }));
    expectClaim(control.every((entry) => entry.answered === true), {
      claimIds: ["SEC-004"],
      what: "a door does not answer even over an ordinary context, so the probe is wrong before the product is",
      detail: JSON.stringify(control),
    });

    expectEqual(
      answers.filter((entry) => entry.threw !== undefined).map((entry) => entry.door),
      [],
      {
        claimIds: ["SEC-004"],
        what: "a context the host supplied raised out of the condition, so reading the form raises and the submit button with it",
      },
    );
  },
);

battle(
  {
    claims: ["DYN-003", "VAL-003"],
    title: "an operand nobody declared decides nothing, and decides it the same way twice",
    environments: ["node"],
  },
  async (ctx) => {
    // Each is an object that **claims** to be one of the four known operands and is not one: a context
    // key that is not a string, a `self` that is not `true`, a `root` that is not `true`.
    //
    // An object naming none of them — `{ field: "n" }` — is deliberately absent. It was here once,
    // on the reasoning that an object literal can never usefully be compared. That reasoning died
    // when `equals` became structural: `{ tier: "pro" }` is now a legitimate literal, an option value
    // may be an object, and an array is an object too — so "an object I do not recognise" would
    // refuse `in` against a literal list. The line that survives is narrower and is the one asserted
    // here: an object that *declares* itself a reference and is not one decides nothing.
    const MALFORMED = Object.freeze([
      { name: "a context key that is not a string", operand: { context: 123 } },
      { name: "a self that is not true", operand: { self: "yes" } },
      { name: "a root that is not true", operand: { root: 1 } },
    ]);

    const scope = { self: null, root: {}, context: {} };
    const observed = MALFORMED.map((entry) => ({
      name: entry.name,
      // `isNotEmpty` is the question that shows the direction: an operand compared as the object it
      // is is never empty, so it answers true and opens whatever it guards.
      decides: evaluateExpression({ op: "isNotEmpty", operands: [entry.operand] }, {}, scope),
      reported: validateExpression({ op: "isNotEmpty", operands: [entry.operand] }, "where").length > 0,
    }));
    ctx.log.note("what the two halves say about an operand neither recognises", observed);

    // The instrument: a well-formed operand must decide and be reported clean, or "the malformed
    // ones are wrong" would be a statement about a probe that reports everything.
    const wellFormed = {
      decides: evaluateExpression({ op: "isNotEmpty", operands: [{ context: "k" }] }, {}, { context: { k: "v" } }),
      reported: validateExpression({ op: "isNotEmpty", operands: [{ context: "k" }] }, "where").length > 0,
    };
    expectClaim(wellFormed.decides === true && wellFormed.reported === false, {
      claimIds: ["DYN-003"],
      what: "a well-formed operand is refused or undecided, so the probe reports the contract wrongly",
      detail: JSON.stringify(wellFormed),
    });

    // The half that decides answers in the direction that closes.
    expectEqual(
      observed.filter((entry) => entry.decides !== false).map((entry) => entry.name),
      [],
      {
        claimIds: ["VAL-003", "DYN-003"],
        what: "an operand nobody declared opened the field it guards instead of deciding nothing",
      },
    );

    // And the half that reports agrees with it, which is the property the contract states outright.
    expectEqual(
      observed.filter((entry) => entry.reported !== true).map((entry) => entry.name),
      [],
      {
        claimIds: ["DYN-003"],
        what: "an operand the evaluator cannot resolve is not reported by the validator, so the two halves disagree",
      },
    );
  },
);
