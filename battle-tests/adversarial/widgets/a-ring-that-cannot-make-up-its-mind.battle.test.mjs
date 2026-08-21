/**
 * A finger resting on an inner number, trembling, and the face changing its mind four times.
 *
 * `timepickerDialRing` is a pure function of the pointer's distance from the centre, re-evaluated on
 * every `pointermove`. The edge is where the two number boxes meet — 80 at a hand of 100 — which is
 * correct as a *boundary* and is exactly the wrong place for a decision with no memory:
 *
 *     inner numbers centred at 60, box 40..80        outer at 100, box 80..120
 *                                        ↑ the edge, one half-box from either centre
 *
 * A hand is never still. Resting near the outer part of an inner number and moving a pixel at a time
 * crosses the edge repeatedly, and each crossing is a full answer — the hand jumps its length, the
 * face swaps which twelve numbers it is picking from, and it does it several times a second.
 *
 * A threshold is the right shape for *where* the rings divide and the wrong shape for *whether to
 * change*. Those are different questions and the contract currently answers both with one comparison.
 * What is missing is memory: having chosen a ring, leaving it should take a deliberate move rather
 * than a tremor. Every control that switches on a boundary a person can rest on carries this —
 * a scroll snap, a drag handle, a hover menu — and the usual name for the repair is hysteresis.
 *
 * This battle does not prescribe the mechanism. It asserts the property a person can feel: **a wander
 * smaller than the face's own features cannot change the answer more than once.** Whether that is a
 * previous-ring argument, a latch held for the length of a drag, or a deadband is the contract's
 * choice; all three satisfy this and a bare threshold satisfies none.
 *
 * Green when a trembling finger gets one answer.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { timepickerDialRing, MDY_TIMEPICKER_NUMBER_SIZE, MDY_TIMEPICKER_INNER_RING } = await import(
  "@modyra/widgets"
);

const HAND = 100;
const FACE = { left: 0, top: 0, width: 2 * HAND, height: 2 * HAND };

/** The ring reported for a pointer `reach` px from the centre, straight up. */
const ringAt = (reach) => timepickerDialRing(FACE, HAND, HAND - reach, "24h", HAND, "hour");

/** How many times the answer changes across a sequence of positions. */
function changesAcross(path) {
  let changes = 0;
  let previous = null;
  const seen = [];
  for (const reach of path) {
    const ring = ringAt(reach);
    seen.push(`${reach}:${ring}`);
    if (previous !== null && ring !== previous) changes += 1;
    previous = ring;
  }
  return { changes, seen };
}

battle(
  {
    claims: ["UI-011", "A11Y-001"],
    title: "a trembling finger does not make the face change its mind",
    environments: ["node"],
  },
  async (ctx) => {
    const inner = HAND * MDY_TIMEPICKER_INNER_RING;
    const edge = inner + (HAND - inner) * 0.5;

    ctx.log.note("the geometry the tremor happens in", {
      innerCentre: inner,
      innerBox: [inner - MDY_TIMEPICKER_NUMBER_SIZE / 2, inner + MDY_TIMEPICKER_NUMBER_SIZE / 2],
      outerCentre: HAND,
      edge,
      halfBox: MDY_TIMEPICKER_NUMBER_SIZE / 2,
    });

    // Premise: the edge is real and a sweep across it changes the answer once. Without that this
    // would be a complaint about a face with only one ring.
    const sweep = changesAcross([0, 20, 40, 60, 80, 100]);
    expectClaim(sweep.changes === 1, {
      claimIds: ["UI-011"],
      what: "a straight sweep from the centre to the rim does not cross the ring edge exactly once, so the edge is not where this battle thinks it is",
      detail: sweep.seen.join(" "),
    });

    // A finger resting near the outer part of an inner number and trembling. Every position is inside
    // the inner number's own box or within two pixels of it — nobody moving like this is reaching for
    // a different number.
    const tremor = [76, 77, 78, 79, 80, 81, 80, 79, 80, 81, 82, 81, 80];
    const trembling = changesAcross(tremor);
    expectClaim(trembling.changes <= 1, {
      claimIds: ["UI-011", "A11Y-001"],
      what: "a finger trembling within one number's box makes the face swap rings repeatedly, so the hand jumps its own length several times a second while the person is holding still",
      detail:
        `${trembling.changes} ring changes across a ${Math.max(...tremor) - Math.min(...tremor)}px wander — ` +
        trembling.seen.join(" "),
    });

    // The same thing said without a hand-written path: any wander narrower than half a number box,
    // anywhere on the radius, is smaller than the smallest thing on the face and cannot mean two
    // different intentions.
    const half = MDY_TIMEPICKER_NUMBER_SIZE / 2;
    for (let centre = half; centre <= HAND - 2; centre += 1) {
      const wander = [centre, centre + half / 2, centre, centre + half / 2, centre];
      const result = changesAcross(wander);
      expectClaim(result.changes <= 1, {
        claimIds: ["UI-011"],
        what: "a pointer moving back and forth by less than half a number's box changes ring more than once",
        detail: `around ${centre}px: ${result.changes} changes — ${result.seen.join(" ")}`,
      });
    }
  },
);
