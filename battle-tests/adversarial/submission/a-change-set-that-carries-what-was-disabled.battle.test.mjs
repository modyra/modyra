/**
 * What a change set carries out of a form that says the value is out of play.
 *
 * A disabled value is not submitted. `submitValue` keeps that everywhere — a flat field, a keyed
 * row, a positional row — and `getChanges` keeps it for a flat field and a keyed row. A positional
 * collection is carried **whole**, so that a server applying the patch by index is not guessing
 * which row is which, and whole is read off the form's value:
 *
 *     for (const [path, held] of Object.entries(this._adapter.getValue()))
 *
 * `getValue` holds every cell, disabled or not. So the two published doors answer the same question
 * — what should go to the server — differently about the same form:
 *
 *     getChanges    { list: [ { tag: "SECRET", note: "n1" }, … ] }
 *     submitValue   { list: [ {              note: "n1" }, … ] }
 *
 * A cell is disabled because something decided it must not travel: a permission rule, a mode the
 * form is in, a field the person cannot edit. `getChanges` is documented as *"ready for an API PATCH
 * request"*, so a consumer who builds a PATCH from it sends the value anyway — and a fully disabled
 * row, which a submit sends as `{}`, a patch sends complete.
 *
 * Carrying the list whole is not what is in question: a partial positional list is ambiguous and
 * carrying it whole is the answer. What is in question is where whole is read from. The rows are the
 * form's; the cells inside them are the submittable ones.
 *
 * Green when a disabled cell is absent from a change set however the collection it sits in is keyed.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

battle(
  {
    claims: ["VAL-002", "SUB-001", "COL-001"],
    title: "a change set leaves out what a submit leaves out",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the half that works: a flat field and a keyed row both drop the disabled cell
    // from the change set, so what follows is the positional carry rather than change sets at large.
    const keyed = createForm(
      {
        name: field("a"),
        rows: record(group({ tag: field("t") }), { initial: { x: { tag: "p" }, y: { tag: "q" } } }),
      },
      { devWarnings: false },
    );
    await settled();
    keyed.cellHandle("name").set("SECRET NAME");
    keyed.cellHandle("rows.x.tag").set("SECRET");
    keyed.cellHandle("rows.y.tag").set("PUBLIC");
    await settled();
    expectEqual(keyed.getChanges(), { name: "SECRET NAME", rows: { x: { tag: "SECRET" }, y: { tag: "PUBLIC" } } }, {
      claimIds: ["SUB-001"],
      what: "a change set did not report what was edited before anything was disabled",
    });
    keyed.setDisabled("name", () => true);
    keyed.setDisabled("rows.x.tag", () => true);
    await settled();
    expectEqual(keyed.getChanges(), { rows: { y: { tag: "PUBLIC" } } }, {
      claimIds: ["VAL-002", "SUB-001"],
      what: "a disabled flat field or keyed cell reached the change set",
    });
    keyed.destroy();

    const positional = createForm(
      {
        list: array(group({ tag: field("t"), note: field("n") }), {
          initial: [{ tag: "a", note: "n1" }, { tag: "b", note: "n2" }],
        }),
      },
      { devWarnings: false },
    );
    await settled();
    positional.cellHandle("list.0.tag").set("SECRET");
    positional.cellHandle("list.1.tag").set("PUBLIC");
    await settled();
    positional.setDisabled("list.0.tag", () => true);
    await settled();

    const changes = positional.getChanges();
    const submitted = positional.submitValue();
    ctx.log.note("the two doors on the same form", { changes, submitted });

    expectEqual(changes, { list: [{ note: "n1" }, { tag: "PUBLIC", note: "n2" }] }, {
      claimIds: ["VAL-002", "SUB-001", "COL-001"],
      what: "a disabled cell of a positional row reached the change set",
    });

    // The list is still carried whole — the row keeps its place and its other cells. A repair that
    // dropped the row, or the list, would fail here rather than pass by removing too much.
    expectEqual(changes.list.length, 2, {
      claimIds: ["COL-001"],
      what: "a positional change set stopped carrying its whole list",
    });

    // And the two doors agree, which is the property the pair exists to state.
    expectEqual(changes.list, submitted.list, {
      claimIds: ["SUB-001", "VAL-002"],
      what: "the change set and the submitted value disagree about a disabled cell",
    });
    positional.destroy();
  },
);
