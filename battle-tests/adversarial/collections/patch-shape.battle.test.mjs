/**
 * A patch that says nothing must not say "delete everything".
 *
 * `patch()` takes what a consumer received. A server response omits a list, or sends `null` for it,
 * and the idiomatic call — `form.patch({ items: response.items })` — hands the form an `undefined`.
 * A keyed collection refuses such a member and says why. A positional one emptied itself, silently:
 * every row gone, no diagnostic, no error, nothing to notice.
 *
 * Rows leave because their owner said so. A malformed patch is not their owner saying so.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** Everything a consumer can hand a collection while believing they are patching one row. */
const MALFORMED = Object.freeze([
  ["null", null],
  ["undefined", undefined],
  ["an empty object", {}],
  ["an object keyed by index", { 1: { sku: "B2" } }],
  ["a string", "nonsense"],
  ["a number", 7],
]);

battle(
  {
    claims: ["COL-001", "SUB-001"],
    title: "a malformed patch member does not delete a positional collection's rows",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [what, partial] of MALFORMED) {
      const form = createForm({ items: array(group({ sku: field(""), qty: field(0) })) });
      try {
        form.f.items.setAll([{ sku: "A", qty: 1 }, { sku: "B", qty: 2 }]);
        const before = JSON.stringify(form.getValue());
        ctx.log.note("patch with a malformed array member", { what });

        form.patch({ items: partial });

        const after = JSON.stringify(form.getValue());
        expectClaim(before === after, {
          claimIds: ["COL-001", "SUB-001"],
          what: `patching an array with ${what} left the rows alone`,
          detail: `${before} became ${after}`,
        });
      } finally {
        form.destroy();
      }
    }
  },
);

/**
 * Meaningless to *both* kinds.
 *
 * An object keyed by index is not in this list: `{ 1: { … } }` names the key `"1"` for a record,
 * which is a row, and means nothing to an array. The kinds are allowed to differ where the value
 * means something to one of them.
 */
const MEANINGLESS = MALFORMED.filter(([what]) => what !== "an object keyed by index");

battle(
  {
    claims: ["COL-001"],
    title: "the two collection kinds answer a meaningless patch the same way",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [what, partial] of MEANINGLESS) {
      const keyed = createForm({ rows: record(group({ sku: field("") })) });
      const positional = createForm({ items: array(group({ sku: field("") })) });
      try {
        keyed.f.rows.setAll({ a: { sku: "A" } });
        positional.f.items.setAll([{ sku: "A" }]);
        ctx.log.note("both kinds, one malformed member", { what });

        keyed.patch({ rows: partial });
        positional.patch({ items: partial });

        const keyedKept = keyed.f.rows.keys().length === 1;
        const positionalKept = positional.f.items.length() === 1;

        // What each kind had to do, not merely that they agreed: two collections that both drop the
        // row on a malformed patch agree perfectly and have both broken COL-001. Agreement is
        // asserted as well, because a divergence between the kinds is its own finding.
        expectClaim(keyedKept, {
          claimIds: ["COL-001"],
          what: `a record keeps its row through ${what}`,
          detail: `keys=${JSON.stringify(keyed.f.rows.keys())}`,
        });

        expectClaim(positionalKept, {
          claimIds: ["COL-001"],
          what: `an array keeps its row through ${what}`,
          detail: `length=${positional.f.items.length()}`,
        });

        expectClaim(keyedKept === positionalKept, {
          claimIds: ["COL-001"],
          what: `a record and an array answer ${what} the same way`,
          detail: `record kept=${keyedKept}, array kept=${positionalKept}`,
        });
      } finally {
        keyed.destroy();
        positional.destroy();
      }
    }
  },
);
