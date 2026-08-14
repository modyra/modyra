/**
 * What a field tells the browser about itself, when two rules disagree.
 *
 * A validator declares facts about what it enforces, and those facts become the native constraints a
 * control carries — `minlength`, `max`, `pattern`. The browser then enforces them before any
 * JavaScript runs, which is the point: a form that says `minlength="3"` and rejects anything under
 * five has told the user something untrue and will refuse a value the markup invited.
 *
 * So the question is what happens when two validators land on one field, which is ordinary —
 * a schema's constraint plus one the application added, a `compose`, a field that inherits and
 * narrows. Every pair has a stricter half, and the projected constraint has to be that one, in
 * either order, or the answer depends on the order somebody happened to write them in.
 *
 * Two patterns are the case with no answer: no single `pattern` attribute means "matches both", so
 * the honest projection is none at all plus a fact saying why. ADR 0030 is the record.
 */

import {
  compose,
  composeFirst,
  factsOf,
  factsOfAll,
  maxLength,
  max,
  mergeFacts,
  min,
  minLength,
  pattern,
  required,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Each pair, with the half that must survive because it promises less to the user. */
const PAIRS = Object.freeze([
  { name: "minLength", make: minLength, values: [3, 5], stricter: 5 },
  { name: "maxLength", make: maxLength, values: [10, 4], stricter: 4 },
  { name: "min", make: min, values: [1, 9], stricter: 9 },
  { name: "max", make: max, values: [9, 1], stricter: 1 },
]);

battle(
  {
    claims: ["VAL-004"],
    title: "two rules on one field project the one that promises less",
    environments: ["node"],
  },
  async (ctx) => {
    for (const { name, make, values, stricter } of PAIRS) {
      const [a, b] = values;

      // Both orders, because an answer that depends on the order is an answer that depends on how
      // somebody happened to write the schema.
      for (const order of [[a, b], [b, a]]) {
        const facts = factsOfAll(order.map((value) => make(value)));
        ctx.log.note("two rules of one kind on one field", { name, order, projected: facts.constraints[name] });

        expectEqual(facts.constraints[name], stricter, {
          claimIds: ["VAL-004"],
          what: `${name} written as ${JSON.stringify(order)} projected the looser of the two`,
        });
      }

      // And the same through the merge a caller can reach directly.
      expectEqual(mergeFacts(values.map((value) => ({ [name]: value }))).constraints[name], stricter, {
        claimIds: ["VAL-004"],
        what: `merging two ${name} facts kept the looser one`,
      });
    }

    // The control: a single rule projects itself, so the assertions above are about the meeting of
    // two rather than about a projection that always answers the same way.
    expectEqual(factsOfAll([minLength(3)]).constraints.minLength, 3, {
      claimIds: ["VAL-004"],
      what: "one rule on its own did not project what it enforces",
    });
  },
);

battle(
  {
    claims: ["VAL-004"],
    title: "a constraint the browser cannot express is not invented",
    environments: ["node"],
  },
  async (ctx) => {
    // Two patterns have no single attribute that means "matches both", so projecting either one
    // would tell the browser to accept values the form rejects — or reject ones it accepts.
    const conflicting = factsOfAll([pattern(/^a+$/), pattern(/^b+$/)]);
    ctx.log.note("two patterns on one field", {
      conflicting: conflicting.conflictingPatterns,
      projected: conflicting.constraints.pattern,
    });

    expectClaim(conflicting.conflictingPatterns === true, {
      claimIds: ["VAL-004"],
      what: "two different patterns were not reported as conflicting",
    });

    expectEqual(conflicting.constraints.pattern, null, {
      claimIds: ["VAL-004"],
      what: "one of two conflicting patterns was projected as though it were the rule",
    });

    // The control: one pattern is projected, so the null above is the conflict rather than patterns
    // never being carried.
    expectClaim(factsOfAll([pattern(/^a+$/)]).constraints.pattern !== null, {
      claimIds: ["VAL-004"],
      what: "a single pattern was not projected at all",
    });
  },
);

battle(
  {
    claims: ["VAL-004"],
    title: "composing validators keeps what each of them declared",
    environments: ["node"],
  },
  async (ctx) => {
    // A composed validator is one function to the engine, so whatever it declares is all the field
    // can say about itself. Losing a fact here silently drops a native constraint.
    const both = compose(required(), minLength(3));
    const firstOnly = composeFirst(required(), minLength(3));
    ctx.log.note("facts through a composition", { compose: factsOf(both), composeFirst: factsOf(firstOnly) });

    for (const [name, composed] of [["compose", both], ["composeFirst", firstOnly]]) {
      const facts = factsOf(composed);
      expectClaim(facts.required === true, {
        claimIds: ["VAL-004"],
        what: `${name} lost the required fact of a validator inside it`,
        detail: JSON.stringify(facts),
      });

      expectEqual(facts.minLength, 3, {
        claimIds: ["VAL-004"],
        what: `${name} lost the minLength fact of a validator inside it`,
      });
    }

    // A plain function declares nothing rather than guessing, which is what lets a consumer write
    // one without accidentally promising the browser something.
    expectEqual(factsOf(() => []), {}, {
      claimIds: ["VAL-004"],
      what: "a hand-written validator was read as declaring something it never said",
    });
  },
);
