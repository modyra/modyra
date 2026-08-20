/**
 * Twenty-four numbers on the face, and the twelve of them no intent can name.
 *
 * `timepickerDialNumbers("hour", "24h")` draws two rings: 1–12 outside, then `00` and 13–23 inside,
 * at the same positions. That is the contract's own statement of what a 24-hour picker offers.
 *
 * The draft it edits is canonically 12-hour — `{ hour: 1-12, minute, period }` — so the afternoon is
 * reached through `period`, and a 24-hour picker has no period control because AM and PM are not
 * things it shows. `set-hour` refuses anything outside 1–12 and refuses it **silently**, which is
 * how a face with twelve unreachable numbers went unremarked for the life of the feature.
 *
 * The consequence is not "stuck on PM". It is **stuck wherever the draft started**, and the draft
 * starts from the system clock when the field is empty:
 *
 *     seeded from "21:00"   ask for 9,  wanting 09:00   ->   21:00
 *     seeded from "09:00"   ask for 15, wanting 15:00   ->   03:00
 *
 * So which half of the day a person can enter depends on what time it was when they opened the
 * picker, or on what the field already held. Half of every day is unreachable, and which half is
 * decided by something they cannot see.
 *
 * Asked through the controller rather than a rendered page, because the hole is in the vocabulary: a
 * renderer cannot express the choice it drew, so no amount of correct wiring in plain, lit or Angular
 * would close it. The browser tier covers the wiring; this covers what there is to wire.
 *
 * Green when every hour the face offers is one the picker can be set to.
 */

import { createForm, field } from "@modyra/core";
import { createTimepickerFieldController, timepickerDialNumbers } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A picker over its own field, opened, in the format asked for. */
function picker(format, initial = "") {
  const form = createForm({ t: field(initial) }, { devWarnings: false });
  const controller = createTimepickerFieldController({
    widgetId: "w",
    handle: form.f.t,
    format,
  });
  controller.dispatch({ type: "open" });
  return { controller, handle: form.f.t, form };
}

/** What the field holds after the picker is asked for `hour` and confirmed. */
function committedAfterAsking(format, initial, hour) {
  const { controller, handle, form } = picker(format, initial);
  controller.dispatch({ type: "set-hour", hour });
  controller.dispatch({ type: "set-minute", minute: 0 });
  controller.dispatch({ type: "confirm" });
  const value = handle.value();
  form.destroy();
  return value;
}

battle(
  {
    claims: ["UI-011", "UI-009"],
    title: "every hour a 24-hour face offers is one the picker can be set to",
    environments: ["node"],
  },
  async (ctx) => {
    const face = timepickerDialNumbers("hour", "24h");
    const offered = face.map((number) => number.value);
    ctx.log.note("the face the contract draws", { count: face.length, offered });

    // The premise: this is the two-ring face and not the twelve-number one. A 24-hour picker that
    // drew only 1–12 would make everything below true for an uninteresting reason.
    expectClaim(face.length === 24 && offered.includes(13) && offered.includes(0), {
      claimIds: ["UI-009"],
      what: "the 24-hour face does not offer the afternoon hours, so there is nothing here to be unable to choose",
      detail: JSON.stringify(offered),
    });

    // The control, and the reason this is a contract defect rather than a renderer one: in 12-hour
    // form the period is reachable, so every hour the face offers can be reached.
    const twelve = picker("12h");
    twelve.controller.dispatch({ type: "set-hour", hour: 9 });
    twelve.controller.dispatch({ type: "set-minute", minute: 0 });
    twelve.controller.dispatch({ type: "set-period", period: "AM" });
    twelve.controller.dispatch({ type: "confirm" });
    const twelveHourResult = twelve.handle.value();
    twelve.form.destroy();
    ctx.log.note("the same picker in 12-hour form", { asked: "9 AM", committed: twelveHourResult });
    expectClaim(twelveHourResult === "09:00", {
      claimIds: ["UI-011"],
      what: "a 12-hour picker cannot commit an ordinary morning time either, so the defect below is not about the format",
      detail: `committed ${JSON.stringify(twelveHourResult)}`,
    });

    // Every number the face draws, asked for from a picker seeded on the other side of noon, so that
    // an hour which only appears to work by inheriting the draft's half is caught.
    const unreachable = [];
    for (const number of face) {
      const expected = `${String(number.value).padStart(2, "0")}:00`;
      const seed = number.value < 12 ? "21:00" : "09:00";
      const committed = committedAfterAsking("24h", seed, number.value);
      if (committed !== expected) unreachable.push(`${number.label} (${number.ring}): asked ${number.value}, got ${committed}`);
    }
    ctx.log.note("each hour of the face, asked for from the opposite half of the day", {
      offered: face.length,
      unreachable: unreachable.length,
    });

    expectEqual(unreachable, [], {
      claimIds: ["UI-011", "UI-009"],
      what: "an hour the face offers cannot be committed, so which half of the day a person can enter is decided by what the field already held",
    });
  },
);
