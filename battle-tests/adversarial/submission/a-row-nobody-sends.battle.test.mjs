/**
 * A row the form will throw away, and will not tell a server about.
 *
 * `getChanges()` is documented as the fields whose value differs from the schema's initial values,
 * ready for an API `PATCH`. `reset()` is documented as returning the form to those same initial
 * values. They are two readings of one baseline, and they do not agree about a row.
 *
 * Declare a row and the form holds it. `reset()` throws it away, which says the baseline has no such
 * row. `getChanges()` reports nothing, which says there is nothing new. Both cannot be true, and the
 * one a consumer acts on decides whether a row a user created is ever sent.
 *
 * What is reported is only what was written to a row *after* it was declared. A row created as
 * `upsert("a", { code: "A" })` and left alone is invisible to `getChanges()`; edit one of its cells
 * and that cell alone appears. So a form where the user added three lines and typed in none of them
 * produces an empty patch, and a form where they added three and corrected one produces a patch
 * holding one cell of one line.
 *
 * The control is a plain field: edited, it is reported. The mechanism works — it is the values a row
 * is born with that fall through it.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["SUB-001", "COL-001"],
    title: "a row the form would reset away is a row it reports as a change",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The control: the mechanism reports what it is meant to report.
    const plain = ctx.open(KEYED_ROWS_SPEC);
    await plain.execute({ type: "field.set", path: "title", value: "changed" });
    expectEqual(plain.form.getChanges(), { title: "changed" }, {
      claimIds: ["SUB-001"],
      what: "an edited field was not reported as a change, so nothing below is about collections",
    });
    plain.destroy();

    for (const [what, spec, declare, path] of [
      ["a keyed row", KEYED_ROWS_SPEC, { type: "record.upsert", path: "rows", key: "a", value: { code: "A" } }, "rows"],
      ["a positional row", POSITIONAL_ROWS_SPEC, { type: "array.push", path: "items", value: { code: "A", note: "" } }, "items"],
    ]) {
      const context = ctx.open(spec);
      await context.execute(declare);

      const held = context.form.getValue()[path];
      const changes = context.form.getChanges();

      // What the other reader of the same baseline says: reset returns the form to the schema's
      // initial values, and it throws the row away — so the baseline has no such row.
      context.form.reset();
      const afterReset = context.form.getValue()[path];
      ctx.log.note("one row, two readings of the baseline", { what, held, changes, afterReset });

      const emptyAfterReset = Array.isArray(afterReset)
        ? afterReset.length === 0
        : Object.keys(afterReset ?? {}).length === 0;

      expectClaim(emptyAfterReset, {
        claimIds: ["COL-001"],
        what: `${what} survived a reset, so the baseline may include it after all and this battle asks the wrong question`,
        detail: JSON.stringify(afterReset),
      });

      // Then it is not part of the baseline, and a form holding it differs from its initial values.
      expectClaim(Object.keys(changes).length > 0, {
        claimIds: ["SUB-001", "COL-001"],
        what: `${what} is thrown away by reset and reported by getChanges as no change at all, so a patch built from it never carries the row`,
        detail: JSON.stringify({ held, changes }),
      });

      context.form.destroy();
    }
  },
);

battle(
  {
    claims: ["SUB-001"],
    title: "what a row is edited to is reported, which is how the omission stays quiet",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The half that works, and the reason the half above goes unnoticed: a consumer who edits a cell
    // sees a patch and concludes the mechanism is working.
    const context = ctx.open(KEYED_ROWS_SPEC);
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await context.execute({ type: "field.set", path: "rows.a.note", value: "N" });
    const changes = context.form.getChanges();
    ctx.log.note("a row declared, then one cell edited", { changes });

    expectEqual(changes, { rows: { a: { note: "N" } } }, {
      claimIds: ["SUB-001"],
      what: "an edit inside a row was not reported",
    });

    // And the cell the row was born with is not in it, beside the one that was typed.
    expectClaim(changes.rows?.a?.code === undefined, {
      claimIds: ["SUB-001"],
      what: "the value a row was declared with is reported after all, which would make the battle above about something else",
      detail: JSON.stringify(changes),
    });

    context.form.destroy();
  },
);
