/**
 * A claim waiting for its row, and the reset that keeps it or does not.
 *
 * A consumer may say a path is disabled before any row occupies it — a table that disables a column
 * for a role, a form that locks a field until something else is answered. The engine holds the claim
 * and applies it when a row arrives; ADR 0044 then makes it belong to that row, so it travels when the
 * row does. All of that works and is asserted here.
 *
 * What it does across a `reset` depends on something the consumer cannot see:
 *
 *   setDisabled("items.0.note"), reset(), insert(0)              → the row arrives disabled
 *   setDisabled("items.0.note"), setAll([…]), reset(), insert(0) → the row arrives enabled
 *
 * The only difference is whether a row existed in between long enough for the claim to land on one.
 * A claim never applied survives the reset; one that was applied once and then reset away is
 * discarded. The consumer said the same sentence in both cases and gets two different forms.
 *
 * Found at run 4,973 of 25,000 — the shortest run count that reaches it. The nine-operation sequence
 * the campaign minimised to reduces further by hand to the four above, and the pair is what makes it a
 * finding rather than a preference: neither behaviour is wrong on its own, and they cannot both be
 * right for one sentence.
 */

import { array, createForm, field, group } from "@modyra/core";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const items = () => createForm({ items: array(group({ sku: field(""), note: field("") })) }, { devWarnings: false });

/** Which cells report themselves disabled, as `index.cell`. */
function disabledCells(form) {
  const found = [];
  for (let index = 0; index < form.f.items.length(); index += 1) {
    for (const cell of ["sku", "note"]) {
      if (form.f.items.at(index)?.[cell]?.disabled?.() === true) found.push(`${index}.${cell}`);
    }
  }
  return found;
}

battle(
  {
    claims: ["COL-008", "VAL-002"],
    title: "a claim made before the row is one the row arrives with",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the behaviour the rest is measured against: a claim waiting for a path is
    // applied to the row that arrives there.
    const waiting = items();
    try {
      waiting.setDisabled("items.0.note", () => true);
      waiting.f.items.insert(0, { sku: "A1", note: "A1" });
      ctx.log.note("a claim waiting for its row", { disabled: disabledCells(waiting) });

      expectEqual(disabledCells(waiting), ["0.note"], {
        claimIds: ["COL-008"],
        what: "a claim made before the row was not applied when the row arrived, so the pair below is not about a reset",
      });
    } finally {
      waiting.destroy();
    }

    // And it belongs to the row rather than to the index — ADR 0044, asserted so a change there shows
    // up as itself rather than as a surprise inside this battle.
    const travelling = items();
    try {
      travelling.setDisabled("items.0.note", () => true);
      travelling.f.items.setAll([{ sku: "", note: "x" }, { sku: "y", note: "z" }]);
      travelling.f.items.insert(0, { sku: "A1", note: "A1" });
      ctx.log.note("the same claim after a row is inserted above it", { disabled: disabledCells(travelling) });

      expectEqual(disabledCells(travelling), ["1.note"], {
        claimIds: ["COL-008"],
        what: "a claim that had landed on a row did not travel with that row when another was inserted above it",
      });
    } finally {
      travelling.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-008", "VAL-002", "PER-002"],
    title: "one sentence, one answer, whichever rows came and went",
    environments: ["node"],
  },
  async (ctx) => {
    const outcomes = [];

    // Never applied: the claim waits through a reset.
    const never = items();
    never.setDisabled("items.0.note", () => true);
    never.reset();
    never.f.items.insert(0, { sku: "A1", note: "A1" });
    outcomes.push({ what: "reset before any row existed", disabled: disabledCells(never) });
    never.destroy();

    // Applied once, then reset away: the claim is gone.
    const once = items();
    once.setDisabled("items.0.note", () => true);
    once.f.items.setAll([{ sku: "", note: "698" }, { sku: " ", note: "row-2" }]);
    once.reset();
    once.f.items.insert(0, { sku: "A1", note: "A1" });
    outcomes.push({ what: "a row existed in between", disabled: disabledCells(once) });
    once.destroy();

    ctx.log.note("the same claim, two histories", { outcomes });

    // The premise: the first one still works, so the second is a difference rather than the claim
    // simply not surviving resets at all.
    expectEqual(outcomes[0].disabled, ["0.note"], {
      claimIds: ["COL-008"],
      what: "a claim never applied does not survive a reset either, which is a simpler and larger finding",
    });

    expectEqual(outcomes[1].disabled, outcomes[0].disabled, {
      claimIds: ["COL-008", "VAL-002", "PER-002"],
      what: "the same claim answers differently depending on whether a row happened to exist in between, which is not something the consumer can see or control",
      detail: JSON.stringify(outcomes),
    });
  },
);
