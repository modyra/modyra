/**
 * A release blocker that reports instead of failing.
 *
 * `COL-001` is S0. Marking such a battle open would let the suite go green while carrying the very
 * finding it exists to raise — which is how an S0 on array row existence stayed green in CI once.
 * Run as a child process by `harness/harness.test.mjs`.
 */

import { battle } from "../battle.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001"],
    title: "self-check: an S0 battle may not be marked open",
    open: "waiting on a contract decision",
  },
  async (ctx) => {
    ctx.open(KEYED_ROWS_SPEC);
  },
);
