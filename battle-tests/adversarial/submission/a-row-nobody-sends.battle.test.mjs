/**
 * A row the form would throw away, and what it tells a server about it.
 *
 * `getChanges()` is documented as the fields whose value differs from the schema's initial values,
 * ready for an API `PATCH`. `reset()` is documented as returning the form to those same initial
 * values. They are two readings of one baseline, and they must agree about a row: `reset()` throws a
 * declared row away, so the baseline has no such row, so everything in it is new.
 *
 * They did not. A row created as `upsert("a", { code: "A" })` and left alone was invisible to
 * `getChanges()`; edit one of its cells and that cell alone appeared. A form where a user added three
 * lines and typed in none produced an empty patch, and one where they added three and corrected one
 * produced a patch holding one cell of one line.
 *
 * Both battles below now hold, and they are kept as the regression: the first that a declared row is
 * a change, the second that **every** cell of it is — including the ones left at their seed, because
 * a row that did not exist has nothing unchanged in it.
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
    await plain.dispose();

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
    title: "a row reports everything it gained, whether by declaration or by edit",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // What a row reports having gained. This used to be the *reason* the defect above went unnoticed:
    // an edited cell was reported and the cell an `upsert` introduced was not, so a consumer editing
    // one cell saw a patch and concluded the mechanism worked.
    const context = ctx.open(KEYED_ROWS_SPEC);
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await context.execute({ type: "field.set", path: "rows.a.note", value: "N" });
    const changes = context.form.getChanges();
    ctx.log.note("a row declared, then one cell edited", { changes });

    // Every cell of the row, including the two left at their seed: the row did not exist before, so
    // nothing in it is unchanged. `tax` is `""` because that is where a text cell starts.
    expectEqual(changes, { rows: { a: { code: "A", note: "N", tax: "" } } }, {
      claimIds: ["SUB-001"],
      what: "a row did not report everything it gained — the cell an upsert declared, or the cell an edit changed",
    });

    // The control, and it is what keeps this from passing on an empty answer: a plain field edited
    // the ordinary way is reported, so a row reporting nothing would be about rows and not about
    // `getChanges` being silent altogether.
    expectClaim(Object.keys(changes).length > 0 && changes.rows?.a !== undefined, {
      claimIds: ["SUB-001"],
      what: "the row is not in the change set at all, so the comparison above is against nothing",
      detail: JSON.stringify(changes),
    });

    context.form.destroy();
  },
);
