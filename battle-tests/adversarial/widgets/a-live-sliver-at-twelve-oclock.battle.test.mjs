/**
 * Two dead positions either side of twelve o'clock, with a live-looking gap between them.
 *
 * `timepickerDialUnavailableArcs` runs neighbouring removed positions together, and says why in its
 * own comment: *"drawing two slices with a live-looking sliver between them would say there is
 * something there."* The merge is driven by adjacency on the ungranulated face — `everything` — which
 * is correct everywhere except across the seam, where the array ends.
 *
 * The loop asks `everything[indexOf(angle) - 1]`, which is `undefined` for the first position, so the
 * position at 0° never merges backwards. A post-loop pass tries to repair that, but tests whether the
 * two arcs *geometrically overlap*:
 *
 *     last.to - 360 >= first.from
 *
 * Neighbours on an hour face sit 30° apart with a half-width of 11.3°, so two adjacent removed
 * positions never overlap — the repair can only fire when the arcs were already touching. Adjacency
 * and overlap are different questions, and everywhere except the seam the code asks the first one.
 *
 * The result is a gap at the top of the face, which on a clock is the most looked-at point there is.
 *
 * Green when a removed position adjacent to another removed position is drawn as one dead stretch,
 * wherever on the ring the two of them happen to fall.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { timepickerDialUnavailableArcs, timepickerDialNumbers, timepickerDialTolerance } = await import(
  "@modyra/widgets"
);

const HAND = 100;

/** Whether `angle` lies inside an arc, which may wrap through 0°. */
function covers(arc, angle) {
  const at = ((angle % 360) + 360) % 360;
  const from = ((arc.from % 360) + 360) % 360;
  const to = ((arc.to % 360) + 360) % 360;
  return from <= to ? at >= from - 1e-6 && at <= to + 1e-6 : at >= from - 1e-6 || at <= to + 1e-6;
}

battle(
  {
    claims: ["UI-009", "UI-011"],
    title: "a dead stretch across the top of the face is one stretch",
    environments: ["node"],
  },
  async (ctx) => {
    // A 24-hour outer ring under a five-hour step. What survives on it is 5 and 10; everything else
    // was taken away, including 11 and 12 — which are neighbours, and which straddle the seam.
    const field = "hour";
    const format = "24h";
    const steps = { hourStep: 5 };
    const ring = "outer";

    const drawn = timepickerDialNumbers(field, format, steps).filter((number) => number.ring === ring);
    const everything = timepickerDialNumbers(field, format, undefined).filter((n) => n.ring === ring);
    const arcs = timepickerDialUnavailableArcs(field, format, steps, HAND, ring);
    const half = timepickerDialTolerance(ring, HAND);

    ctx.log.note("the face under test", {
      steps,
      drawn: drawn.map((n) => n.value),
      removed: everything.filter((n) => !drawn.some((d) => d.value === n.value)).map((n) => n.value),
      arcs: arcs.map((a) => [Number(a.from.toFixed(1)), Number(a.to.toFixed(1))]),
      half: Number(half.toFixed(1)),
    });

    // Premise: the granularity really did take positions away, and the function really did answer.
    // Without both, everything below would be a statement about an empty face.
    expectClaim(drawn.length > 0 && drawn.length < everything.length && arcs.length > 0, {
      claimIds: ["UI-009"],
      what: "the chosen face removes nothing or draws nothing, so it cannot show anything about merging",
      detail: `drawn ${drawn.length} of ${everything.length}, arcs ${arcs.length}`,
    });

    // The invariant esecutore holds, checked here rather than taken on report: dimming a position a
    // person can actually choose is the worse failure of the two, so it is worth its own assertion.
    for (const number of drawn) {
      const angle = (everything.findIndex((n) => n.value === number.value) * 360) / everything.length;
      const over = arcs.find((arc) => covers(arc, angle));
      expectClaim(over === undefined, {
        claimIds: ["UI-011"],
        what: "an arc covers a number the face drew, so a selectable value is painted as unavailable",
        detail: `${number.value} at ${angle}° under ${JSON.stringify(over)}`,
      });
    }

    // The defect. Between two removed neighbours there must be nothing live-looking, and the space
    // between them is narrower than the pair of half-widths that already count as dead.
    const removedAngles = everything
      .map((n, index) => ({ value: n.value, angle: (index * 360) / everything.length }))
      .filter((n) => !drawn.some((d) => d.value === n.value));

    for (let index = 0; index < removedAngles.length; index += 1) {
      const here = removedAngles[index];
      const next = removedAngles[(index + 1) % removedAngles.length];
      const step = 360 / everything.length;
      const apart = (((next.angle - here.angle) % 360) + 360) % 360;
      if (Math.abs(apart - step) > 1e-6) continue; // not neighbours on the full face

      const between = here.angle + step / 2;
      const dead = arcs.some((arc) => covers(arc, between));
      expectClaim(dead, {
        claimIds: ["UI-009"],
        what: "two removed neighbours are drawn as separate slices with a live-looking gap between them, which says a value can be chosen there",
        detail:
          `${here.value} at ${here.angle}° and ${next.value} at ${next.angle}° are adjacent and both removed, ` +
          `but ${between.toFixed(1)}° is covered by no arc — arcs ${JSON.stringify(
            arcs.map((a) => [Number(a.from.toFixed(1)), Number(a.to.toFixed(1))]),
          )}`,
      });
    }
  },
);
