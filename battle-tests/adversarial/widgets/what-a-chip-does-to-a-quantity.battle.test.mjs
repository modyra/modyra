/**
 * The published answer to "what does pressing this do", for a value that can hold the same thing
 * twice.
 *
 * A multiselect holds `option[]`, and that array is deliberately a multiset: the chip classes carry
 * `counter`, `count` and `step`, which are the parts of a chip that shows a quantity and steps it.
 * So there are two different presses, and `multiselectValueTransition` is where the difference is
 * written down.
 *
 * A toggle clears the option — every occurrence of it, because a toggle answers "is this chosen",
 * and the answer after pressing it is no. A `decrement` takes one away, because that chip answers
 * "how many", and one fewer is still some. Confusing the two is invisible until a value arrives
 * holding the same option twice, from a document, a draft or a server, at which point a toggle that
 * decrements leaves the chip pressed and the user pressing it again.
 *
 * Pinned here because it is the reference a renderer is supposed to follow, and because nothing in
 * this suite had named the function.
 */

import { multiselectValueTransition } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/** The same option held three times, which no control can produce and every ingress can. */
const THRICE = Object.freeze(["a", "a", "a"]);

battle(
  {
    claims: ["UI-006", "COL-002"],
    title: "a toggle clears the option and a step takes one away",
    environments: ["node"],
  },
  async (ctx) => {
    const answers = {
      toggle: multiselectValueTransition(THRICE, { type: "toggle", value: "a" }),
      untyped: multiselectValueTransition(THRICE, { value: "a" }),
      decrement: multiselectValueTransition(THRICE, { type: "decrement", value: "a" }),
      increment: multiselectValueTransition(THRICE, { type: "increment", value: "a" }),
      clear: multiselectValueTransition(THRICE, { type: "clear", value: "a" }),
    };
    ctx.log.note("what each intent does to the same option held three times", answers);

    // The toggle is the whole point: pressing a chip that is on turns it off, and off means none.
    expectEqual(answers.toggle, [], {
      claimIds: ["UI-006"],
      what: "a toggle left occurrences of an option behind, so the chip it was pressed on stays pressed",
    });

    // An intent with no type is the toggle, which is what a chip sends when it says nothing else.
    expectEqual(answers.untyped, [], {
      claimIds: ["UI-006"],
      what: "an intent with no type is no longer the toggle",
    });

    // And the other chip, the one that counts.
    expectEqual(answers.decrement, ["a", "a"], {
      claimIds: ["COL-002"],
      what: "a step down did not take exactly one occurrence away",
    });

    expectEqual(answers.increment, ["a", "a", "a", "a"], {
      claimIds: ["COL-002"],
      what: "a step up did not add an occurrence, so a quantity cannot be raised past one",
    });

    expectEqual(answers.clear, [], {
      claimIds: ["UI-006"],
      what: "clearing left something behind",
    });
  },
);

battle(
  {
    claims: ["UI-006"],
    title: "a toggle on an option nobody chose chooses it",
    environments: ["node"],
  },
  async (ctx) => {
    // The other half of the toggle, so the emptiness above is the toggle turning something off
    // rather than a transition that always answers with nothing.
    expectEqual(multiselectValueTransition(["a"], { type: "toggle", value: "b" }), ["a", "b"], {
      claimIds: ["UI-006"],
      what: "a toggle on an option that was not chosen did not choose it",
    });

    expectEqual(multiselectValueTransition([], { type: "toggle", value: "a" }), ["a"], {
      claimIds: ["UI-006"],
      what: "a toggle on an empty value chose nothing",
    });

    // A step down on something not held is not a way to hold it.
    expectEqual(multiselectValueTransition(["a"], { type: "decrement", value: "b" }), ["a"], {
      claimIds: ["UI-006"],
      what: "stepping down an option that is not held changed the value",
    });

    // Identity is the caller's to define, and the transition has to use it rather than a comparison
    // of its own — an option whose value is an object is otherwise never found.
    const options = [{ id: 1 }, { id: 2 }];
    ctx.log.note("options a domain would write", { options });

    expectEqual(
      multiselectValueTransition(options, { type: "toggle", value: { id: 1 } }, (each) => String(each.id)),
      [{ id: 2 }],
      {
        claimIds: ["UI-006"],
        what: "the caller's identity function was not used, so an option that is not a string can never be turned off",
      },
    );
  },
);
