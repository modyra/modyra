/**
 * A patch naming cells of a row, one collection deeper.
 *
 * A patch writes a positional row cell by cell over the row that is there: a cell the patch does not
 * name keeps what it held. The rule is about a row of a list, and a list can be reached *through*
 * another collection — orders keyed by reference, each holding its lines by position, which is the
 * shape a real form has rather than the flat one.
 *
 * So the same patch is written twice, at both depths, and has to mean the same thing:
 *
 *     patch({ list: [{ v: "NEW" }] })                 w keeps W1
 *     patch({ o: { k: { lines: [{ v: "NEW" }] } } })  w keeps W1
 *
 * A nested write reached the collection through a different route, and a route that ends in a
 * whole-row write puts the *declaration's* initial into every cell the patch did not name — a value
 * nobody entered, in a row nobody touched, on a form whose top level would have kept it.
 *
 * Green when a patch means the same at both depths. The keyed level is asserted beside them because
 * the middle collection is the thing being crossed: a repair that reached the lines by flattening the
 * order away would pass the list assertions and lose the order.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/**
 * The rows, and the cell declarations they are not.
 *
 * `field("q")` and `field("z")` are deliberately nothing the rows hold: a row rebuilt rather than
 * written over comes back carrying the *declaration's* initial, so the two are distinguishable in
 * the value rather than only in the intent.
 */
const LINES = [{ v: "V1", w: "W1" }, { v: "V2", w: "W2" }];

const flat = () => createForm(
  { list: array(group({ v: field("q"), w: field("z") }), { initial: LINES }) },
  { devWarnings: false },
);

const nested = () => createForm(
  {
    o: record(
      group({
        ref: field("r"),
        lines: array(group({ v: field("q"), w: field("z") }), { initial: LINES }),
      }),
      { initial: { k: { ref: "R", lines: LINES } } },
    ),
  },
  { devWarnings: false },
);

async function patched(make, body) {
  const form = make();
  await settled();
  form.patch(body);
  await settled();
  const value = form.getValue();
  form.destroy();
  return value;
}

battle(
  {
    claims: ["SUB-001", "COL-001", "COL-002"],
    title: "a patch names cells at every depth a list can sit at",
    environments: ["node"],
  },
  async (ctx) => {
    // The top level, which is the rule this one has to match rather than the thing under test.
    const top = await patched(flat, { list: [{ v: "NEW" }, { v: "V2" }] });
    ctx.log.note("a list at the top of the form", top);
    expectEqual(top.list, [{ v: "NEW", w: "W1" }, { v: "V2", w: "W2" }], {
      claimIds: ["SUB-001", "COL-001"],
      what: "a patch at the top level did not write the cells it named over the row that was there",
    });

    const deep = await patched(nested, { o: { k: { lines: [{ v: "NEW" }, { v: "V2" }] } } });
    ctx.log.note("the same list, reached through a keyed row", deep);

    // Every container a list can sit in, not the two this file happened to name.
    //
    // A list is reached through a keyed row, a positional row, a group, or nothing — and "at every
    // depth a list can sit at" is a claim about all four. The same inner list and the same patch body
    // are sent down each route, so a difference between them is the route and not the patch.
    const line = () => group({ v: field("q"), w: field("z") });
    const body = { lines: [{ v: "NEW" }, { v: "V2" }] };
    const throughEachContainer = {
      "a positional row": (await patched(
        () => createForm(
          { o: array(group({ lines: array(line(), { initial: LINES }) }), { initial: [{ lines: LINES }] }) },
          { devWarnings: false },
        ),
        { o: [body] },
      )).o[0].lines,
      "a keyed row": (await patched(
        () => createForm(
          { o: record(group({ lines: array(line(), { initial: LINES }) }), { initial: { k: { lines: LINES } } }) },
          { devWarnings: false },
        ),
        { o: { k: body } },
      )).o.k.lines,
      "a group": (await patched(
        () => createForm({ o: group({ lines: array(line(), { initial: LINES }) }) }, { devWarnings: false }),
        { o: body },
      )).o.lines,
      "nothing": (await patched(
        () => createForm({ lines: array(line(), { initial: LINES }) }, { devWarnings: false }),
        body,
      )).lines,
    };
    ctx.log.note("one list, four containers, one patch", throughEachContainer);

    // `w` is named by no patch, so every route must leave it as the row held it. A route that resets
    // it to the field's declared initial has rebuilt the row instead of patching it.
    const expected = [{ v: "NEW", w: "W1" }, { v: "V2", w: "W2" }];
    expectEqual(
      Object.entries(throughEachContainer)
        .filter(([, got]) => JSON.stringify(got) !== JSON.stringify(expected))
        .map(([route, got]) => `${route}: ${JSON.stringify(got)}`),
      [],
      {
        claimIds: ["SUB-001", "COL-002"],
        what: "a patch routed through one kind of container discarded the cells it did not name, so which value survives an edit depends on what the list is nested in",
      },
    );

    expectEqual(deep.o.k.lines, top.list, {
      claimIds: ["SUB-001", "COL-001", "COL-002"],
      what: "a patch meant something different one collection deeper than it does at the top",
      detail: JSON.stringify(deep),
    });

    // The order the lines were reached through is still there and still itself: a repair that got to
    // the lines by rebuilding the order would satisfy the line assertion and lose `ref`.
    expectEqual(deep.o.k.ref, "R", {
      claimIds: ["COL-002"],
      what: "the keyed row a patch was routed through did not survive the routing",
      detail: JSON.stringify(deep),
    });
  },
);
