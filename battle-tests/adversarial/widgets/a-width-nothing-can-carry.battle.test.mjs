/**
 * A number the contract declares and no published path can carry.
 *
 * `capabilities.anchoring` is where a kind states how its overlay is placed: whether the popup takes
 * the anchor's width, how much room it needs to open downwards, which edge it aligns to, and how
 * narrow it may get. Three kinds declare the last one — `select` and `multiselect` at 160, `colors`
 * at 280.
 *
 * The path from that declaration to an element is published in full. `decideOverlayPlacement` turns
 * the situation into a decision; `overlayStyleProperties` turns the decision into custom properties;
 * `MDY_CSS_PROPERTIES.overlay` names the eight the overlay is positioned with. A minimum width
 * appears in none of them: the decision carries `placement`, `alignment`, `maxHeight`, `width` and
 * `fits`, and the eight properties are top, bottom, left, right, width, max-width, max-height and
 * transform.
 *
 * So the number is stated, and there is nowhere for it to go. This is the same shape as a flag a
 * document sets that no protection reads — declared, type-correct, inert — and its consequence is
 * visible rather than dangerous: a colours popup measured at 142px against a declared 280, in a
 * 1280px viewport with room for either.
 *
 * The whole chain is readable in one process, so nothing here depends on a renderer having been
 * built correctly.
 */

import {
  MDY_CSS_PROPERTIES,
  MDY_WIDGET_CONTRACTS,
  decideOverlayPlacement,
  overlayStyleProperties,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A situation with room for any of the declared minimums, so a refusal is never about space. */
const SITUATION = Object.freeze({
  anchor: Object.freeze({ top: 100, bottom: 130, left: 40, right: 106, width: 66, height: 30 }),
  viewport: Object.freeze({ width: 1280, height: 800 }),
});

battle(
  {
    claims: ["UI-010"],
    title: "a declared minimum width has somewhere to go",
    environments: ["node"],
  },
  async (ctx) => {
    const declaring = Object.entries(MDY_WIDGET_CONTRACTS)
      .filter(([, contract]) => typeof contract.capabilities?.anchoring?.minWidth === "number")
      .map(([kind, contract]) => [kind, contract.capabilities.anchoring.minWidth]);
    ctx.log.note("kinds declaring a minimum overlay width", { declaring });

    // The control: the declaration exists and is a number. Without it the rest is about a property
    // nobody ever stated.
    expectClaim(declaring.length > 0, {
      claimIds: ["UI-010"],
      what: "no kind declares a minimum overlay width, so this battle is about nothing",
    });

    // The decision the published placement function produces.
    const decision = decideOverlayPlacement({ ...SITUATION, ...MDY_WIDGET_CONTRACTS.colors.capabilities.anchoring });
    ctx.log.note("what a placement decision carries", { keys: Object.keys(decision) });

    // The properties an overlay is positioned with, both as the vocabulary names them and as the
    // published function emits them.
    const named = Object.keys(MDY_CSS_PROPERTIES.overlay);
    const emitted = Object.keys(overlayStyleProperties(decision));
    ctx.log.note("the published path from a decision to an element", { named, emitted });

    // The control: the path is real and carries the neighbouring numbers, so an absence below is
    // this property rather than a pipeline that emits nothing.
    expectClaim(named.includes("maxHeight") && emitted.some((property) => property.includes("max-height")), {
      claimIds: ["UI-010"],
      what: "the overlay properties do not carry a maximum height either, so the path is not the thing being tested",
      detail: () => JSON.stringify({ named, emitted }),
    });

    const carries = (haystack, needle) => haystack.some((each) => each.toLowerCase().replace(/-/g, "").includes(needle));

    expectEqual(
      [carries(Object.keys(decision), "minwidth"), carries(named, "minwidth"), carries(emitted, "minwidth")],
      [true, true, true],
      {
        claimIds: ["UI-010"],
        what: "a minimum width is declared per kind and no decision, vocabulary or emitted property can carry it",
        detail: () => JSON.stringify({
          declaring,
          decision: Object.keys(decision),
          named,
          emitted,
        }),
      },
    );
  },
);
