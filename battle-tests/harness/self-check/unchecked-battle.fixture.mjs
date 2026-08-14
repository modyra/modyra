/**
 * A battle that attacks and never checks.
 *
 * It declares a row, edits it, removes it and mounts a control — real operations, all recorded — and
 * makes no assertion about any of it. The wrapper counts what a battle did; a battle that did
 * something but concluded nothing is the half `actions` cannot see.
 *
 * Run as a child process by `harness/harness.test.mjs`. A suite that accepts this file accepts every
 * test that exercises a path and never states what the path had to do.
 */

import { battle } from "../battle.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001"],
    title: "self-check: a battle that asserts nothing must fail",
    requires: ["structural", "mountedPhases"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "x" } });
    await context.execute({ type: "field.set", path: "rows.a.note", value: "edited" });
    await context.execute({ type: "mount", paths: ["rows.a.code"] });
    await context.execute({ type: "record.remove", path: "rows", key: "a" });
    // No expectClaim, no expectSameObservation, no expectEqual. The form is never asked anything.
  },
);
