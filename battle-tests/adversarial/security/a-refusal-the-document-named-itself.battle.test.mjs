/**
 * A document choosing what it will be accused of.
 *
 * The parser publishes a code↔phrase table and says what the two are for: *a consumer keys on the
 * code; the message is prose and may be reworded*. That is the right division, and the reason the
 * table exists at all — deriving one from the other would let an edit to an English sentence rename
 * a code somebody is matching on.
 *
 * The derivation is still there in the other direction. A field-level refusal builds an English
 * sentence, and the code is whichever table phrase that sentence happens to contain. The sentence
 * quotes the field's name, and the name comes from the document.
 *
 * So a document names a field after the phrase it prefers and is refused under that code. The defect
 * is the same one every time — `validators` that is not an object — and the code is whatever the
 * document asked for.
 *
 * The control is the same field with an ordinary name: it is refused under the fallback the source
 * calls "what a refusal is called when none of the named ones fits", which is the true one. So this
 * is about the name steering the code rather than about the parser reporting at random.
 */

import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The one defect used throughout, so the code is the only thing that varies. */
const THE_SAME_DEFECT = { validators: "not an object" };

const parseWithName = (name) =>
  parseDynamicForm(
    { version: 2, fields: [{ name, kind: "text", label: "L", ...THE_SAME_DEFECT }] },
    { mode: "lenient" },
  );

battle(
  {
    claims: ["DYN-003"],
    title: "a document picks which refusal it is reported under by naming a field after it",
    open: "reported, not enforced: finding 158, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary name, the true code. Named first, because every assertion below is a
    // comparison against it.
    const honest = parseWithName("ordinary");
    const truth = honest.diagnostics.map((each) => each.code);
    ctx.log.note("the same defect, under a name that says nothing", { codes: truth });

    expectEqual(truth, ["MDY_DYNAMIC_INVALID_FIELD"], {
      claimIds: ["DYN-003"],
      what: "the fallback code is not what this defect is reported as, so the comparisons below have no baseline",
      detail: JSON.stringify(honest.diagnostics),
    });

    // And now the same defect under names taken from the published table. Each phrase is one a
    // consumer is invited to key on. Every one is measured before anything is asserted, so the
    // failure carries the whole table rather than whichever entry happens to come first.
    const chosen = [];
    for (const { code, phrase } of MDY_DYNAMIC_DIAGNOSTICS) {
      const codes = parseWithName(phrase).diagnostics.map((each) => each.code);
      // A name has to survive the name check to reach the refusal that quotes it; the ones that do
      // not are not this battle's subject.
      if (codes.includes("MDY_DYNAMIC_UNSAFE_NAME")) continue;
      chosen.push({ phrase, asked: code, got: codes.join(",") });
    }
    ctx.log.note("the same defect, under names taken from the table", { chosen });

    const steered = chosen.filter((each) => each.got !== truth.join(","));
    expectEqual(steered, [], {
      claimIds: ["DYN-003"],
      what: `naming a field after a published phrase changed what the same defect is reported as, ${steered.length} of ${chosen.length} times`,
      detail: JSON.stringify(chosen),
    });

    // The premise, asserted so a future table that no longer reaches this path does not leave the
    // battle passing for the wrong reason.
    expectClaim(chosen.length > 0, {
      claimIds: ["DYN-003"],
      what: "no published phrase survived the name check, so nothing above was measured",
      detail: JSON.stringify(MDY_DYNAMIC_DIAGNOSTICS.map((each) => each.phrase)),
    });
  },
);
