/**
 * The same defect as the flickering ring, one axis over: the *value* changes under a resting finger.
 *
 * `timepickerDialRing` was given memory so a tremor could not swap rings. `timepickerDialPick` was
 * not, and it answers the same kind of question — which of several evenly spaced things is the pointer
 * nearest — with the same bare comparison. Twelve hours sit 30° apart, so the boundary is at 15°, and
 * at a hand of 100 one degree is 1.75px of arc:
 *
 *     13°:12  14°:12  15°:1  16°:1  15°:1  14°:12  15°:1 …
 *     → the hour changed 3 times across a 7px tremor
 *
 * Anywhere on the face, a **one-degree** wander — under two pixels — flips the answer up to four
 * times. The ring fix removed half of what a person feels and left the half that changes the time.
 *
 * The repair is the rule already proven on the radius, and it is the same sentence: **you leave what
 * you have selected when you pass the boundary by a quarter of the spacing.** On the radius that is
 * the edge at 80 ± 10, the ring gap being 40. Here it is the 15° boundary ± 7.5°, the spacing being
 * 30°. The form is identical because the question is identical, and stating it once is what stops the
 * third axis — whenever one appears — from being written without memory again.
 *
 * It scales with the face rather than being a fixed number of degrees: a minute face draws sixty
 * numbers 6° apart and gets a 1.5° deadband, which is still wider than a tremor and still narrower
 * than an intention.
 *
 * Threaded through `previous`, because a renderer already holds the value it is showing — the draft is
 * what the hand is drawn from. As with the ring, the argument is something the caller has in hand, not
 * new state anyone has to keep.
 *
 * Green when a finger held still keeps the time it is pointing at.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { timepickerDialPick, MDY_EVERY_TIME } = await import("@modyra/widgets");

/** What the dial says is selected at `angle`, given what it said last. */
const pickAt = (angle, field, previous) => {
  const pick = timepickerDialPick(angle, field, "24h", "outer", MDY_EVERY_TIME, previous);
  return pick === null ? null : pick.value;
};

/** How many times the selected value changes across a path, threading each answer forward. */
function changesAcross(path, field) {
  let changes = 0;
  let previous;
  const seen = [];
  for (const angle of path) {
    const value = pickAt(angle, field, previous);
    seen.push(`${angle}°:${value}`);
    if (previous !== undefined && value !== previous) changes += 1;
    previous = value;
  }
  return { changes, seen };
}

battle(
  {
    claims: ["UI-011", "A11Y-001"],
    title: "a finger held still keeps the time it is pointing at",
    environments: ["node"],
  },
  async (ctx) => {
    // Premise: the face divides where this battle thinks it does, and a deliberate move from one
    // number to the next still changes the value exactly once. A fix that stops the tremor by
    // refusing to change at all would pass everything below without this.
    const deliberate = changesAcross([0, 5, 10, 15, 20, 25, 30], "hour");
    expectClaim(deliberate.changes === 1, {
      claimIds: ["UI-011"],
      what: "moving deliberately from one hour to the next does not change the value exactly once, so the face no longer follows the pointer",
      detail: `${deliberate.changes} changes — ${deliberate.seen.join(" ")}`,
    });

    ctx.log.note("the geometry a tremor happens in", {
      hoursApart: 30,
      boundary: 15,
      pxPerDegreeAtHand100: Number(((2 * Math.PI * 100) / 360).toFixed(2)),
    });

    // A finger resting between two hours, trembling by about seven pixels of arc.
    const tremor = changesAcross([13, 14, 15, 16, 15, 14, 15, 16, 17, 16, 15], "hour");
    expectClaim(tremor.changes === 0, {
      claimIds: ["UI-011", "A11Y-001"],
      what: "a finger trembling between two numbers changes the selected time repeatedly, so the hour moves while the person believes they are holding still",
      detail: `${tremor.changes} changes — ${tremor.seen.join(" ")}`,
    });

    // The same thing said everywhere rather than at one angle: one degree is under two pixels of arc,
    // which is smaller than anything a person can aim at.
    for (let at = 1; at < 360; at += 1) {
      const wander = changesAcross([at, at + 1, at, at + 1, at], "hour");
      expectClaim(wander.changes === 0, {
        claimIds: ["UI-011"],
        what: "a one-degree wander changes the selected value, and one degree is under two pixels of arc",
        detail: `at ${at}°: ${wander.changes} changes — ${wander.seen.join(" ")}`,
      });
    }

    // A minute face is denser — sixty numbers 6° apart — so whatever the rule is, it has to be a
    // property of the spacing rather than a number of degrees somebody chose for the hours.
    const minutes = changesAcross([2.5, 3, 3.5, 3, 2.5, 3, 3.5], "minute");
    expectClaim(minutes.changes === 0, {
      claimIds: ["UI-011"],
      what: "the same tremor changes the minute, so whatever protects the hour face does not scale to a denser one",
      detail: `${minutes.changes} changes — ${minutes.seen.join(" ")}`,
    });

    const minutesMoved = changesAcross([0, 1, 2, 3, 4, 5, 6], "minute");
    expectClaim(minutesMoved.changes === 1, {
      claimIds: ["UI-011"],
      what: "moving deliberately from one minute to the next does not change the value exactly once",
      detail: `${minutesMoved.changes} changes — ${minutesMoved.seen.join(" ")}`,
    });
  },
);
