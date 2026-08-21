/**
 * Which times a picker offers, and what it says about a declaration it cannot honour.
 *
 * The refusals are the substance here. A step that does not divide its unit produces a rule the
 * author did not write — `minuteStep: 7` offers 0, 7 … 56 and then jumps four minutes — and a picker
 * that merely behaved oddly at 56 past would send whoever wrote it looking in the wrong place.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  explainGranularityProblem,
  isOnStep,
  MDY_EVERY_TIME,
  minutesOfDay,
  stepValues,
  timeStepsAt,
  validateTimeGranularity,
} from "../dist/index.js";

test("no declaration offers every time", () => {
  assert.deepEqual(timeStepsAt(undefined, 9), MDY_EVERY_TIME);
  assert.deepEqual(timeStepsAt({}, 9), { hourStep: 1, minuteStep: 1 });
});

test("a field's own step applies at every hour", () => {
  const g = { minuteStep: 15, hourStep: 2 };
  for (const hour of [0, 9, 23]) assert.deepEqual(timeStepsAt(g, hour), { hourStep: 2, minuteStep: 15 });
});

test("a window's step overrides the field's, inside it and not outside", () => {
  const g = { minuteStep: 30, windows: [{ from: "09:00", to: "12:00", minuteStep: 5 }] };
  assert.equal(timeStepsAt(g, 8).minuteStep, 30);
  assert.equal(timeStepsAt(g, 9).minuteStep, 5, "the hour it starts at is inside");
  assert.equal(timeStepsAt(g, 11).minuteStep, 5);
  // Half-open: a window ending at 12:00 does not claim noon, which is what lets the next one start
  // there without an overlap to refuse.
  assert.equal(timeStepsAt(g, 12).minuteStep, 30);
});

test("adjacent windows tile without a gap and without an overlap", () => {
  const g = {
    windows: [
      { from: "09:00", to: "12:00", minuteStep: 5 },
      { from: "12:00", to: "18:00", minuteStep: 30 },
    ],
  };
  assert.deepEqual(validateTimeGranularity(g), []);
  assert.equal(timeStepsAt(g, 11).minuteStep, 5);
  assert.equal(timeStepsAt(g, 12).minuteStep, 30);
});

test("a step that does not divide its unit is refused by name", () => {
  const problems = validateTimeGranularity({ minuteStep: 7, hourStep: 5 });
  assert.deepEqual(problems.map((p) => [p.member, p.reason]), [
    ["minuteStep", "must-divide"],
    ["hourStep", "must-divide"],
  ]);
  assert.equal(
    explainGranularityProblem(problems[0]),
    "minuteStep is 7, which does not divide 60",
  );
});

test("a step that does divide is accepted, at both ends of the range", () => {
  for (const minuteStep of [1, 5, 15, 30, 60]) {
    assert.deepEqual(validateTimeGranularity({ minuteStep }), [], `${minuteStep} divides 60`);
  }
  for (const hourStep of [1, 2, 12, 24]) {
    assert.deepEqual(validateTimeGranularity({ hourStep }), [], `${hourStep} divides 24`);
  }
  // Not integers, not positive, larger than the unit: all the same refusal.
  for (const minuteStep of [0, -5, 2.5, 90]) {
    assert.equal(validateTimeGranularity({ minuteStep }).length, 1, `${minuteStep} is refused`);
  }
});

test("overlapping windows are refused, and each names the one it collides with", () => {
  const problems = validateTimeGranularity({
    windows: [
      { from: "09:00", to: "13:00", minuteStep: 5 },
      { from: "12:00", to: "18:00", minuteStep: 30 },
    ],
  });
  assert.deepEqual(problems, [{ member: "windows", reason: "overlap", index: 1, other: 0 }]);
  assert.equal(
    explainGranularityProblem(problems[0]),
    "windows[1] overlaps windows[0], so two steps claim the same minutes",
  );
});

test("a window that covers nothing, or names a time nobody can read, is refused", () => {
  const empty = validateTimeGranularity({ windows: [{ from: "12:00", to: "12:00", minuteStep: 5 }] });
  assert.deepEqual(empty, [{ member: "windows", reason: "empty-range", index: 0 }]);

  const unreadable = validateTimeGranularity({ windows: [{ from: "9am", to: "25:00", minuteStep: 5 }] });
  assert.deepEqual(unreadable.map((p) => p.value), ["9am", "25:00"]);
});

test("every problem is reported, not the first", () => {
  const problems = validateTimeGranularity({
    minuteStep: 7,
    windows: [{ from: "nope", to: "12:00", minuteStep: 13 }],
  });
  assert.equal(problems.length, 3, JSON.stringify(problems));
});

test("minutesOfDay reads a time of day and refuses what is not one", () => {
  assert.equal(minutesOfDay("00:00"), 0);
  assert.equal(minutesOfDay("9:30"), 570);
  assert.equal(minutesOfDay("23:59"), 1439);
  for (const text of ["", "24:00", "12:60", "12", "noon", "12:5"]) {
    assert.equal(minutesOfDay(text), null, `${text} is not a time of day`);
  }
});

test("what sits on a step, and what a step offers", () => {
  assert.equal(isOnStep(15, 5), true);
  assert.equal(isOnStep(7, 5), false);
  // Step 1 accepts everything, which is what "no declaration" means.
  assert.equal(isOnStep(7, 1), true);
  assert.deepEqual(stepValues(60, 15), [0, 15, 30, 45]);
  assert.deepEqual(stepValues(24, 6), [0, 6, 12, 18]);
  assert.equal(stepValues(60, 1).length, 60);
});

// ─── what the three functions do once a step is in force ─────────────────────

const { acceptTimeField, stepTimeField, timeFieldBounds, timepickerDialNumbers } =
  await import("../dist/index.js");

const EVERY_QUARTER = { hourStep: 1, minuteStep: 15 };

test("a minute the field does not offer is refused as off-step, not as out of range", () => {
  const rejected = acceptTimeField("minute", "24h", "07", EVERY_QUARTER);
  // The two are different sentences: "there is no 61st minute" and "this field takes quarter hours".
  assert.equal(rejected.type, "rejected");
  assert.equal(rejected.reason, "off-step");
  assert.deepEqual(rejected.bounds, { min: 0, max: 59, step: 15 });

  for (const minute of ["0", "15", "30", "45"]) {
    assert.equal(acceptTimeField("minute", "24h", minute, EVERY_QUARTER).type, "accepted", minute);
  }
  // Still out of range rather than off-step, because the range is judged first.
  assert.equal(acceptTimeField("minute", "24h", "75", EVERY_QUARTER).reason, "out-of-range");
});

test("a 12-hour clock's hours are counted from its own start", () => {
  const everyOther = { hourStep: 2, minuteStep: 1 };
  // Counting from 1 rather than from 0: a 12-hour clock offers 1, 3, 5 …, not the 24-hour clock's
  // even hours renumbered.
  assert.equal(acceptTimeField("hour", "12h", "1", everyOther).type, "accepted");
  assert.equal(acceptTimeField("hour", "12h", "3", everyOther).type, "accepted");
  assert.equal(acceptTimeField("hour", "12h", "2", everyOther).reason, "off-step");
  // A 24-hour clock starts at 0, so its offered hours are the even ones.
  assert.equal(acceptTimeField("hour", "24h", "2", everyOther).type, "accepted");
  assert.equal(acceptTimeField("hour", "24h", "3", everyOther).reason, "off-step");
});

test("the arrows move by the step, and wrap on the values that are offered", () => {
  assert.equal(stepTimeField("minute", "24h", 0, 1, EVERY_QUARTER), 15);
  assert.equal(stepTimeField("minute", "24h", 45, 1, EVERY_QUARTER), 0, "wraps past the last offered");
  assert.equal(stepTimeField("minute", "24h", 0, -1, EVERY_QUARTER), 45, "and back to it");
});

test("a value the field does not offer is left alone until the user moves off it", () => {
  // ADR 0063: never rounded. Stepping is how a user *leaves* a value the field will not take, so it
  // lands on an offered one in the direction they are going.
  assert.equal(stepTimeField("minute", "24h", 7, 1, EVERY_QUARTER), 15);
  assert.equal(stepTimeField("minute", "24h", 7, -1, EVERY_QUARTER), 0);
});

test("a step that does not divide the range still lands on offered values", () => {
  // A 12-hour clock stepping by 5 runs 1, 6, 11 and then round — the arithmetic's remainder at the
  // end of the range is not a value on offer, and the answer is the last one that is.
  const byFive = { hourStep: 5, minuteStep: 1 };
  assert.equal(stepTimeField("hour", "12h", 1, 1, byFive), 6);
  assert.equal(stepTimeField("hour", "12h", 6, 1, byFive), 11);
  assert.equal(stepTimeField("hour", "12h", 11, 1, byFive), 1, "wraps to the first offered");
  assert.equal(stepTimeField("hour", "12h", 1, -1, byFive), 11, "and back to the last");
});

test("nothing about stepping's old behaviour moved", () => {
  // The two properties `stepTimeField` already had, asserted under a granularity that offers
  // everything: a field with no rule must behave exactly as it did.
  assert.equal(stepTimeField("hour", "12h", 12, 1), 1);
  assert.equal(stepTimeField("hour", "24h", 0, -1), 23);
  assert.equal(stepTimeField("minute", "24h", Number.NaN, 1), 0);
  assert.equal(stepTimeField("minute", "24h", Number.NaN, -1), 59);
});

test("the face draws only the minutes the field offers", () => {
  const quarters = timepickerDialNumbers("minute", "24h", EVERY_QUARTER);
  assert.deepEqual(quarters.map((n) => n.value), [0, 15, 30, 45]);
  // A number drawn on a face the field would refuse invites a press that does nothing, which reads
  // as a broken dial rather than as a rule.
  assert.equal(timepickerDialNumbers("minute", "24h").length, 12, "and every fifth minute by default");
});

test("the face draws only the hours the field offers", () => {
  const everySixth = { hourStep: 6, minuteStep: 1 };
  assert.deepEqual(timepickerDialNumbers("hour", "24h", everySixth).map((n) => n.value), [12, 6, 0, 18]);
  assert.equal(timepickerDialNumbers("hour", "24h").length, 24, "and all of them by default");
  assert.equal(timepickerDialNumbers("hour", "12h").length, 12);
});

// ─── the drag ────────────────────────────────────────────────────────────────

const { timepickerDialPick, dialNumberAngle } = await import("../dist/index.js");

test("a dragged angle lands on a minute the field offers, and only on one", () => {
  const quarters = { hourStep: 1, minuteStep: 15 };
  // Every degree of the circle, so nothing between the offered numbers can be reached.
  const landed = new Set();
  for (let angle = 0; angle < 360; angle += 1) {
    landed.add(timepickerDialPick(angle, "minute", "24h", "outer", quarters).value);
  }
  assert.deepEqual([...landed].sort((a, b) => a - b), [0, 15, 30, 45]);
});

test("both rings of a 24-hour face land on their own hours", () => {
  const outer = new Set();
  const inner = new Set();
  for (let angle = 0; angle < 360; angle += 1) {
    outer.add(timepickerDialPick(angle, "hour", "24h", "outer").value);
    inner.add(timepickerDialPick(angle, "hour", "24h", "inner").value);
  }
  assert.deepEqual([...outer].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual([...inner].sort((a, b) => a - b), [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
});

test("a step that does not divide twelve still lands only on offered hours", () => {
  // Five does not divide twelve, so the offered hours are unevenly spaced around the face — where a
  // nearest-position rule is most likely to be wrong.
  const byFive = { hourStep: 5, minuteStep: 1 };
  // A 12-hour clock counts its hours from 1, so five-hourly means 1, 6, 11 — and the face must draw
  // exactly what `acceptTimeField` would take, measured from the same start.
  const drawn = new Set([...Array(360).keys()].map((a) => timepickerDialPick(a, "hour", "12h", "outer", byFive).value));
  assert.deepEqual([...drawn].sort((a, b) => a - b), [1, 6, 11]);
  for (const hour of [1, 6, 11]) {
    assert.equal(acceptTimeField("hour", "12h", String(hour), byFive).type, "accepted", `${hour} is drawn`);
  }
  for (const hour of [2, 5, 12]) {
    assert.equal(acceptTimeField("hour", "12h", String(hour), byFive).reason, "off-step", `${hour} is not`);
  }
});

test("the pick agrees with the face, at every drawn number's own angle", () => {
  for (const steps of [undefined, { hourStep: 1, minuteStep: 15 }, { hourStep: 3, minuteStep: 5 }]) {
    for (const field of ["hour", "minute"]) {
      for (const format of ["12h", "24h"]) {
        for (const ring of ["outer", "inner"]) {
          const drawn = timepickerDialNumbers(field, format, steps).filter((n) => n.ring === ring);
          for (const number of drawn) {
            const picked = timepickerDialPick(dialNumberAngle(number), field, format, ring, steps);
            assert.equal(picked.value, number.value, `${field}/${format}/${ring} at ${dialNumberAngle(number)}°`);
          }
        }
      }
    }
  }
});

test("a tie between two offered numbers goes clockwise, and says so", () => {
  const quarters = { hourStep: 1, minuteStep: 15 };
  // Exactly between 0 (0°) and 15 (90°). Arbitrary which way, but stated — an unstated tie-break is
  // one the face and the keyboard can resolve differently.
  assert.equal(timepickerDialPick(45, "minute", "24h", "outer", quarters).value, 15);
  assert.equal(timepickerDialPick(135, "minute", "24h", "outer", quarters).value, 30);
});

test("angles wrap rather than falling off either end", () => {
  const quarters = { hourStep: 1, minuteStep: 15 };
  for (const angle of [-10, 350, 370, 720]) {
    const picked = timepickerDialPick(angle, "minute", "24h", "outer", quarters);
    assert.equal(picked.value, 0, `${angle}° is nearest the top`);
  }
});

test("no face ever draws a number the field would refuse, at any step", () => {
  // The direction that matters: a drawn number the field refuses is a press that does nothing, and
  // the user has no way to tell that from a broken dial.
  //
  // The converse does not hold and is not asserted — a minute face has twelve positions, so with a
  // one-minute step it offers 0, 5, 10 … by drawing and 0–59 by typing. The face draws the offered
  // values it has somewhere to put.
  const dead = [];
  for (const hourStep of [1, 2, 3, 4, 6, 8, 12, 24, 5, 7]) {
    for (const minuteStep of [1, 5, 15, 30, 60, 7]) {
      const steps = { hourStep, minuteStep };
      for (const format of ["12h", "24h"]) {
        for (const field of ["hour", "minute"]) {
          for (const number of timepickerDialNumbers(field, format, steps)) {
            const entry = acceptTimeField(field, format, String(number.value), steps);
            if (entry.type !== "accepted") {
              dead.push(`${field}/${format} step ${field === "hour" ? hourStep : minuteStep}: ${number.value} drawn, ${entry.reason}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(dead, []);
});

test("no angle, at any step, reaches a value the field would refuse", () => {
  // The property the drag exists under. It is not "lands on a drawn number" — a minute face has
  // twelve positions and a minute field has sixty values, so an ungranulated picker draws every
  // fifth minute and still accepts all of them, with the hand between two labels. Conflating the
  // two sets would silently turn every picker in the library into a five-minute one.
  const unreachable = [];
  for (const steps of [undefined, { minuteStep: 15 }, { minuteStep: 30 }, { hourStep: 6 }, { hourStep: 5 }]) {
    for (const format of ["12h", "24h"]) {
      for (const field of ["hour", "minute"]) {
        for (const ring of ["outer", "inner"]) {
          for (let angle = 0; angle < 360; angle += 1) {
            const picked = timepickerDialPick(angle, field, format, ring, steps);
            if (picked === null) continue;
            const entry = acceptTimeField(field, format, String(picked.value), steps);
            if (entry.type !== "accepted") {
              unreachable.push(`${field}/${format}/${ring} at ${angle}° → ${picked.value} (${entry.reason})`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(unreachable.slice(0, 5), []);
});

test("an ungranulated minute dial still reaches every minute", () => {
  // The regression this property was written after: landing only on drawn numbers coarsened every
  // picker in the library from sixty minutes to twelve.
  const reached = new Set();
  for (let angle = 0; angle < 360; angle += 1) reached.add(timepickerDialPick(angle, "minute", "24h").value);
  assert.equal(reached.size, 60);
});

test("a thinned ring still has somewhere to land", () => {
  // `hourStep: 7` leaves one hour on the whole outer ring. A pointer anywhere else on that ring has
  // nothing of its own to reach, and answering `null` would make most of the face inert.
  const bySeven = { hourStep: 7 };
  for (let angle = 0; angle < 360; angle += 15) {
    const picked = timepickerDialPick(angle, "hour", "24h", "outer", bySeven);
    assert.ok(picked, `${angle}° must land somewhere`);
    assert.equal(acceptTimeField("hour", "24h", String(picked.value), bySeven).type, "accepted");
  }
});

test("the ring travels with the pick, so the same angle names two hours", () => {
  // At `hourStep: 3` the outer 3 and the inner 15 sit at the same position. Without the ring the
  // drag is a twelve-hour error that looks correct — the hand points exactly where it should.
  const byThree = { hourStep: 3 };
  const outer = timepickerDialPick(90, "hour", "24h", "outer", byThree);
  const inner = timepickerDialPick(90, "hour", "24h", "inner", byThree);
  assert.deepEqual([outer.value, outer.ring], [3, "outer"]);
  assert.deepEqual([inner.value, inner.ring], [15, "inner"]);
  assert.equal(outer.angle, inner.angle, "and they really are at one angle");
});

test("the angle returned is the number's, not the pointer's", () => {
  // What lets a renderer rest the hand on what was chosen rather than under the finger.
  const picked = timepickerDialPick(97, "hour", "12h", "outer");
  assert.deepEqual([picked.value, picked.angle], [3, 90]);
});

// ─── which ring a press claims ───────────────────────────────────────────────

const { timepickerDialRing } = await import("../dist/index.js");

/** A 256px face whose outer digits sit at 100px and inner at 60px, as the stylesheet draws them. */
const FACE = { left: 0, top: 0, width: 256, height: 256 };
const HAND = 100;
const at = (reach, field = "hour") =>
  timepickerDialRing(FACE, 128 + reach, 128, "24h", HAND, field);

test("the inner ring is a band around its own numbers, not everything inside the outer", () => {
  // The empty middle of the face is most of its area. Reading it as `inner` answers with an hour
  // whose number is nowhere near the pointer, and shortens the hand for a press aimed further out.
  assert.equal(at(60), "inner", "on the inner numbers");
  assert.equal(at(45), "inner", "just inside them");
  assert.equal(at(78), "inner", "just outside them");
  assert.equal(at(100), "outer", "on the outer numbers");
  assert.equal(at(10), "outer", "the empty middle belongs to the ring that is drawn");
  assert.equal(at(0), "outer", "and so does the centre itself");
  assert.equal(at(130), "outer", "and anything past the outer numbers");
});

test("a minute face has one ring, whatever the press is near", () => {
  // Minutes are drawn at one radius. A press near the centre of that face used to read `inner` and
  // shorten the hand for a ring that does not exist.
  for (const reach of [0, 30, 60, 78, 100]) {
    assert.equal(at(reach, "minute"), "outer", `${reach}px from the centre`);
  }
});

test("a twelve-hour face has one ring too", () => {
  for (const reach of [0, 60, 100]) {
    assert.equal(timepickerDialRing(FACE, 128 + reach, 128, "12h", HAND, "hour"), "outer");
  }
});

// ─── the ghost ───────────────────────────────────────────────────────────────

const { timepickerDialGhost, timepickerDialTolerance } = await import("../dist/index.js");

test("no ghost when the pointer is on the value it chose", () => {
  // Every picker that offers every time is this case, always. A ghost permanently under the real
  // hand is a second thing to look at that never means anything.
  const pick = timepickerDialPick(90, "hour", "12h");
  assert.equal(timepickerDialGhost(90, pick), null);
});

test("a ghost where the pointer is, when the value went somewhere else", () => {
  const quarters = { minuteStep: 15 };
  // 42° is the 7-minute mark. On a quarter-hour face the value snaps to 0 or 15, and the gap between
  // the finger and the hand is the thing the screen has to explain.
  const pick = timepickerDialPick(42, "minute", "24h", "outer", quarters);
  const ghost = timepickerDialGhost(42, pick);
  assert.ok(ghost, "the pointer is not on the chosen number");
  assert.equal(ghost.angle, 42);
  assert.notEqual(ghost.angle, pick.angle);
});

test("the tolerance is the number's own width, not half the gap to the next", () => {
  // Half the gap is a tautology: the pick is *defined* as the nearest offered value, so the pointer
  // is always within half a gap of it and the ghost never appears. On the number means on the
  // number — a 40px digit at a 100px radius subtends about 11° either side.
  const HAND = 100;
  assert.equal(Math.round(timepickerDialTolerance("outer", HAND) * 10) / 10, 11.3);
  // The same digit covers more of a smaller circle, so the inner ring is more forgiving.
  assert.equal(Math.round(timepickerDialTolerance("inner", HAND) * 10) / 10, 18.4);
  assert.ok(timepickerDialTolerance("inner", HAND) > timepickerDialTolerance("outer", HAND));
  // Nothing measured yet: a face with no length gives away no tolerance at all.
  assert.equal(timepickerDialTolerance("outer", 0), 0);
});

test("a ghost appears on a face that snaps, and never on one that does not", () => {
  // What the first tolerance made impossible, and the case it was right about by accident. A face
  // offering every minute has its numbers 6° apart, so the hand is always under the finger and there
  // is nothing to explain; a face offering four has 90° between them and the gap is the whole point.
  const HAND = 100;
  const within = timepickerDialTolerance("outer", HAND);
  const shownFor = (steps) => {
    let shown = 0;
    for (let angle = 0; angle < 360; angle += 1) {
      const pick = timepickerDialPick(angle, "minute", "24h", "outer", steps);
      if (timepickerDialGhost(angle, pick, { within }) !== null) shown += 1;
    }
    return shown;
  };

  assert.equal(shownFor(undefined), 0, "every minute is offered, so the hand is never away from the finger");
  for (const [name, steps] of [["five", { minuteStep: 5 }], ["a quarter", { minuteStep: 15 }]]) {
    const shown = shownFor(steps);
    assert.ok(shown > 0, `${name}: the ghost is never drawn at any angle`);
    assert.ok(shown < 360, `${name}: the ghost is drawn at every angle, so it says nothing`);
  }
  // The coarser the face, the more of the circle is off a number.
  assert.ok(shownFor({ minuteStep: 15 }) > shownFor({ minuteStep: 5 }));
});

test("the ghost shows the ring the pointer is over, not the one the value is on", () => {
  // The point of it is showing what is about to happen. A pointer in the inner band while the
  // chosen hour is outside is exactly the moment that needs saying.
  const pick = timepickerDialPick(90, "hour", "24h", "outer");
  assert.equal(pick.ring, "outer");
  assert.equal(timepickerDialGhost(120, pick, { ring: "inner" }).ring, "inner");
  assert.equal(timepickerDialGhost(120, pick).ring, "outer", "and the value's own ring by default");
});

test("a ring's tolerance follows the radius its numbers are drawn at", () => {
  // Not the count of them: a ring holding one number is as forgiving as a ring holding twelve,
  // because what decides is how much of the circle a digit covers.
  for (const hand of [80, 100, 140]) {
    const outer = timepickerDialTolerance("outer", hand);
    assert.ok(outer > 0 && outer < 45, `${hand}px: ${outer}°`);
    assert.ok(timepickerDialTolerance("inner", hand) > outer, "a smaller circle is more forgiving");
  }
});

test("the face has two zones, and the band is one published number wide", async () => {
  // The band is centred on the inner ring's own radius, so a finger moving in crosses outer → inner
  // and, below the digits, outer again. That third zone is deliberate: the empty middle carries no
  // numbers, and the user asked for the inner ring only "in un intorno molto vicino
  // dell'occupazione delle cifre, altrimenti deve stare sul quadrante maggiore".
  //
  // Recorded rather than argued, because it is the half of the rule most likely to be read as a
  // defect by someone who did not hear the request.
  const { MDY_TIMEPICKER_RING_BAND } = await import("../dist/index.js");
  const HAND = 100;
  const innerRadius = HAND * 0.6;
  const half = (HAND - innerRadius) * MDY_TIMEPICKER_RING_BAND;
  assert.equal(at(Math.round(innerRadius - half) + 1), "inner", "the near edge of the band");
  assert.equal(at(Math.round(innerRadius + half) - 1), "inner", "and the far edge");
  assert.equal(at(Math.round(innerRadius - half) - 1), "outer", "below it the major dial resumes");
  assert.equal(at(Math.round(innerRadius + half) + 1), "outer", "and above it too");
});

// ─── the dial's own keyboard ─────────────────────────────────────────────────

const { timepickerDialKeyIntent } = await import("../dist/index.js");

test("the dial's arrows move by the step, like every other way in", () => {
  // A dial is a pointer affordance, and if its arrows walked through times the face does not draw,
  // the keyboard would be the one route that reaches values the field refuses.
  const quarters = { minuteStep: 15 };
  assert.deepEqual(timepickerDialKeyIntent("ArrowUp", "minute", "24h", 0, quarters), { field: "minute", value: 15 });
  assert.deepEqual(timepickerDialKeyIntent("ArrowDown", "minute", "24h", 0, quarters), { field: "minute", value: 45 });
  // And unchanged where nothing is declared.
  assert.deepEqual(timepickerDialKeyIntent("ArrowUp", "minute", "24h", 0), { field: "minute", value: 1 });
});

test("Home and End land on values the field offers", () => {
  const byFive = { hourStep: 5 };
  // A 12-hour clock counting from 1 by fives offers 1, 6, 11 — so the end of the range is not the
  // last value on offer, and answering 12 would be a key that sets something the face refuses.
  assert.deepEqual(timepickerDialKeyIntent("Home", "hour", "12h", 6, byFive), { field: "hour", value: 1 });
  assert.deepEqual(timepickerDialKeyIntent("End", "hour", "12h", 6, byFive), { field: "hour", value: 11 });
  assert.deepEqual(timepickerDialKeyIntent("End", "hour", "12h", 6), { field: "hour", value: 12 });
});

test("a page is whole steps rather than a fixed distance", () => {
  // Five single steps on a quarter-hour face is more than an hour, so a page that moved five
  // *minutes* would be smaller than one arrow press.
  const quarters = { minuteStep: 15 };
  assert.deepEqual(timepickerDialKeyIntent("PageUp", "minute", "24h", 0, quarters), { field: "minute", value: 15 });
});
