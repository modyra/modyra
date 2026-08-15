/**
 * A claim that broke, and a detail that cannot be produced.
 *
 * A form owns its scheduler, so the object graph around one is circular and `JSON.stringify` of
 * anything holding it throws. Built at the call site, that throw happens *before* the assertion is
 * entered: the battle dies with a `TypeError` about circular structure and the claim it was about is
 * never reported. It happened to `storage-that-refuses`, where an S0 was read as broken on the
 * strength of its own report line.
 *
 * Passing a function is what makes the detail safe. This fixture breaks a claim with one that throws,
 * and what must come out is the claim — not the detail's error.
 *
 * Run as a child process by `harness/harness.test.mjs`.
 */

import { battle } from "../battle.mjs";
import { expectClaim } from "../assertions.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/** Circular, the way a live form is. */
const circular = {};
circular.self = circular;

battle(
  {
    claims: ["COL-002"],
    title: "self-check: a detail that cannot be produced does not replace the claim",
    environments: ["node"],
  },
  async (ctx) => {
    ctx.open(KEYED_ROWS_SPEC);

    // The claim that holds: its detail is never asked for, so a detail that would throw costs
    // nothing at all.
    expectClaim(true, {
      claimIds: ["COL-002"],
      what: "a claim that holds",
      detail: () => JSON.stringify(circular),
    });

    // And the one that breaks.
    expectClaim(false, {
      claimIds: ["COL-002"],
      what: "the promise this battle is about",
      detail: () => JSON.stringify(circular),
    });
  },
);
