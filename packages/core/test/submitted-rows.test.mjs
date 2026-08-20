import assert from "node:assert/strict";
import test from "node:test";

import { array, createForm, field, group } from "../dist/index.js";

/**
 * What a row of a positional collection is when it sends nothing.
 *
 * A disabled field is not submitted, and a row whose fields are all disabled therefore contributes
 * no key. Building the list from what is left makes it *shorter*, and in a positional collection the
 * index is the identity: every row after the missing one arrives at a place it does not hold.
 *
 * So the row keeps its place and holds nothing — in the shape its own declaration has, which is what
 * `MdySubmittedItemValue` says. A row of cells is `{}`, an object with none of its members. A row
 * that is a single value has no members to leave out, so it is `undefined`, which is not in a leaf's
 * domain and cannot be read back as a value the person left empty. `JSON.stringify` writes that as
 * `null`, which is the only hole an array has on the wire.
 */
test("a positional row that sends nothing holds nothing, in its own shape", () => {
  const form = createForm({
    tags: array(field("t")),
    rows: array(group({ code: field("c"), note: field("n") })),
  }, { devWarnings: false });

  form.f.tags.setAll(["a", "b", "c"]);
  form.f.rows.setAll([{ code: "c0", note: "n0" }, { code: "c1", note: "n1" }]);
  form.setDisabled("tags.1", () => true);
  form.setDisabled("rows.0.code", () => true);
  form.setDisabled("rows.0.note", () => true);

  const submitted = form.submitValue();

  /** A row that is one value: nothing, at the index it holds. */
  /** @type {import("../dist/index.js").MdySubmittedItemValue<import("../dist/index.js").MdyFieldDescriptor<string>>} */
  const word = submitted.tags[1];
  assert.equal(word, undefined);
  assert.equal(submitted.tags.length, 3, "a list of words lost a position");
  assert.deepEqual([submitted.tags[0], submitted.tags[2]], ["a", "c"]);

  // The hole is a position, not an absence: the index is present and holds nothing.
  assert.ok(1 in submitted.tags);

  /** A row of cells: an object with none of its members. */
  const row = submitted.rows[0];
  assert.deepEqual(row, {}, "a row whose cells are all disabled did not keep its place as an empty row");
  assert.equal(submitted.rows.length, 2);
  assert.deepEqual(submitted.rows[1], { code: "c1", note: "n1" });

  // What a receiver reads. An array carries one hole shape, so `undefined` degrades to `null` here
  // and the row of cells does not degrade at all.
  assert.equal(
    JSON.stringify(submitted),
    '{"tags":["a",null,"c"],"rows":[{},{"code":"c1","note":"n1"}]}',
  );

  form.destroy();
});

/**
 * A change set is the same payload through the other door, and it can be read back.
 *
 * `getChanges()` withholds a disabled cell as a submit does, so a positional row it carries may be
 * partial. Fed back through `patch()`, the cells it did not name stay as they are: rebuilding them
 * from the field declaration would put back a value the form had decided must not travel.
 */
test("a change set fed back through patch keeps the cells it did not name", () => {
  const form = createForm({
    list: array(group({ tag: field("t"), note: field("n") }), {
      initial: [{ tag: "a", note: "n0" }, { tag: "b", note: "n1" }],
    }),
  }, { devWarnings: false });

  form.cellHandle("list.0.note").set("EDITED");
  form.setDisabled("list.0.tag", () => true);

  const changes = form.getChanges();
  assert.deepEqual(changes.list[0], { note: "EDITED" }, "a disabled cell reached the change set");
  assert.deepEqual(changes.list, form.submitValue().list, "the two doors disagree");

  form.patch(changes);
  assert.deepEqual(form.getValue().list[0], { tag: "a", note: "EDITED" });

  form.destroy();
});
