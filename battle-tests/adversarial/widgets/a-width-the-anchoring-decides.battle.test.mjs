/**
 * The number a kind declares about its overlay, and the path it travels.
 *
 * This battle exists because of a wrong accusation. `capabilities.anchoring.minWidth` was reported as
 * a declared number with nowhere to go — measured from a call to `decideOverlayPlacement` shaped as
 * `{ anchor, viewport }` where it takes a flat geometry. It answered `width: null` and
 * `placement: "overlay"` for a case with room on every side, and that degenerate answer was read as
 * evidence rather than as a wrong input.
 *
 * The chain works. Given the geometry it actually asks for, the decision carries
 * `max(anchorWidth, minWidth)` and `overlayStyleProperties` emits it as `--mdy-overlay-width`. What
 * is pinned here is that path, in both of its steps, for the two kinds that declare a minimum and
 * disagree about following their anchor.
 *
 * A guard rather than an attack, and deliberately so: a chain that was accused once and found sound
 * is worth holding, and the retraction left the claim with nothing testing it at all.
 */

import {
  MDY_WIDGET_CONTRACTS,
  decideOverlayPlacement,
  overlayStyleProperties,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** An anchor narrower than any declared minimum, with room on every side of it. */
const GEOMETRY = Object.freeze({
  anchorTop: 100, anchorBottom: 130, anchorLeft: 40, anchorRight: 106, anchorWidth: 66,
  viewportWidth: 1280, viewportHeight: 800,
  preferred: "below", desiredWidth: 0, desiredHeight: 200,
});

battle(
  {
    claims: ["UI-010"],
    title: "a declared minimum width reaches the property an overlay is sized by",
    environments: ["node"],
  },
  async (ctx) => {
    const declaring = Object.entries(MDY_WIDGET_CONTRACTS)
      .filter(([, contract]) => typeof contract.capabilities?.anchoring?.minWidth === "number");
    ctx.log.note("kinds declaring a minimum overlay width", {
      declaring: declaring.map(([kind, contract]) => [kind, contract.capabilities.anchoring.minWidth]),
    });

    // The premise: there is a minimum to carry, and it is wider than the anchor, so a decision that
    // simply echoed the anchor would fail here rather than pass by coincidence.
    expectClaim(declaring.length > 0 && declaring.every(([, c]) => c.capabilities.anchoring.minWidth > GEOMETRY.anchorWidth), {
      claimIds: ["UI-010"],
      what: "no kind declares a minimum wider than this anchor, so the assertions below prove nothing",
    });

    for (const [kind, contract] of declaring) {
      const { minWidth, minSpace } = contract.capabilities.anchoring;
      const decision = decideOverlayPlacement({ ...GEOMETRY, minWidth, minSpace: minSpace ?? 0 });
      const emitted = overlayStyleProperties(decision);
      ctx.log.note("what the anchoring decided and emitted", { kind, width: decision.width, emitted: emitted["--mdy-overlay-width"] });

      expectEqual(decision.width, minWidth, {
        claimIds: ["UI-010"],
        what: `${kind}'s placement decision did not carry the minimum width its contract declares`,
      });

      expectEqual(emitted["--mdy-overlay-width"], `${minWidth}px`, {
        claimIds: ["UI-010"],
        what: `${kind}'s decided width was not emitted as the property an overlay is sized by`,
        detail: () => JSON.stringify(emitted),
      });
    }

    // And the neighbouring number, so a change that emptied the whole emission would fail here too
    // rather than leaving this battle asserting one property that happens to survive.
    const plain = decideOverlayPlacement({ ...GEOMETRY, minWidth: 0, minSpace: 0 });
    expectClaim(String(overlayStyleProperties(plain)["--mdy-overlay-max-height"]).endsWith("px"), {
      claimIds: ["UI-010"],
      what: "the emitted properties no longer carry a maximum height, so the path itself has changed",
      detail: () => JSON.stringify(overlayStyleProperties(plain)),
    });
  },
);
