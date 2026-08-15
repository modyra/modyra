/**
 * A date range the user did not finish choosing.
 *
 * A range picker is modal: it opens on what the form holds, the user clicks around inside it, and
 * only a confirm reaches the model. The state that makes it hard is the one in the middle — a start
 * chosen and no end yet — because it is a value the widget must hold and must never hand over.
 *
 * `dateRangeDraftTransition` is that policy and `dateRangeValueTransition` is the normalisation
 * under it, and neither had a battle. Two ways it goes wrong, and they are opposite: committing a
 * half range writes `{start, end: null}` into a model that expects two dates, and refusing to close
 * leaves a user stuck in a dialog because they changed their mind.
 *
 * The bounds case is here because it is the one that looks like a bug and is not. Opening on a range
 * whose start the bounds no longer allow drops that start — and commits nothing. The model keeps
 * what it held and the rules can judge it, which is the same refusal the select makes: **a widget
 * does not write to the model to make itself consistent.**
 */

import { dateRangeDraftTransition, dateRangeValueTransition } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const HELD = Object.freeze({ start: "2026-01-05", end: "2026-01-09" });
const NOTHING = Object.freeze({ start: null, end: null });
const closed = Object.freeze({ committed: NOTHING, draft: NOTHING, open: false });

battle(
  {
    claims: ["VAL-004", "SUB-001"],
    title: "a range picker hands over two dates or nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // Opened on what the form holds: both halves start from the same place, and nothing is emitted
    // for opening a dialog.
    const opened = dateRangeDraftTransition(closed, { type: "open", committed: HELD });
    expectEqual([opened.state.draft, opened.state.open, opened.commit], [HELD, true, undefined], {
      claimIds: ["VAL-004"],
      what: "opening a picker did not start from the value the form holds, or committed something",
    });

    // A start chosen and no end yet. This is the state the whole policy is about.
    const halfway = dateRangeDraftTransition(opened.state, {
      type: "select",
      value: { start: "2026-02-01", end: null },
    });
    ctx.log.note("a start chosen and no end yet", { state: halfway.state, commit: halfway.commit });

    expectEqual([halfway.state.draft.start, halfway.state.draft.end, halfway.commit], ["2026-02-01", null, undefined], {
      claimIds: ["VAL-004"],
      what: "choosing a start emitted something, or was not held as the draft",
    });

    // Confirming it closes the picker, hands over nothing, and puts back what the form had. A model
    // that received `{start, end: null}` here would hold a range that is not one.
    const confirmedHalf = dateRangeDraftTransition(halfway.state, { type: "confirm" });
    ctx.log.note("confirming a half range", { state: confirmedHalf.state, commit: confirmedHalf.commit });

    expectEqual(confirmedHalf.commit, undefined, {
      claimIds: ["SUB-001", "VAL-004"],
      what: "a range the user had not finished was handed to the model",
    });
    expectEqual([confirmedHalf.state.committed, confirmedHalf.state.draft, confirmedHalf.state.open], [HELD, HELD, false], {
      claimIds: ["VAL-004"],
      what: "confirming a half range left the picker open or holding the half",
    });

    // Cancelling from the same place does the same, and must: a user who changed their mind and one
    // who pressed the wrong button end up with the value they had.
    const cancelled = dateRangeDraftTransition(halfway.state, { type: "cancel" });
    expectEqual([cancelled.commit, cancelled.state.draft, cancelled.state.open], [undefined, HELD, false], {
      claimIds: ["VAL-004"],
      what: "cancelling did not put back the value the form holds",
    });

    // And the whole point of the dialog: a complete range is committed once, on confirm.
    const whole = { start: "2026-02-01", end: "2026-02-03" };
    const picked = dateRangeDraftTransition(opened.state, { type: "select", value: whole });
    const confirmed = dateRangeDraftTransition(picked.state, { type: "confirm" });
    expectEqual([confirmed.commit, confirmed.state.committed, confirmed.state.open], [whole, whole, false], {
      claimIds: ["SUB-001"],
      what: "a range the user finished was not handed over on confirm",
    });
  },
);

battle(
  {
    claims: ["VAL-004"],
    title: "a range keeps its order, and a date outside the bounds is refused rather than moved",
    environments: ["node"],
  },
  async (ctx) => {
    const bounds = { minIso: "2026-01-04", maxIso: "2026-01-10" };

    // An end before its start collapses onto the start rather than swapping: a range that reordered
    // itself would hand back two dates the user never picked together.
    expectEqual(dateRangeValueTransition({ start: "2026-01-09", end: "2026-01-05" }), {
      start: "2026-01-09",
      end: "2026-01-09",
    }, {
      claimIds: ["VAL-004"],
      what: "a range whose end precedes its start was not brought back into order",
    });

    // Refused, not clamped — the same answer the time fields give. A date moved to the bound is a
    // value the user did not choose, presented as though they had.
    for (const [what, value, expected] of [
      ["a start before the floor", { start: "2026-01-01", end: "2026-01-09" }, { start: null, end: "2026-01-09" }],
      ["an end past the ceiling", { start: "2026-01-05", end: "2026-01-31" }, { start: "2026-01-05", end: null }],
      ["both outside", { start: "2026-01-01", end: "2026-01-31" }, { start: null, end: null }],
      ["a date that is not one", { start: "not-a-date", end: "2026-01-09" }, { start: null, end: "2026-01-09" }],
    ]) {
      const outcome = dateRangeValueTransition(value, bounds);
      ctx.log.note("a range against its bounds", { what, value, outcome });
      expectEqual(outcome, expected, {
        claimIds: ["VAL-004"],
        what: `${what}: the date was moved to the bound instead of refused, or the other end went with it`,
      });
    }

    // A filter refuses in the same way, so a picker that hides weekends and a form that rejects them
    // give one answer rather than two.
    const weekdaysOnly = (iso) => {
      const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
      return day !== 0 && day !== 6;
    };
    expectEqual(dateRangeValueTransition({ start: "2026-01-07", end: "2026-01-10" }, { accepts: weekdaysOnly }), {
      start: "2026-01-07",
      end: null,
    }, {
      claimIds: ["VAL-004"],
      what: "a date the filter refuses survived, or took the other end with it",
    });
  },
);
