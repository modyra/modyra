/**
 * Opening a picker on a value it cannot read, and losing the value.
 *
 * The rule is written down in this package, in `options-reconciliation`, about a different control:
 * **the widget does not write to the model to make itself consistent** — because "erasing the value
 * destroys the one thing that would let the user fix it", and a value that arrived from outside is
 * exactly the row a person has to see in order to resolve it.
 *
 * The timepicker seeds its draft with
 * `parseAnyTime(handle.value(), format) ?? currentTimeAsParsed()`. `parseAnyTime` is strict per
 * format — a `"12h"` picker reads `"10:37 AM"` and not `"10:37"` — so a value in the other notation
 * parses to `null` and the draft becomes **the current wall-clock time**. Confirming writes that.
 *
 *     field holds "10:37 AM", 12h picker  ->  draft 10:37 AM      (correct)
 *     field holds "10:37",    12h picker  ->  draft = now, and confirm writes now
 *
 * A user opens the picker on a field that already shows a time, sees a different time on the dial,
 * and pressing the confirm button — which is what the dial is for — replaces what they had. Cancel
 * preserves it, so the loss requires the user to do the ordinary thing rather than the careful one.
 *
 * The mismatched value is reachable without anyone doing anything strange: a draft written by a
 * build configured `"24h"` and restored into one configured `"12h"`, an API or a `patch` supplying
 * the other notation, or a document whose author wrote the value by hand. `MDY_VALUE_CONTRACTS`
 * declares a timepicker's value nullable and says nothing about which notation it is in.
 *
 * `null` is the case where "now" is the right answer and it is asserted as such: an empty picker
 * opening at the current time is what every picker does, and a fix must not take that away.
 */

import { createForm, field } from "@modyra/core";
import {
  createDaterangeFieldController,
  createDatepickerFieldController,
  createTimepickerFieldController,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Open a picker over a field holding `initial`, confirm, and report what the field ends up with. */
function openAndConfirm(initial, options = {}) {
  const form = createForm({ v: field(initial) }, { devWarnings: false });
  const controller = createTimepickerFieldController({ widgetId: "w", handle: form.f.v, ...options });
  try {
    controller.dispatch({ type: "open" });
    const draft = controller.state().draft;
    controller.dispatch({ type: "confirm" });
    return { draft, held: form.getValue().v };
  } finally {
    controller.destroy?.();
    form.destroy();
  }
}

battle(
  {
    claims: ["UI-006"],
    title: "opening a picker and confirming keeps the time the field already held",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a value in the picker's own notation round-trips, so a failure below is the
    // notation rather than confirm always overwriting.
    const readable = openAndConfirm("10:37 AM");
    ctx.log.note("a value the picker can read", readable);

    expectEqual(readable.held, "10:37 AM", {
      claimIds: ["UI-006"],
      what: "a value in the picker's own notation did not survive being opened and confirmed",
      detail: JSON.stringify(readable),
    });

    // And one it cannot. The user did nothing but open the dial and press the button it is for.
    for (const written of ["10:37", "22:37", "07:05"]) {
      const outcome = openAndConfirm(written);
      ctx.log.note("a value the picker cannot read in its configured notation", { written, ...outcome });

      expectClaim(outcome.held === written, {
        claimIds: ["UI-006"],
        what: `a time field holding ${JSON.stringify(written)} was replaced by opening the picker and confirming`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);

battle(
  {
    claims: ["UI-006"],
    title: "an empty picker still opens at the current time",
    environments: ["node"],
  },
  async (ctx) => {
    // The boundary. A picker over an empty field has nothing to preserve, and opening at now is
    // what every picker does — a fix that made the empty case open at midnight, or refuse to open,
    // would be a worse widget.
    const empty = openAndConfirm(null);
    ctx.log.note("a picker over an empty field", empty);

    expectClaim(empty.draft !== null && empty.draft !== undefined, {
      claimIds: ["UI-006"],
      what: "a picker over an empty field has no draft to show, so it opens on nothing",
      detail: JSON.stringify(empty),
    });

    expectClaim(typeof empty.held === "string" && empty.held.length > 0, {
      claimIds: ["UI-006"],
      what: "confirming an empty picker wrote nothing, so a user cannot fill the field from the dial",
      detail: JSON.stringify(empty),
    });

    // And cancelling preserves whatever was there, in both notations — which is what makes the
    // failure above about confirm rather than about opening.
    for (const written of ["10:37 AM", "10:37"]) {
      const form = createForm({ v: field(written) }, { devWarnings: false });
      const controller = createTimepickerFieldController({ widgetId: "w", handle: form.f.v });
      controller.dispatch({ type: "open" });
      controller.dispatch({ type: "cancel" });
      const held = form.getValue().v;
      controller.destroy?.();
      form.destroy();

      expectEqual(held, written, {
        claimIds: ["UI-006"],
        what: `cancelling a picker over ${JSON.stringify(written)} changed the field anyway`,
      });
    }
  },
);

battle(
  {
    claims: ["UI-006"],
    title: "the pickers beside it read what they can and change nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // The comparison that makes the failure above a defect rather than a house style: the date
    // pickers face the same situation and answer it the other way. A value they cannot parse moves
    // the *view* to the current month — which is display, and the right fallback — and leaves the
    // value alone.
    for (const written of ["2026-06-15", "15/06/2026", "June 15, 2026", "2026-13-45", ""]) {
      const form = createForm({ v: field(written) }, { devWarnings: false });
      const controller = createDatepickerFieldController({ widgetId: "w", handle: form.f.v });
      controller.dispatch({ type: "open" });
      const viewed = controller.state().viewMonth ?? null;
      controller.dispatch({ type: "close" });
      const held = form.getValue().v;
      controller.destroy?.();
      form.destroy();

      ctx.log.note("a date picker over a value it may not be able to read", { written, viewed, held });

      expectEqual(held, written, {
        claimIds: ["UI-006"],
        what: `a date field holding ${JSON.stringify(written)} was changed by opening and closing the picker`,
      });
    }

    // And the range picker, which holds two of them.
    for (const written of [
      { start: "2026-01-01", end: "2026-01-05" },
      { start: "01/01/2026", end: "05/01/2026" },
    ]) {
      const form = createForm({ v: field(written) }, { devWarnings: false });
      const controller = createDaterangeFieldController({ widgetId: "w", handle: form.f.v });
      controller.dispatch({ type: "open" });
      controller.dispatch({ type: "close" });
      const held = form.getValue().v;
      controller.destroy?.();
      form.destroy();

      expectEqual(held, written, {
        claimIds: ["UI-006"],
        what: `a range field holding ${JSON.stringify(written)} was changed by opening and closing the picker`,
      });
    }
  },
);
