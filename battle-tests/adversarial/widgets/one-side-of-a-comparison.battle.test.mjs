/**
 * A comparison that guards one of its two arguments.
 *
 * `colorValueEquals(left, right)` is published, and it is what decides whether a colour field has
 * changed — whether the swatch redraws, whether the field is dirty, whether a draft is written.
 *
 * It reads `(left ?? "").toLowerCase() === right.toLowerCase()`. The `?? ""` on the left says plainly
 * that the author expected to be handed nothing sometimes. The right has no such guard, so the same
 * nothing on the other side is a `TypeError` rather than an answer — including the case a caller
 * comparing two absent values arrives at, where the question is easiest and the answer is obvious.
 *
 * The value contract says a colour is a non-nullable string, so a renderer following it holds strings
 * on both sides and never sees this. That is why it is small. It is also why it is worth one line:
 * the function is published, a consumer may hold a colour that is not set yet, and the guard on the
 * left is the evidence that they were expected to.
 *
 * `colorValueTransition` is pinned alongside it, green, because nothing had exercised it either and
 * it is the parser standing between a typed string and a value.
 */

import { colorValueEquals, colorValueTransition } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Compare two colours, reporting a throw as a throw rather than letting it end the battle. */
function compare(left, right) {
  try {
    return colorValueEquals(left, right);
  } catch (error) {
    return `threw ${String(error?.name ?? "")}`;
  }
}

battle(
  {
    claims: ["UI-006", "API-001"],
    title: "comparing two colours answers, whichever of them is missing",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: it compares colours, and it does not care about case — which is the whole reason
    // a comparison exists here rather than `===`.
    expectEqual([compare("#fff", "#fff"), compare("#FFF", "#fff"), compare("#ffffff", "#FFFFFF")], [true, true, true], {
      claimIds: ["UI-006"],
      what: "two colours written differently in case were not read as the same colour",
    });

    expectEqual([compare("#fff", "#eee"), compare("#fff", "#ffffff")], [false, false], {
      claimIds: ["UI-006"],
      what: "two different colours were read as the same one",
    });

    // The guard that exists, which is what says the absent case was expected at all.
    expectEqual(compare(null, "#fff"), false, {
      claimIds: ["API-001"],
      what: "a missing colour on the guarded side no longer answers, so there is nothing asymmetric to report",
    });

    // And the same absence on the other side.
    const answers = {
      rightNull: compare("#fff", null),
      rightUndefined: compare("#fff", undefined),
      bothNull: compare(null, null),
    };
    ctx.log.note("the same absence, on the unguarded side", answers);

    expectEqual(answers, { rightNull: false, rightUndefined: false, bothNull: true }, {
      claimIds: ["API-001", "UI-006"],
      what: "comparing against a colour that is not set throws instead of answering, including when neither is set",
      detail: JSON.stringify(answers),
    });
  },
);

battle(
  {
    claims: ["UI-006", "VAL-004"],
    title: "the hex a colour box will take",
    environments: ["node"],
  },
  async (ctx) => {
    const typed = (value) => colorValueTransition({ type: "input", value });

    // Three digits or six, with or without the hash, and whitespace is not part of a colour.
    for (const [raw, expected] of [
      ["#fff", "#fff"], ["fff", "#fff"], ["#ffffff", "#ffffff"], [" #fff ", "#fff"], ["#FFF", "#FFF"],
    ]) {
      expectEqual(typed(raw).value, expected, {
        claimIds: ["UI-006"],
        what: `${JSON.stringify(raw)} was not read as ${expected}`,
      });
    }

    // Everything that is not a colour leaves the value alone rather than writing a broken one.
    for (const raw of ["#ff", "#ffff", "#ffffffff", "#gggggg", ""]) {
      const outcome = typed(raw);
      ctx.log.note("something typed into a colour box", { raw, outcome });

      expectEqual(outcome.value, undefined, {
        claimIds: ["VAL-004"],
        what: `${JSON.stringify(raw)} was written into a colour field`,
      });
    }

    // Choosing a preset is the one input that both commits and closes; typing is neither.
    expectEqual(
      [colorValueTransition({ type: "preset", value: "#fff" }), colorValueTransition({ type: "preset", value: "nope" })],
      [{ value: "#fff", close: true, touched: true }, { value: undefined, close: false, touched: false }],
      {
        claimIds: ["UI-006"],
        what: "choosing a preset did not commit and close, or an unreadable one did",
      },
    );
  },
);
