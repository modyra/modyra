/**
 * A battle that fails on purpose.
 *
 * The suite's own acceptance criterion — a break becomes a replayable artefact — cannot be proven by
 * a passing test. This fixture is run as a child process by `harness/harness.test.mjs`, which reads
 * the report it leaves behind and replays it. It is named `.fixture.mjs` so the suite's own test
 * glob never picks it up.
 */

import { battle } from "../battle.mjs";
import { expectSameObservation } from "../assertions.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001"],
    title: "self-check: a deliberately wrong expectation produces an artefact",
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "x" } });
    await context.execute({ type: "mount", paths: ["rows.a.code"] });

    const actual = context.observe("after upsert");
    const wrong = { ...actual, valid: !actual.valid };

    expectSameObservation(actual, wrong, {
      claimIds: ["COL-001"],
      what: "self-check divergence",
    });
  },
);
