/**
 * One fixed behavioural script, run identically against the workspace packages and against a packed
 * consumer installed from tarballs. It prints canonical JSON and nothing else, so the two runs are
 * compared by their output.
 *
 * Everything here goes through published entry points, and every value is synthetic.
 */
import { array, createForm, field, group, record } from "@modyra/core";

const out = {};
const tick = () => new Promise((r) => setTimeout(r, 0));

// Declaration, mounting, and the value a consumer reads.
{
  const form = createForm({ rows: record(group({ code: field(""), note: field("unset") })) });
  form.claimField("rows.a.code");
  out.beforeDeclaration = { fields: form.fieldNames(), value: form.getValue() };

  form.f.rows.upsert("a", { code: "A1" });
  out.afterDeclaration = { keys: [...form.f.rows.keys()], value: form.getValue() };

  form.f.rows.upsert("valueless");
  out.valuelessRow = form.getValue().rows.valueless;

  form.removeField("rows.a.code");
  out.afterUnmount = { valid: form.state.valid(), value: form.getValue() };

  form.f.rows.rename("a", "947");
  out.afterRename = { keys: [...form.f.rows.keys()], value: form.getValue() };

  form.destroy();
  out.afterDestroy = { value: form.getValue(), submit: form.submitValue(), destroyed: form.destroyed };
}

// Patch shapes.
{
  const form = createForm({ items: array(group({ sku: field("") })) });
  form.f.items.setAll([{ sku: "A" }, { sku: "B" }]);
  form.patch({ items: undefined });
  out.patchWithUndefined = form.getValue();
  form.patch({ items: [{ sku: "C" }] });
  out.patchWithArray = form.getValue();
  form.patch({ evil: 1 });
  out.patchWithUndeclared = { value: form.getValue(), fields: form.fieldNames() };
  form.destroy();
}

// History affordances.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { history: true });
  form.f.rows.upsert("a", { code: "A" });
  out.historySameTask = { canUndo: form.canUndo(), canRedo: form.canRedo() };
  form.undo();
  out.afterUndo = { keys: [...form.f.rows.keys()], canRedo: form.canRedo() };
  form.destroy();
}

// A verdict whose path has no field.
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { validators: [() => [{ path: "rows.ghost.code", kind: "range", message: "orphan" }]] },
  );
  form.f.rows.upsert("a", { code: "A" });
  await tick();
  out.orphanVerdict = {
    valid: form.state.valid(),
    atForm: form.errorsFor("")().map((e) => `${e.path ?? "<form>"}:${e.message}`),
  };
  form.destroy();
}

// A draft written by someone else.
{
  const stored = new Map([
    ["k", JSON.stringify({ __mdyDraft: 1, savedAt: Date.now(), value: { name: "restored", evil: 1 } })],
  ]);
  const storage = {
    read: (key) => stored.get(key) ?? null,
    write: (key, value) => stored.set(key, value),
    remove: (key) => stored.delete(key),
  };
  const form = createForm({ name: field("") }, { draft: { key: "k", storage } });
  out.draftRestore = { fields: form.fieldNames(), value: form.getValue(), submit: form.submitValue() };
  form.destroy();
}

console.log(JSON.stringify(out, null, 2));
