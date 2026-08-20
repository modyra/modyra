/**
 * The options object handed to the parameter before it.
 *
 * `field(initial, validators = [], options?)`. The third argument is where `sensitive`, `when`,
 * `sanitize` and the async settings live, and it is the argument a reader reaches for — so the
 * mistake is putting it second, or passing one validator where a list belongs.
 *
 * The third argument is guarded twice: a misspelled sanitizer is refused by name, with the set that
 * would have worked. **The second is guarded by nothing.** It is stored as written, and the failure
 * arrives later, from inside, in the words of a private member:
 *
 *     field("", { sensitive: true })        accepted — validators is now an object
 *       then createForm(...)                node.validators.some is not a function
 *     field("", () => null)                 the same
 *     field("", null)                       Cannot read properties of null (reading 'some')
 *
 * None of the three names `field`, the argument, or the options object the author meant. A reader
 * looking for `validators` in their own code finds it where they put it, spelled correctly, and the
 * message is about a member of a node they never wrote.
 *
 * ADR 0057 already decided this, and named this case: *"The list-taking setters refuse anything that
 * is not an array of functions, by the same rule."* The rule reached the setters and not the
 * constructor, which is the shape of the sanitizer comment beside it — a repair that reached the form
 * and left the field one level down.
 *
 * Green when the door that takes the argument refuses it, saying what it got and where it belongs.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What a call does: the message it refuses with, or how far the mistake travelled. */
function outcome(build) {
  try {
    build();
    return { refused: false, message: null };
  } catch (error) {
    return { refused: true, message: error.message };
  }
}

/** Whether a message is one this project wrote, rather than one the runtime produced. */
const isOurs = (message) => typeof message === "string" && message.startsWith("[modyra]");

battle(
  {
    claims: ["API-001"],
    title: "a constructor refuses an argument of the wrong shape where it arrives",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the neighbouring argument is guarded, and guarded the way ADR 0057 asks — the
    // message names what was wrong and what would have worked. Without it, "no message" would be
    // this door's habit rather than a gap in it.
    const neighbour = outcome(() => field("", [], { sanitize: "stict" }));
    ctx.log.note("the argument beside it, given a value it cannot take", neighbour);
    expectClaim(neighbour.refused && isOurs(neighbour.message), {
      claimIds: ["API-001"],
      what: "the options argument is not guarded either, so this battle is about the door rather than about one parameter",
      detail: JSON.stringify(neighbour),
    });

    // Every wrong shape a reader plausibly puts there: the options object, one validator instead of a
    // list, and the two empties. Asked at the constructor, which is where the argument arrives.
    const wrong = {
      "the options object": () => field("", { sensitive: true }),
      "one validator, not a list": () => field("", () => null),
      "null": () => field("", null),
      "a validator's name": () => field("", "required"),
    };
    const atTheConstructor = Object.fromEntries(
      Object.entries(wrong).map(([name, build]) => [name, outcome(build)]),
    );
    ctx.log.note("a wrong shape in the validators position", atTheConstructor);

    // And where it does surface, so the report says what a reader sees instead of only that nothing
    // was said. A form is the next door, and the mistake is a node's member by the time it speaks.
    const atTheForm = Object.fromEntries(
      Object.entries(wrong).map(([name, build]) => [
        name,
        outcome(() => createForm({ a: build() }, { devWarnings: false })),
      ]),
    );
    ctx.log.note("the same mistake, one door later", atTheForm);

    // The control on the sweep: the mistake has to actually be a mistake. A shape that builds a form
    // and works is not one this battle should ask anything about.
    expectEqual(
      Object.entries(atTheForm).filter(([, result]) => !result.refused).map(([name]) => name),
      [],
      {
        claimIds: ["API-001"],
        what: "a shape in the validators position was taken all the way to a working form, so it is not a wrong shape and does not belong in this sweep",
      },
    );

    expectEqual(
      Object.entries(atTheConstructor).filter(([, result]) => !result.refused).map(([name]) => name),
      [],
      {
        claimIds: ["API-001"],
        what: "a constructor stored an argument it cannot use, so the call that could not do what it was asked said nothing and the failure arrives from somewhere else",
        detail: JSON.stringify(atTheForm),
      },
    );

    // Refusing is half of it. ADR 0057 asks for the parameter and the shape received, and a message
    // the runtime wrote names neither: a reader is sent to a member of a node they did not write.
    expectEqual(
      Object.entries(atTheConstructor)
        .filter(([, result]) => result.refused && !isOurs(result.message))
        .map(([name, result]) => `${name}: ${result.message}`),
      [],
      {
        claimIds: ["API-001"],
        what: "a wrong argument surfaces as a message this project did not write, so it names an internal member rather than the parameter",
      },
    );
  },
);
