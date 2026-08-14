/**
 * Opening a picker on a value it cannot read, and losing the value.
 *
 * The rule is written down in this package, in `options-reconciliation`, about a different control:
 * **the widget does not write to the model to make itself consistent** — because "erasing the value
 * destroys the one thing that would let the user fix it", and a value that arrived from outside is
 * exactly the row a person has to see in order to resolve it.
 *
 * The timepicker seeded its draft with
 * `parseAnyTime(handle.value(), format) ?? currentTimeAsParsed()`, and `parseAnyTime` read only the
 * configured notation — a `"12h"` picker read `"10:37 AM"` and not `"10:37"`. A value in the other
 * notation parsed to `null`, the draft became **the current wall-clock time**, and confirming wrote
 * that over a time the user could see on the field.
 *
 * Both notations are read now, so what this battle guards is the property rather than the bug: the
 * **instant** a field holds survives being opened and confirmed. That is deliberately not the same
 * as the string surviving. A `"12h"` picker handed `"22:37"` writes back `"10:37 PM"` — the same
 * moment, in the notation the field declares — and normalising the representation is what this
 * package already does when it replaces a loosely matched option value with the option's own.
 *
 * Asserting the string instead would demand that the output depend on whether the dial moved, which
 * makes the same user action produce different data for invisible reasons.
 *
 * Midnight and noon are in the fixtures because they are where a twelve-hour conversion goes wrong
 * and where an off-by-twelve is invisible in every other case: `"00:15"` is `12:15 AM`, not
 * `0:15 AM`, and `"12:00"` is `12:00 PM`, not `12:00 AM`.
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

/**
 * The instant a formatted time names, as minutes past midnight.
 *
 * Written here rather than taken from the package, so that a change to the engine's own parsing
 * cannot make this battle agree with it by construction.
 */
function minutesPastMidnight(text) {
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(text));
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12;
    const afternoon = twelveHour[3].toUpperCase() === "PM";
    return (hour + (afternoon ? 12 : 0)) * 60 + Number(twelveHour[2]);
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(String(text));
  return twentyFour ? Number(twentyFour[1]) * 60 + Number(twentyFour[2]) : null;
}

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
    // The control: a value in the picker's own notation comes back unchanged, character for
    // character. Where the notation already matches there is nothing to normalise, so a failure
    // here would be confirm overwriting rather than confirm normalising.
    const readable = openAndConfirm("10:37 AM");
    ctx.log.note("a value the picker can read", readable);

    expectEqual(readable.held, "10:37 AM", {
      claimIds: ["UI-006"],
      what: "a value in the picker's own notation did not survive being opened and confirmed",
      detail: JSON.stringify(readable),
    });

    // And the notations the field may hold that the picker was not configured for. The moment has
    // to survive; the spelling is the field's to declare.
    for (const [written, format] of [
      ["10:37", "12h"],
      ["22:37", "12h"],
      ["07:05", "12h"],
      ["00:15", "12h"],
      ["12:00", "12h"],
      ["10:37 AM", "24h"],
      ["10:37 PM", "24h"],
      ["12:00 AM", "24h"],
    ]) {
      const outcome = openAndConfirm(written, { format });
      const before = minutesPastMidnight(written);
      const after = minutesPastMidnight(outcome.held);
      ctx.log.note("a field whose notation is not the picker's", { written, format, ...outcome, before, after });

      expectEqual(after, before, {
        claimIds: ["UI-006"],
        what: `a time field holding ${JSON.stringify(written)} named a different moment after being opened and confirmed`,
        detail: JSON.stringify({ written, format, held: outcome.held, before, after }),
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
