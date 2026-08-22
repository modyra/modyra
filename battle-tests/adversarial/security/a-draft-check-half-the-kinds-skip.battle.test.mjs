/**
 * The draft's shape check, on the kinds whose empty is `null`.
 *
 * `docs/guides/security.md` lists draft shape validation under **always-on structural checks**, and
 * the paragraph is careful about why it is needed: *"A stored draft is untrusted input
 * (`localStorage` is writable by any script on the origin)"*. An object restored into a `number`
 * field is *"dropped and reported (`draft-shape`) instead of causing type confusion downstream"*.
 *
 * It then names one exemption: *"Fields without a declared initial (raw-engine usage, where drafts
 * legitimately create fields) restore as-is."*
 *
 * The exemption is wider than the sentence. What disables the check is an initial of `null` — and
 * `null` is not the absence of a declaration, it is what the contract declares for every kind with no
 * empty of its own. Measured against a hostile object stored in the draft, per kind:
 *
 *   number, select, radio, segmented, datepicker, timepicker   restored whole, nothing reported
 *   daterange                                                  restored whole, nothing reported
 *   text, textarea, email, password, colors, slider, checkbox,
 *   toggle, multiselect, file                                  dropped and reported
 *
 * Seven of seventeen. Six because their seed is `null`, which is the contract's own answer for a kind
 * that has no empty (ADR 0086), and `daterange` because its empty is itself an object, so any object
 * fits the shape.
 *
 * The kinds that skip it are not a remote corner: a number, a select, a date. A script on the origin
 * writes `{"x":{…}}` into the stored draft, and the form restores it whole into a field a renderer
 * will read as a number — the *"type confusion downstream"* the check names as the thing it prevents.
 *
 * `field(null)` is the same story from the typed side, and it is the ordinary spelling of an optional
 * field.
 *
 * The battle asserts the guide's own rule and not the mechanism: an entry a field's declared type
 * cannot hold is dropped and reported. Carrying the kind's shape into the check, or the value
 * contract, or refusing objects where the seed is `null`, all satisfy it.
 */

import {
  MDY_FIELD_KINDS,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const NEEDS_OPTIONS = new Set(["select", "radio", "multiselect", "segmented"]);
const HOSTILE = Object.freeze({ hostile: true, nested: Object.freeze({ deep: 1 }) });
const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

/** A storage already holding a draft that a script on the origin could have written. */
function storageHolding(value) {
  const written = new Map([
    ["k", JSON.stringify({ __mdyDraft: 1, savedAt: Date.now(), value })],
  ]);
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, entry) => {
      written.set(key, entry);
    },
    remove: (key) => {
      written.delete(key);
    },
  };
}

/** What one kind does when its draft entry is an object nothing of that kind could hold. */
async function restoreInto(kind) {
  const parsed = parseDynamicForm(
    {
      version: 2,
      fields: [
        {
          name: "x",
          kind,
          label: "X",
          ...(NEEDS_OPTIONS.has(kind) ? { options: [{ value: "a", label: "A" }] } : {}),
        },
      ],
    },
    { mode: "strict" },
  );
  const reported = [];
  const form = createForm(buildFlatFormSchema(parsed.fields), {
    draft: { key: "k", storage: storageHolding({ x: HOSTILE }) },
    devWarnings: false,
    security: { onViolation: (violation) => reported.push(violation.kind) },
  });
  try {
    await settle();
    return {
      kind,
      swallowed: JSON.stringify(form.getValue().x) === JSON.stringify(HOSTILE),
      reported: [...reported],
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["SEC-006", "SEC-001"],
    title: "a draft entry no field of that kind could hold is dropped and reported",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = [];
    for (const kind of MDY_FIELD_KINDS) observed.push(await restoreInto(kind));
    ctx.log.note("what each kind does with a hostile object in its stored draft", observed);

    // The instrument: the check has to work somewhere, or "seven skip it" would describe a check
    // that does not exist. And the draft has to have been read at all.
    const guarded = observed.filter((row) => !row.swallowed && row.reported.includes("draft-shape"));
    expectClaim(guarded.length >= 6, {
      claimIds: ["SEC-006"],
      what: "the draft shape check refuses nothing anywhere, so the probe is wrong before the product is",
      detail: JSON.stringify(observed.map(({ kind, swallowed, reported }) => ({ kind, swallowed, reported }))),
    });

    expectEqual(
      observed.filter((row) => row.swallowed).map((row) => row.kind),
      [],
      {
        claimIds: ["SEC-006", "SEC-001"],
        what: "a kind restored an object from untrusted storage whole and said nothing, which is the type confusion the check exists to stop",
      },
    );
  },
);
