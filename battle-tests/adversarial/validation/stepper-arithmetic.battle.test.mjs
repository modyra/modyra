/**
 * A price field stepping by ten cents and landing between them.
 *
 * `createValueWidgetController` is the stepper behind every scalar field. Increment and decrement
 * are `current + step` and `current - step`, clamped, and nothing rounds. In binary floating point
 * that is enough to leave the value off the grid the step describes:
 *
 *     0 stepped up by 0.1, five times  ->  0.1, 0.2, 0.30000000000000004, 0.4, 0.5
 *     0.3 stepped down by 0.1          ->  0.19999999999999998
 *
 * A price, a rating, a percentage and a quantity in kilograms all step by a fraction, and the value
 * is what the field shows and what the form submits. `0.30000000000000004` fails a `multipleOf`
 * rule, prints at full width in any control that does not format, and is not equal to the `0.3` a
 * server or a fixture compares it against.
 *
 * The comparison that settles whether this is "floating point being floating point" or a defect is
 * the control this widget replaces. `HTMLInputElement.stepUp()` on `<input type="number"
 * step="0.1">` gives `0.1, 0.2, 0.3, 0.4, 0.5` and `stepDown()` from `0.3` gives `0.2` — measured
 * here in the same process, not recalled. The platform snaps to the step; the widget that stands in
 * for it does not.
 *
 * The battle asserts the property rather than a rounding strategy: after any number of steps the
 * value is a multiple of the step. That leaves the fix free — snap to the step, count in integers,
 * round to the step's decimal places — and fails whichever way it drifts.
 */

import { createValueWidgetController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** How many decimals a step declares, so "on the grid" can be asked without choosing a rounding. */
function decimalsOf(step) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Whether `value` is one of the values `step` describes, starting from `origin`. */
function onGrid(value, step, origin) {
  const places = decimalsOf(step);
  const scaled = Math.round((value - origin) * 10 ** places);
  return Math.abs(scaled - (value - origin) * 10 ** places) < 1e-6 && Number.isInteger(scaled);
}

/** Step a fresh controller `times` and report every value it passed through. */
function stepped(from, step, times, direction = "increment") {
  const controller = createValueWidgetController({ kind: "number", value: from });
  try {
    const seen = [];
    for (let index = 0; index < times; index += 1) {
      controller.dispatch({ type: direction, step });
      seen.push(controller.state().value);
    }
    return seen;
  } finally {
    controller.destroy?.();
  }
}

battle(
  {
    claims: ["UI-007"],
    title: "stepping by a fraction lands on the values the step describes",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [from, step, times] of [[0, 0.1, 5], [0, 0.25, 4], [1, 0.05, 6]]) {
      const seen = stepped(from, step, times);
      const off = seen.filter((value) => !onGrid(value, step, from));
      ctx.log.note("a field stepping by a fraction", { from, step, seen });

      expectEqual(off, [], {
        claimIds: ["UI-007"],
        what: `stepping from ${from} by ${step} produced a value that is not a multiple of the step`,
        detail: JSON.stringify(seen),
      });
    }

    // Down as well as up, since the drift is not symmetric and a fix applied to one is not a fix.
    const down = stepped(0.3, 0.1, 1, "decrement");
    ctx.log.note("a field stepping down by a fraction", { down });

    expectEqual(down, [0.2], {
      claimIds: ["UI-007"],
      what: "stepping down from 0.3 by 0.1 did not land on 0.2",
      detail: JSON.stringify(down),
    });

    // The control: a whole-number step is exact and must stay so, which is what stops a fix being
    // "round everything to two places".
    expectEqual(stepped(0, 1, 3), [1, 2, 3], {
      claimIds: ["UI-007"],
      what: "stepping by a whole number stopped being exact",
    });

    expectEqual(stepped(1000000, 1, 2), [1000001, 1000002], {
      claimIds: ["UI-007"],
      what: "stepping a large whole number lost precision",
    });
  },
);

battle(
  {
    claims: ["UI-007"],
    title: "the control this widget replaces snaps to its step",
    environments: ["node"],
  },
  async (ctx) => {
    // Measured rather than recalled: the assertion above is a defect only if the thing being
    // replaced does better, and this is where that is established.
    const dom = installDocument();
    try {
      const native = dom.document.createElement("input");
      native.type = "number";
      native.step = "0.1";
      native.value = "0";

      const up = [];
      for (let index = 0; index < 5; index += 1) {
        native.stepUp();
        up.push(native.value);
      }

      const back = dom.document.createElement("input");
      back.type = "number";
      back.step = "0.1";
      back.value = "0.3";
      back.stepDown();

      ctx.log.note("the platform's own stepper", { up, down: back.value });

      expectEqual(up, ["0.1", "0.2", "0.3", "0.4", "0.5"], {
        claimIds: ["UI-007"],
        what: "the platform control drifts too, so the widget is not behind it and this claim is wrong",
        detail: JSON.stringify(up),
      });

      expectEqual(back.value, "0.2", {
        claimIds: ["UI-007"],
        what: "the platform control drifts stepping down, so the widget is not behind it",
        detail: JSON.stringify(back.value),
      });
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["UI-007"],
    title: "a stepper leaves alone what it cannot step",
    environments: ["node"],
  },
  async (ctx) => {
    // The boundary, in two halves that pull opposite ways.
    //
    // An empty field steps to the step itself, which is what the platform does — measured:
    // `<input type="number" step="0.1">` with no value stepped up gives "0.1". A number field's
    // value is nullable by contract, so this is the ordinary first press on a fresh field.
    for (const [empty, step, expected] of [[null, 1, 1], [null, 0.1, 0.1], ["", 1, 1]]) {
      const controller = createValueWidgetController({ kind: "number", value: empty });
      controller.dispatch({ type: "increment", step });
      const after = controller.state().value;
      controller.destroy?.();
      ctx.log.note("the first press on an empty number field", { empty, step, after });

      expectEqual(after, expected, {
        claimIds: ["UI-007"],
        what: `the first step on an empty field did not land on the step itself`,
        detail: JSON.stringify({ empty, step, after }),
      });
    }

    // Text that is not a number at all is left as it is. This is a deliberate difference from the
    // platform, which replaces `"abc"` with the step — and the safer half of it, since replacing a
    // value the widget cannot read is the thing that loses a user's data elsewhere in this package.
    for (const value of ["abc", undefined]) {
      const controller = createValueWidgetController({ kind: "number", value });
      controller.dispatch({ type: "increment", step: 1 });
      const after = controller.state().value;
      controller.destroy?.();
      ctx.log.note("stepping something that is not a number at all", { value, after });

      expectEqual(after, value, {
        claimIds: ["UI-007"],
        what: `stepping ${JSON.stringify(value) ?? "undefined"} replaced it instead of leaving it alone`,
        detail: JSON.stringify(after),
      });
    }

    // A step that overshoots the declared bound stops at the bound.
    const clamped = createValueWidgetController({ kind: "number", value: 9 });
    clamped.dispatch({ type: "increment", step: 5, max: 10 });
    const atMax = clamped.state().value;
    clamped.destroy?.();

    expectEqual(atMax, 10, {
      claimIds: ["UI-007"],
      what: "a step past the declared maximum did not stop at it",
    });

    const floored = createValueWidgetController({ kind: "number", value: 1 });
    floored.dispatch({ type: "decrement", step: 5, min: 0 });
    const atMin = floored.state().value;
    floored.destroy?.();

    expectEqual(atMin, 0, {
      claimIds: ["UI-007"],
      what: "a step past the declared minimum did not stop at it",
    });
  },
);
