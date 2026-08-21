/**
 * The ghost hand's length against the pointer's distance, and the one radius where it inverts.
 *
 * The rule the ghost was built to: *"la fine sempre sotto il mio puntatore tranne quando la lunghezza
 * eccede la circonferenza massima"* — the end is under the pointer, capped at the hand. A floor was
 * specified first and removed, because a floor lies at exactly the radius a person is checking whether
 * the hand tracks them.
 *
 * It came back as a fallback:
 *
 *     const reach = hand > 0 && pointer > 0 ? Math.min(pointer / hand, 1) : 1;
 *
 * `pointer > 0` puts a pointer **at the centre** in the same branch as a pointer nobody measured, and
 * that branch answers `1`. So the ghost is at its longest where the finger is nearest the middle, and
 * the function is discontinuous at a point it can be handed: a pointer 1px out draws a 1px stub, and
 * the same pointer at 0 draws the full hand.
 *
 * Two different situations are being collapsed. `handLength <= 0` is *no geometry known*, where `1`
 * is a reasonable thing to say because nothing better is available. `pointerReach === 0` is geometry
 * known perfectly, describing a pointer at the centre, and the answer to it is 0.
 *
 * The same shape as the rest of the night: a legitimate value indistinguishable from its own absence —
 * `[]` for a face with nothing to dim, `outer` from a rect that was never read, and now `0` for a
 * pointer that really is at the middle.
 *
 * Asserted as **monotonicity** rather than as the single point, because the property is what the rule
 * means: coming inward must never lengthen the hand. That catches this and any later fallback that
 * reintroduces it somewhere else on the radius.
 *
 * Green when the ghost never grows as the pointer comes in.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { timepickerDialPick, timepickerDialGhost, MDY_EVERY_TIME } = await import("@modyra/widgets");

const HAND = 100;

battle(
  {
    claims: ["UI-011"],
    title: "the ghost hand never grows as the pointer comes inward",
    environments: ["node"],
  },
  async (ctx) => {
    const pick = timepickerDialPick(210, "hour", "24h", "outer", MDY_EVERY_TIME);

    // Premise: a pick to hang the ghost on, and an angle far enough from it that a ghost is returned
    // at all — `within` gates that, and a null ghost would make every assertion below vacuous.
    expectClaim(pick !== null, {
      claimIds: ["UI-011"],
      what: "no pick came back for a plain 24-hour face, so there is nothing to draw a ghost against",
      detail: JSON.stringify(pick),
    });

    const reachAt = (pointerReach) => {
      const ghost = timepickerDialGhost(215, pick, {
        ring: "outer",
        within: 0,
        pointerReach,
        handLength: HAND,
      });
      return ghost === null ? null : ghost.reach;
    };

    const sweep = [];
    for (let pointer = 0; pointer <= HAND * 1.4; pointer += HAND / 40) {
      sweep.push({ pointer: Number(pointer.toFixed(2)), reach: reachAt(pointer) });
    }

    ctx.log.note("the ghost's length along the radius", {
      atCentre: reachAt(0),
      justOff: reachAt(HAND / 40),
      half: reachAt(HAND / 2),
      atHand: reachAt(HAND),
      beyond: reachAt(HAND * 1.8),
    });

    expectClaim(
      sweep.every((point) => point.reach !== null),
      {
        claimIds: ["UI-011"],
        what: "the ghost vanished somewhere along the radius, so its length is not defined everywhere the pointer can be",
        detail: JSON.stringify(sweep.filter((point) => point.reach === null)),
      },
    );

    // The cap: the one exception the rule allows. Past the hand's own length the ghost stops growing
    // rather than spilling over the face.
    for (const point of sweep) {
      expectClaim(point.reach <= 1, {
        claimIds: ["UI-011"],
        what: "the ghost is longer than the hand, so it reaches past the face it is drawn on",
        detail: `pointer ${point.pointer} → reach ${point.reach}`,
      });
    }

    // The property. Moving outward may lengthen the hand or leave it alone; it may never shorten it,
    // which is the same statement as "coming inward never lengthens it".
    for (let index = 1; index < sweep.length; index += 1) {
      const previous = sweep[index - 1];
      const here = sweep[index];
      expectClaim(here.reach >= previous.reach - 1e-9, {
        claimIds: ["UI-011"],
        what: "the ghost is longer at a smaller radius than at a larger one, so coming inward grows the hand instead of shrinking it",
        detail:
          `pointer ${previous.pointer} → reach ${previous.reach}, ` +
          `pointer ${here.pointer} → reach ${here.reach}`,
      });
    }

    // And the case the fallback exists for, kept distinct: with no geometry there is nothing for the
    // answer to be wrong about, so a full-length ghost there is a decision rather than a defect.
    const unmeasured = timepickerDialGhost(215, pick, { ring: "outer", within: 0, pointerReach: 40, handLength: 0 });
    expectClaim(unmeasured !== null && unmeasured.reach === 1, {
      claimIds: ["UI-011"],
      what: "the unmeasured-face fallback changed, which is the branch a pointer at the centre must not share",
      detail: JSON.stringify(unmeasured),
    });
  },
);
