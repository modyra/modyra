/**
 * A battle that attacks nothing.
 *
 * Run as a child process by `harness/harness.test.mjs` to prove the wrapper refuses it. A suite that
 * accepts this file accepts every test whose selector, generator or adapter quietly returned an
 * empty set.
 */

import { battle } from "../battle.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001"],
    title: "self-check: a battle that records no action must fail",
  },
  async (ctx) => {
    // Opening a form is setup, not an attack: nothing is executed and nothing is observed.
    ctx.open(KEYED_ROWS_SPEC);
  },
);
