/**
 * The history stacks and the signals that report them agree, and the undo stack is bounded by
 * `maxEntries` on every path that grows it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../dist/index.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("an edit still inside the debounce window invalidates redo, and canRedo says so", async () => {
  const form = createForm({ a: field("") }, { history: { debounceMs: 30 } });
  await wait(5);
  form.f.a.set("1");
  await wait(60);
  form.f.a.set("2");
  await wait(60);
  form.undo();
  assert.equal(form.canRedo(), true);

  // The edit is pending in the debounce timer; redo flushes it, which drops the redo stack, and
  // the signal that reports the stack follows.
  form.f.a.set("3");
  await wait(2);
  form.redo();
  assert.equal(form.getValue().a, "3");
  assert.equal(form.canRedo(), false, "redo was offered after a newer edit");
});

test("flushing a pending edit does not grow the undo stack past maxEntries", async () => {
  const form = createForm({ a: field("") }, { history: { debounceMs: 20, maxEntries: 2 } });
  await wait(5);
  for (const v of ["1", "2", "3"]) {
    form.f.a.set(v);
    await wait(50);
  }
  // The wait lets the effect arm the debounce timer, so redo has a pending edit to flush.
  form.f.a.set("4");
  await wait(2);
  form.redo();
  let undone = 0;
  while (form.canUndo() && undone < 10) {
    form.undo();
    undone++;
  }
  assert.ok(undone <= 2, `undo reached ${undone} entries with maxEntries 2`);
});
