/**
 * Hunt loops 31–34: what a patch does to a positional collection.
 */
import { array, createForm, field, group, record } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);

const twoRows = () => {
  const form = createForm({ items: array(group({ sku: field(""), qty: field(0) })) });
  form.f.items.setAll([{ sku: "A", qty: 1 }, { sku: "B", qty: 2 }]);
  return form;
};

// ── 31. The shape the type asks for: an array.
{
  const form = twoRows();
  form.patch({ items: [{ sku: "A2" }] });
  line("31. patch with an array", JSON.stringify(form.getValue()));
  form.destroy();
}

// ── 32. The shape a consumer reaches for when they mean "row 1 only".
{
  const form = twoRows();
  line("32. before", JSON.stringify(form.getValue()));
  form.patch({ items: { 1: { sku: "B2" } } });
  line("32. after a patch keyed by index", JSON.stringify(form.getValue()));
  line("32. length", String(form.f.items.length()));
  form.destroy();
}

// ── 33. The same shape through patchValue, and against a record for comparison.
{
  const form = twoRows();
  form.patchValue({ items: { 1: { sku: "B2" } } });
  line("33. patchValue keyed by index", JSON.stringify(form.getValue()));
  form.destroy();

  const keyed = createForm({ rows: record(group({ sku: field("") })) });
  keyed.f.rows.setAll({ a: { sku: "A" }, b: { sku: "B" } });
  keyed.patch({ rows: { b: { sku: "B2" } } });
  line("33. the same call against a record", JSON.stringify(keyed.getValue()));
  keyed.destroy();
}

// ── 34. An empty object, and a null, where a collection is expected.
{
  for (const [label, partial] of [
    ["empty object", { items: {} }],
    ["null", { items: null }],
    ["empty array", { items: [] }],
    ["a string", { items: "nonsense" }],
  ]) {
    const form = twoRows();
    let threw = null;
    try {
      form.patch(partial);
    } catch (error) {
      threw = error.message;
    }
    line(`34. patch ${label}`, `${threw ? `THREW ${threw}` : JSON.stringify(form.getValue())}`);
    form.destroy();
  }
}
