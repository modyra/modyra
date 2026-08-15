/**
 * Which edge a popup lines up with, and when it changes its mind.
 *
 * `decideOverlayAlignment` picks the side an overlay is anchored to, and it answers three different
 * questions in order. A caller that states a preference gets it. A caller that gives the pointer gets
 * the half of the anchor the pointer was on, so a wide control opens towards the hand that opened it.
 * A caller that gives neither gets the side with more of the viewport behind it.
 *
 * Then, if the overlay says how wide it wants to be, the answer is checked against the room actually
 * there — `MDY_OVERLAY_VIEWPORT_MARGIN` kept clear at the edge — and flipped if the other side has
 * more. That last step is where a popup either stays on screen or does not, and its boundary is an
 * off-by-one waiting to happen: with 188 pixels of room, 188 stays and 189 must go.
 *
 * None of it was named by anything in this suite, and none of it is visible in a screenshot taken on
 * a wide window.
 */

import { MDY_OVERLAY_VIEWPORT_MARGIN, decideOverlayAlignment } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A viewport wide enough that an anchor can be near either edge of it. */
const VIEWPORT = 1000;

const decide = (input) => decideOverlayAlignment({ viewportWidth: VIEWPORT, ...input });

battle(
  {
    claims: ["UI-001"],
    title: "a popup leans the way it was asked, or the way there is room",
    environments: ["node"],
  },
  async (ctx) => {
    // Nothing stated: the side with more viewport behind it.
    expectEqual(
      [decide({ anchorLeft: 100, anchorRight: 200 }), decide({ anchorLeft: 800, anchorRight: 900 })],
      ["left", "right"],
      {
        claimIds: ["UI-001"],
        what: "an overlay with nothing stated did not lean towards the room it has",
      },
    );

    // The pointer, so a wide control opens towards the hand that opened it. The middle of the anchor
    // belongs to the right, and either end answers for its own side.
    const middle = 150;
    ctx.log.note("where the pointer was, on an anchor from 100 to 200", {
      before: decide({ anchorLeft: 100, anchorRight: 200, pointerX: middle - 1 }),
      at: decide({ anchorLeft: 100, anchorRight: 200, pointerX: middle }),
      after: decide({ anchorLeft: 100, anchorRight: 200, pointerX: middle + 1 }),
    });

    expectEqual(
      [
        decide({ anchorLeft: 100, anchorRight: 200, pointerX: 100 }),
        decide({ anchorLeft: 100, anchorRight: 200, pointerX: middle }),
        decide({ anchorLeft: 100, anchorRight: 200, pointerX: 200 }),
      ],
      ["left", "right", "right"],
      {
        claimIds: ["UI-001"],
        what: "an overlay did not open towards the half of the anchor the pointer was on",
      },
    );

    // A stated preference wins over both, including against the room.
    expectEqual(decide({ anchorLeft: 800, anchorRight: 900, preferredAlignment: "left" }), "left", {
      claimIds: ["UI-001"],
      what: "a stated preference was overruled by where the anchor happens to be",
    });
  },
);

battle(
  {
    claims: ["UI-001", "A11Y-004"],
    title: "a popup that will not fit leans the other way",
    environments: ["node"],
  },
  async (ctx) => {
    // Anchored near an edge with the preference pointing at it: the room on that side is the anchor
    // minus the margin the contract keeps clear.
    const room = 200 - MDY_OVERLAY_VIEWPORT_MARGIN;
    ctx.log.note("room on the preferred side", { room, margin: MDY_OVERLAY_VIEWPORT_MARGIN });

    for (const [width, expected] of [[100, "right"], [room, "right"], [room + 12, "left"], [900, "left"]]) {
      expectEqual(
        decide({ anchorLeft: 100, anchorRight: 200, preferredAlignment: "right", desiredWidth: width }),
        expected,
        {
          claimIds: ["UI-001"],
          what: `an overlay ${width} wide with ${room} of room did not lean ${expected}`,
        },
      );
    }

    // And the mirror, so the flip is about room rather than about one side always winning.
    for (const [width, expected] of [[100, "left"], [room, "left"], [room + 12, "right"], [900, "right"]]) {
      expectEqual(
        decide({ anchorLeft: 800, anchorRight: 900, preferredAlignment: "left", desiredWidth: width }),
        expected,
        {
          claimIds: ["UI-001"],
          what: `mirrored, an overlay ${width} wide did not lean ${expected}`,
        },
      );
    }

    // Nothing here is a reason to answer with something that is not a side. A window with no width,
    // an anchor off the screen, a width of nothing or of nonsense: each still picks an edge.
    const degenerate = {
      noViewport: decideOverlayAlignment({ anchorLeft: 0, anchorRight: 0, viewportWidth: 0, desiredWidth: 100 }),
      offScreen: decide({ anchorLeft: 2000, anchorRight: 2100, desiredWidth: 100 }),
      noWidth: decide({ anchorLeft: 100, anchorRight: 200, desiredWidth: 0 }),
      notANumber: decide({ anchorLeft: 100, anchorRight: 200, desiredWidth: Number.NaN }),
    };
    ctx.log.note("inputs that are not measurements", degenerate);

    expectClaim(Object.values(degenerate).every((each) => each === "left" || each === "right"), {
      claimIds: ["A11Y-004"],
      what: "an overlay answered with something that is not a side it can be anchored to",
      detail: JSON.stringify(degenerate),
    });
  },
);
