/**
 * A hand that follows the pointer, and the tolerance that makes it impossible.
 *
 * The ghost exists to show what would be chosen while the real hand sits on what *is* chosen. It is
 * hidden while the pointer is already on the real hand, and the threshold for "already on" is
 * `timepickerDialTolerance`.
 *
 * That threshold is currently **half the angular gap between offered values** — and it can never be
 * exceeded, because the pick is defined as the nearest offered value. The pointer is always within
 * half a gap of the nearest thing. **The tolerance and the picking rule are the same number**, so the
 * ghost is hidden at every angle of every face:
 *
 *     no granularity     60 reachable   gap  6°   worst |pointer − pick|  3.0°   tolerance  15°
 *     minuteStep 5       12 reachable   gap 30°   worst 15.0°                    tolerance  15°
 *     minuteStep 15       4 reachable   gap 90°   worst 45.0°                    tolerance  45°
 *
 * It is not a threshold that is too large by a margin someone could tune. It is a tautology, and a
 * feature that draws nothing while every unit test of its parts passes.
 *
 * The property here is the one that cannot be satisfied by accident: **with a step, some angle shows
 * a ghost; with no granularity, none does.** The second half is the guard that matters — a tolerance
 * loosened until the first half passes would put a ghost on every ungranulated picker in the library,
 * which is the regression this batch already produced once when a minute face's twelve positions were
 * mistaken for a minute field's sixty values.
 *
 * Green when a ghost appears exactly where a person is between two offered values and nowhere else.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const widgets = await import("@modyra/widgets");

/**
 * Every angle of the circle, and whether a ghost is offered there.
 *
 * `timepickerDialTolerance` takes the **ring and the hand's length** — it is the angular half-width of
 * the drawn knob, geometry rather than a fraction of the gap. It used to take the field, the format
 * and the steps, and this helper went on calling it that way after the signature changed: `"24h"`
 * arrived where a hand length goes, `parseFloat` made it `NaN`, the `> 0` guard read that as absent
 * and answered `0°`. A tolerance of zero lights a ghost at every angle that is not exactly on a
 * number, so the battle reported 300 of 360 and looked like a product defect.
 *
 * A stale call wearing a plausible answer — the same shape as the defects this file exists to catch,
 * which is why the number is spelled out in the failure detail rather than just compared.
 */
const HAND = 100;

function ghostsAcross(field, format, granularity) {
  const within = widgets.timepickerDialTolerance("outer", HAND);
  let shown = 0;
  for (let angle = 0; angle < 360; angle += 1) {
    const pick = widgets.timepickerDialPick(angle, field, format, "outer", granularity);
    if (!pick) continue;
    if (widgets.timepickerDialGhost(angle, pick, { within, ring: "outer", pointerReach: HAND, handLength: HAND })) {
      shown += 1;
    }
  }
  return { within: Number(within.toFixed(2)), shown };
}

battle(
  {
    claims: ["UI-011", "UI-009"],
    title: "a ghost hand appears between offered values, and never on a picker with no steps",
    environments: ["node"],
  },
  async (ctx) => {
    const stepped = ghostsAcross("minute", "24h", { minuteStep: 15 });
    const finer = ghostsAcross("minute", "24h", { minuteStep: 5 });
    const plain = ghostsAcross("minute", "24h", {});
    ctx.log.note("ghosts across the circle", { stepped, finer, plain });

    // The half this batch has already got wrong once: no declaration means nothing changes. A
    // tolerance loosened until the assertion below passes would light a ghost on every existing
    // picker, and that is the regression, not the fix.
    expectClaim(plain.shown === 0, {
      claimIds: ["UI-011"],
      what: "a picker with no granularity offers a ghost, so a control nobody configured has grown a second hand",
      detail: `${plain.shown} of 360 angles, tolerance ${plain.within}°`,
    });

    // And the half that is currently impossible: between two offered values there is something to
    // show. A person dragging a quarter-hour dial is between numbers for most of the circle.
    expectClaim(stepped.shown > 0, {
      claimIds: ["UI-011", "UI-009"],
      what: "no angle of a stepped face offers a ghost — the tolerance is half the gap between offered values and the pick is the nearest of them, so the pointer is inside it by construction and the hand can never be drawn",
      detail: `minuteStep 15: ${stepped.shown} of 360, tolerance ${stepped.within}°; minuteStep 5: ${finer.shown} of 360, tolerance ${finer.within}°`,
    });

    // Most of a quarter-hour circle is between numbers, so a working ghost is common rather than a
    // sliver. Stated as a floor so a tolerance that hides all but a degree or two still reads as the
    // defect it would be.
    expectClaim(stepped.shown > 180, {
      claimIds: ["UI-011"],
      what: "a ghost appears at so few angles of a quarter-hour face that a person dragging it would rarely see one",
      detail: `${stepped.shown} of 360 angles`,
    });
  },
);
