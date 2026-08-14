/**
 * Hunt loops 41–44: what a destroyed form answers, and which shapes make it throw.
 */
import { array, createForm, field, group, record } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const read = (label, fn) => {
  try {
    line(label, JSON.stringify(fn()));
  } catch (error) {
    line(label, `THREW ${error.message}`);
  }
};

// ── 41. A flat schema.
{
  const form = createForm({ name: field("") }, { devWarnings: false });
  form.f.name.set("x");
  form.destroy();
  read("41. flat — getValue", () => form.getValue());
  read("41. flat — submitValue", () => form.submitValue());
  read("41. flat — value signal", () => form.value());
  read("41. flat — state.valid", () => form.state.valid());
  read("41. flat — fieldNames", () => form.fieldNames());
}

// ── 42. A schema with a keyed collection.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  form.f.rows.upsert("a", { code: "C" });
  form.destroy();
  read("42. record — getValue", () => form.getValue());
  read("42. record — submitValue", () => form.submitValue());
  read("42. record — value signal", () => form.value());
  read("42. record — getChanges", () => form.getChanges());
}

// ── 43. A schema with an array, and one with a group.
{
  const withArray = createForm({ items: array(group({ sku: field("") })) }, { devWarnings: false });
  withArray.f.items.push({ sku: "A" });
  withArray.destroy();
  read("43. array — getValue", () => withArray.getValue());

  const withGroup = createForm({ address: group({ city: field("") }) }, { devWarnings: false });
  withGroup.destroy();
  read("43. group — getValue", () => withGroup.getValue());
}

// ── 44. An empty collection at destroy: does it still throw?
{
  const empty = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  empty.destroy();
  read("44. record with no rows — getValue", () => empty.getValue());

  const mixed = createForm({ name: field(""), rows: record(group({ code: field("") })) }, { devWarnings: false });
  mixed.f.rows.upsert("a", { code: "C" });
  mixed.destroy();
  read("44. mixed — getValue", () => mixed.getValue());
  read("44. mixed — destroyed flag", () => mixed.destroyed);
}
