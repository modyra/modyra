/**
 * The same value, written through the two doors a collection offers, sanitized a different number
 * of times.
 *
 * `SEC-003` is stated as a property of the value and not of the route: a sanitized value cannot form
 * markup **wherever it entered the form**. The guide names the order — the field's own sanitizer,
 * then the form-level policy, then `off` — and says nothing about the door, because the door is not
 * supposed to matter.
 *
 * It does. A cell of a row can be written two ways, and both are ordinary:
 *
 *   form.f.rows.row("a").cell.set(v)     the user types into the control
 *   form.f.rows.upsert("a", { cell: v }) the row is loaded, added, or replaced wholesale
 *
 * The first runs the field's sanitizer once. The second runs it **twice** — as do `push`, `insert`
 * and `setValue`, which are how a form is populated from a server in the first place.
 *
 * Whether that is visible depends on the sanitizer. The one the documentation names — DOMPurify — is
 * idempotent, so it hides this completely. An escaping sanitizer is not, and escaping is what a text
 * sanitizer does:
 *
 *   round 1  "Tom &amp; Jerry"
 *   round 2  "Tom &amp;amp; Jerry"
 *   round 3  "Tom &amp;amp;amp; Jerry"
 *
 * — four load-and-save rounds against a server, with the user changing nothing, and the value is no
 * longer what anyone wrote.
 *
 * The battle does not assert that a sanitizer must be idempotent, which would be an opinion about
 * other people's functions. It asserts the property `SEC-003` already states: **the same value
 * through two doors is the same value**, counted with a sanitizer that only counts.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A sanitizer that changes nothing except how many times it has been asked. */
function counting() {
  const seen = { calls: 0 };
  return {
    seen,
    sanitize: (value) => {
      seen.calls += 1;
      return value;
    },
  };
}

/**
 * Writes one cell through `write`, and reports how many times the sanitizer was asked **for that
 * write alone**.
 *
 * `setUp` runs first and its passes are not counted, because a door that needs a row to exist before
 * it can write into one would otherwise be charged for creating it — which is a different door.
 */
function timesSanitized(build, write, setUp = () => undefined) {
  const { seen, sanitize } = counting();
  const form = createForm(build(sanitize), { devWarnings: false });
  try {
    setUp(form);
    seen.calls = 0;
    write(form);
    return seen.calls;
  } finally {
    form.destroy();
  }
}

const VALUE = "Tom & Jerry";

battle(
  {
    claims: ["SEC-003", "COL-001"],
    title: "a value is sanitized the same number of times whichever door it came through",
    environments: ["node"],
  },
  async (ctx) => {
    const rowsSchema = (sanitize) => ({ rows: record(group({ cell: field("", [], { sanitize }) })) });
    const listSchema = (sanitize) => ({ list: array(group({ cell: field("", [], { sanitize }) })) });
    const flatSchema = (sanitize) => ({ cell: field("", [], { sanitize }) });

    const doors = [
      { door: "a root field, set", count: timesSanitized(flatSchema, (f) => f.f.cell.set(VALUE)) },
      {
        door: "a row's cell, set",
        count: timesSanitized(
          rowsSchema,
          (f) => f.f.rows.row("a").cell.set(VALUE),
          (f) => f.f.rows.upsert("a", {}),
        ),
      },
      { door: "a row, upserted", count: timesSanitized(rowsSchema, (f) => f.f.rows.upsert("a", { cell: VALUE })) },
      { door: "an item, pushed", count: timesSanitized(listSchema, (f) => f.f.list.push({ cell: VALUE })) },
      { door: "an item, inserted", count: timesSanitized(listSchema, (f) => f.f.list.insert(0, { cell: VALUE })) },
      {
        door: "the whole form, set",
        count: timesSanitized(rowsSchema, (f) => f.setValue({ rows: { a: { cell: VALUE } } })),
      },
    ];
    ctx.log.note("how many times each door asks the field's sanitizer about one value", doors);

    // The instrument: every door must ask at least once, or a door that never sanitizes would look
    // like agreement with a door that sanitizes once.
    expectClaim(doors.every((entry) => entry.count >= 1), {
      claimIds: ["SEC-003"],
      what: "a door did not sanitize at all, which is a different and worse finding than the one this battle is about",
      detail: JSON.stringify(doors),
    });

    // `set` on a root field is the reference: one write, one sanitizer pass.
    const reference = doors[0].count;
    expectEqual(
      doors.filter((entry) => entry.count !== reference).map((entry) => ({ ...entry, reference })),
      [],
      {
        claimIds: ["SEC-003", "COL-001"],
        what: "one value sanitized a different number of times depending on the door it came through, so what a field holds depends on how it was written",
      },
    );
  },
);
