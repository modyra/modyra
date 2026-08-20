/**
 * The draft a person typed, and the row the server added while they were away.
 *
 * A draft is restored when it matches the form's shape, and the shape is derived from the fields the
 * form declares — including the rows a collection was built with. An edit screen is built from server
 * data, so its rows are not a constant: another user appends a line, a background job adds one, the
 * same screen is opened tomorrow.
 *
 * When that happens the draft is dropped whole, and **nothing is said on either channel**:
 *
 *     same rows                    title restored     onViolation []   diagnostics []
 *     server added a row           title lost         onViolation []   diagnostics []
 *     server removed a row         title lost         onViolation []   diagnostics []
 *     a field added to the form    title lost         onViolation []   diagnostics []
 *
 * `title` is a plain leaf that has nothing to do with the collection. It is dropped because the
 * *form's* shape moved, not because anything about that field did.
 *
 * The silence is what this battle is about rather than the discard. `hostile-input.md` documents the
 * neighbouring path and documents it differently: a stored value of the wrong type for one field is
 * refused **per field**, the rest of the draft is restored, and the interception arrives on
 * `onViolation` as `draft-shape:<path>`. A shape the form no longer has takes everything and reports
 * nothing — so a consumer cannot tell "there was no draft" from "there was a draft and it was
 * dropped", and cannot say the one sentence that would matter to the person who typed it.
 *
 * Discarding on a shape change is defensible: the store is hostile ground, ADR 0009 calls this
 * defence in depth, and a draft written against a different shape is not obviously the same work.
 * Being unable to *notice* it is the part with no argument for it.
 *
 * Green when a draft dropped because the form's shape moved is a draft the consumer is told about.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SAVED = 900;
const RESTORED = 400;

/** A form of one plain leaf and one keyed collection, built with the rows a server supplied. */
const formOf = (rows) => ({
  title: field(""),
  rows: record(group({ code: field("") }), { initial: rows }),
});

/**
 * One session types, the next session opens the same key. What came back, and what was said.
 *
 * `onViolation` lives under `security`, not at the top level — passing it there is reported as
 * `MDY_UNSUPPORTED_ADAPTER_OPTION`, which is the engine catching the probe rather than the product.
 */
async function acrossTwoSessions(first, second) {
  const store = new Map();
  const violations = [];
  const diagnostics = [];
  const options = () => ({
    devWarnings: false,
    draft: {
      key: "shared",
      storage: {
        read: (key) => store.get(key) ?? null,
        write: (key, value) => store.set(key, value),
        remove: (key) => store.delete(key),
      },
    },
    security: { onViolation: (violation) => violations.push(`${violation.kind}:${violation.path ?? ""}`) },
    diagnostics: { report: ({ code }) => diagnostics.push(code) },
  });

  const before = createForm(first(), options());
  before.f.title.set("what the person typed");
  await new Promise((resolve) => setTimeout(resolve, SAVED));
  const stored = store.get("shared");
  before.destroy();

  const after = createForm(second(), options());
  await new Promise((resolve) => setTimeout(resolve, RESTORED));
  const restored = after.getValue().title;
  after.destroy();

  return {
    stored: typeof stored === "string" && stored.includes("what the person typed"),
    restored,
    told: [...new Set([...violations, ...diagnostics])],
  };
}

const ONE_ROW = { r1: { code: "" } };
const TWO_ROWS = { r1: { code: "" }, r2: { code: "" } };

battle(
  {
    // API-001, not PER-001. Nothing here is corrupted, resurrected or let through: the draft is
    // discarded, which is defensible, and the discard cannot be observed, which is a published call
    // that could not do what it was asked and did not say so. Citing a persistence claim would put an
    // S0 on a defect that loses no integrity.
    claims: ["API-001"],
    title: "a draft dropped because the form's shape moved is one the consumer is told about",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with the shape unchanged the draft comes back. Without it, "nothing was restored"
    // would describe a probe that never stored anything.
    const unchanged = await acrossTwoSessions(() => formOf(ONE_ROW), () => formOf(ONE_ROW));
    ctx.log.note("the same form, opened again", unchanged);
    expectClaim(unchanged.stored && unchanged.restored === "what the person typed", {
      claimIds: ["API-001"],
      what: "a draft does not survive even an unchanged shape, so this battle is not about the shape",
      detail: JSON.stringify(unchanged),
    });

    const moved = {
      "the server added a row": await acrossTwoSessions(() => formOf(ONE_ROW), () => formOf(TWO_ROWS)),
      "the server removed a row": await acrossTwoSessions(() => formOf(TWO_ROWS), () => formOf(ONE_ROW)),
      "a field was added to the form": await acrossTwoSessions(
        () => ({ title: field("") }),
        () => ({ title: field(""), extra: field("") }),
      ),
    };
    ctx.log.note("the same key, a form whose shape moved", moved);

    // Each case has to have written a draft, or "it was not restored" is about the writing.
    expectEqual(Object.entries(moved).filter(([, result]) => !result.stored).map(([name]) => name), [], {
      claimIds: ["API-001"],
      what: "a case wrote no draft at all, so what it reports about restoring is not evidence",
    });

    // The measurement, stated as the property rather than as the loss: whichever way the shape moved,
    // somebody could ask.
    expectEqual(
      Object.entries(moved)
        .filter(([, result]) => result.restored !== "what the person typed" && result.told.length === 0)
        .map(([name]) => name),
      [],
      {
        claimIds: ["API-001"],
        what: "a draft was discarded because the form's shape moved and neither onViolation nor a diagnostic said so, leaving a consumer unable to tell an absent draft from a dropped one",
        detail: JSON.stringify(moved),
      },
    );
  },
);
