/**
 * Where a dragged hand lands when the step has thinned the face.
 *
 * A drag reports an angle and a ring. With a step, the face no longer offers a number at every
 * position, and the two obvious rules each break on a case the other survives:
 *
 *     hourStep 7, 24-hour face          hourStep 3, 24-hour face
 *       outer   7@7                       outer   12@12  3@3   6@6   9@9
 *       inner   0@12  14@2  21@9          inner    0@12 15@3  18@6  21@9
 *
 * **Nearest by angle alone is wrong at step 3**: outer 3 and inner 15 sit at the same position, so a
 * rule that ignores the ring answers 3 for a pointer on the inner ring — a twelve-hour error, and the
 * one a person is least likely to catch because the hand looks right.
 *
 * **Same ring only is wrong at step 7**: the outer ring offers exactly one number in the whole circle,
 * so a pointer anywhere else on it has nothing to land on. A rule that refuses to leave the ring
 * leaves the drag dead over eleven twelfths of the face.
 *
 * So the pick needs both, and neither alone. That is the property here: **whatever a drag reports,
 * it lands on a value the face actually drew** — and where the same position carries a number on each
 * ring, the ring decides which.
 *
 * The pick is asked of the contract rather than computed here. An angle rounded by a renderer and a
 * face drawn by the contract are two implementations of one rule, and tonight has been a catalogue of
 * what that costs: an output with no consumer, a registry with one of two writes, a contract's `open`
 * painted from another cell, seven orphaned CSS rules. **If a renderer snaps for itself, the face and
 * the drag can disagree and nothing here would notice.**
 *
 * Green when every angle on every ring resolves to a number that face is showing.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const widgets = await import("@modyra/widgets");

/** The published way to turn a drag into a value, if there is one yet. */
const pickAt = widgets.timepickerDialValueAt ?? widgets.timepickerDialPick ?? null;

battle(
  {
    claims: ["UI-011", "UI-009"],
    title: "a dragged angle lands on a number the face is showing",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise, and the reason this battle exists at all: the face really is thinned by the step
    // and really does scatter across both rings. Without that, everything below is about a full face.
    const seven = widgets.timepickerDialNumbers("hour", "24h", { hourStep: 7 });
    const three = widgets.timepickerDialNumbers("hour", "24h", { hourStep: 3 });
    const outerOfSeven = seven.filter((number) => number.ring === "outer");
    const sharedIndices = three
      .filter((number) => number.ring === "outer")
      .filter((outer) => three.some((inner) => inner.ring === "inner" && inner.index === outer.index));

    ctx.log.note("the two faces this turns on", {
      sevenOuter: outerOfSeven.map((n) => `${n.value}@${n.index}`),
      threeShared: sharedIndices.map((n) => `${n.value}@${n.index}`),
    });

    expectClaim(outerOfSeven.length === 1, {
      claimIds: ["UI-009"],
      what: "a step of 7 no longer leaves one lone number on the outer ring, so the 'same ring only' rule is not under test here",
      detail: JSON.stringify(outerOfSeven.map((n) => n.value)),
    });
    expectClaim(sharedIndices.length > 2, {
      claimIds: ["UI-009"],
      what: "a step of 3 no longer puts a number on both rings at one position, so the 'ignore the ring' rule is not under test here",
      detail: JSON.stringify(sharedIndices.map((n) => `${n.value}@${n.index}`)),
    });

    // The contract has to publish the pick. A renderer computing its own is the defect this battle is
    // written to prevent, and it cannot be measured from here — so its absence is the finding.
    expectClaim(pickAt !== null, {
      claimIds: ["UI-011"],
      what: "the contract publishes no way to turn a drag into a value, so each renderer must snap for itself and the face and the drag can disagree",
      detail: `looked for timepickerDialValueAt and timepickerDialPick in @modyra/widgets`,
    });
    if (pickAt === null) return;

    // Every position on the circle, on both rings, at both steps. An angle is the middle of a
    // position rather than its edge, so this asks the ordinary case before the ties.
    const wrong = [];
    for (const [label, granularity] of [["step 7", { hourStep: 7 }], ["step 3", { hourStep: 3 }]]) {
      const face = widgets.timepickerDialNumbers("hour", "24h", granularity);
      const offered = new Set(face.map((number) => number.value));
      for (const ring of ["outer", "inner"]) {
        for (let position = 0; position < 12; position += 1) {
          const angle = position * 30;
          const landed = pickAt(angle, "hour", "24h", ring, granularity)?.value;
          if (!offered.has(landed)) wrong.push(`${label} ${ring} ${angle}° -> ${landed}`);
        }
      }
    }
    ctx.log.note("every position, both rings, both steps", { checked: 48, offTheFace: wrong.length });

    expectEqual(wrong.slice(0, 8), [], {
      claimIds: ["UI-011", "UI-009"],
      what: "a drag resolved to an hour the face is not showing, so the hand can come to rest on a value nothing offered",
      detail: `${wrong.length} of 48`,
    });

    // And the discriminator the two faces exist for: where both rings carry a number at one position,
    // the ring has to decide. A rule that answers by angle alone is wrong by twelve hours here.
    const bothRings = sharedIndices[0];
    const angle = bothRings.index === 12 ? 0 : bothRings.index * 30;
    const onOuter = pickAt(angle, "hour", "24h", "outer", { hourStep: 3 })?.value;
    const onInner = pickAt(angle, "hour", "24h", "inner", { hourStep: 3 })?.value;
    ctx.log.note("one position, two rings", { angle, onOuter, onInner });

    expectClaim(onOuter !== onInner, {
      claimIds: ["UI-011"],
      what: "the same angle answers the same on both rings, so the ring a person is touching does not reach the value and half the face is unreachable",
      detail: `${angle}° -> outer ${onOuter}, inner ${onInner}`,
    });
  },
);
