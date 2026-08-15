/**
 * The same two thousand rows, written two ways.
 *
 * A collection gets its rows in bulk more often than one at a time: an import, a fetch, a draft
 * restored, a wizard step that arrives with what the previous one produced. Both kinds have a
 * whole-value write for exactly that, and one of them scales with the number of rows while the other
 * does not.
 *
 * Measured on two schemas with the same three cells, the same async validator and the same row
 * count, doubling the rows each time:
 *
 *     items.setAll   9 → 21 → 40 → 84 ms      each doubling costs about twice as much
 *     rows.setAll   35 → 100 → 345 → 1289 ms  each doubling costs about three and a half times
 *
 * So the positional route is linear and the keyed one is not, and at two thousand rows they are 84ms
 * and 1289ms apart. Declaring them one at a time is worse again — `items.push` in a loop takes 25
 * seconds for the same two thousand — but a loop has a bulk alternative to point at, and
 * `rows.setAll` *is* the alternative.
 *
 * Timing is a poor thing to assert, so nothing here asserts a duration. Both assertions are ratios:
 * one route against the other at one size, and each route against itself as the size grows. A slower
 * machine moves both numbers together and neither ratio moves, which is what makes them safe to run
 * beside checks that care about correctness.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";
import { KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC, buildSchema } from "../../models/schemas.mjs";

const open = (spec) => createForm(buildSchema(spec).schema, { reactivity: vanillaReactivity(), devWarnings: false });

/** Milliseconds one bulk write takes, on a form that exists only for it. */
function timeBulkWrite(kind, count) {
  const form = open(kind === "keyed" ? KEYED_ROWS_SPEC : POSITIONAL_ROWS_SPEC);
  const value = kind === "keyed"
    ? Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, { code: `c${index}` }]))
    : Array.from({ length: count }, (_, index) => ({ code: `c${index}`, note: "", tax: "" }));
  const handle = kind === "keyed" ? form.f.rows : form.f.items;

  const started = process.hrtime.bigint();
  handle.setAll(value);
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;

  const written = kind === "keyed"
    ? Object.keys(form.getValue().rows ?? {}).length
    : (form.getValue().items ?? []).length;
  form.destroy();
  return { elapsed, written };
}

battle(
  {
    claims: ["COL-001", "COL-005"],
    title: "writing a collection in bulk costs the same per row however many there are",
    environments: ["node"],
  },
  async (ctx) => {
    const SMALL = 250;
    const LARGE = 2000;

    const measured = {};
    for (const kind of ["positional", "keyed"]) {
      const small = timeBulkWrite(kind, SMALL);
      const large = timeBulkWrite(kind, LARGE);

      // The control on the measurement: both writes landed every row. A route that silently wrote
      // nothing would be the fastest of all.
      expectClaim(small.written === SMALL && large.written === LARGE, {
        claimIds: ["COL-001"],
        what: `the ${kind} bulk write did not hold every row it was given, so its timing means nothing`,
        detail: JSON.stringify({ small, large }),
      });

      measured[kind] = {
        perRowSmall: small.elapsed / SMALL,
        perRowLarge: large.elapsed / LARGE,
        largeTotal: large.elapsed,
      };
    }

    ctx.log.note("what a bulk write costs per row", measured);

    // Each route against itself. A linear write costs the same per row at any size; a quadratic one
    // costs more per row the more rows there are. The threshold is wide — the positional route
    // measured 1.2 and the keyed one 4.6 — so machine noise does not decide it.
    for (const kind of ["positional", "keyed"]) {
      const growth = measured[kind].perRowLarge / measured[kind].perRowSmall;
      expectClaim(growth < 2.5, {
        claimIds: ["COL-005", "COL-001"],
        what: `a ${kind} bulk write of ${LARGE} rows costs ${growth.toFixed(1)}× as much per row as one of ${SMALL}`,
        detail: JSON.stringify(measured[kind]),
      });
    }

    // And the two against each other at one size, which cancels the machine entirely: the same rows
    // with the same cells through the collection's own bulk write.
    const ratio = measured.keyed.largeTotal / measured.positional.largeTotal;
    expectClaim(ratio < 5, {
      claimIds: ["COL-001", "COL-005"],
      what: `writing ${LARGE} keyed rows costs ${ratio.toFixed(1)}× what writing ${LARGE} positional rows costs`,
      detail: JSON.stringify(measured),
    });
  },
);
