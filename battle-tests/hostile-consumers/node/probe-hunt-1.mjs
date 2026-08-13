/**
 * Hunt loops 1–6: what the wire form keeps, and what async work does when structure moves.
 */
import {
  buildDynamicFormSchema,
  createForm,
  field,
  flattenDynamicForm,
  group,
  record,
  array,
  parseDynamicForm,
} from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 1. A nested collection with no rows: does the wire form still say what it is?
{
  const schema = {
    node: "group",
    children: {
      orders: {
        node: "record",
        item: {
          node: "group",
          children: {
            lines: {
              node: "record",
              item: { node: "group", children: { sku: { node: "field", field: { kind: "text", label: "S" } } } },
            },
          },
        },
      },
    },
  };
  const flat = flattenDynamicForm(schema);
  line("1. empty nested — fields", JSON.stringify(flat.fields.map((f) => f.name)));
  line("1. empty nested — collections", JSON.stringify(flat.collections));
  const parsed = parseDynamicForm({ version: 3, id: "x", schema });
  line("1. parse ok", `${parsed.ok} ${JSON.stringify(parsed.collections)}`);
}

// ── 2. Rows created at runtime, then flattened by a consumer rebuilding from the contract.
{
  const doc = {
    version: 3,
    id: "r",
    schema: {
      node: "group",
      children: {
        rows: {
          node: "record",
          item: { node: "group", children: { sku: { node: "field", field: { kind: "text", label: "S" } } } },
        },
      },
    },
  };
  const form = createForm(buildDynamicFormSchema(doc.schema), { devWarnings: false });
  form.f.rows.setAll({ 0: { sku: "A" }, 1: { sku: "B" } });
  line("2. runtime numeric keys", JSON.stringify(form.getValue()));
  line("2. isArray", String(Array.isArray(form.getValue().rows)));
}

// ── 3. A draft that carries a nested collection with numeric keys.
{
  const schema = () => ({
    orders: record(group({ lines: record(group({ sku: field("") })) })),
  });
  const store = new Map();
  const storage = { read: (k) => store.get(k) ?? null, write: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  const first = createForm(schema(), { draft: { key: "d", storage, debounceMs: 0 }, devWarnings: false });
  first.f.orders.upsert("o1", { lines: { 0: { sku: "S0" }, 1: { sku: "S1" } } });
  await new Promise((r) => setTimeout(r, 30));
  first.destroy();
  const second = createForm(schema(), { draft: { key: "d", storage, debounceMs: 0 }, devWarnings: false });
  const restored = second.getValue();
  line("3. draft restored", JSON.stringify(restored));
  line("3. lines isArray", String(Array.isArray(restored.orders?.o1?.lines)));
  second.destroy();
}

// ── 4. Redo of an undone nested rename.
{
  const form = createForm(
    { orders: record(group({ lines: record(group({ sku: field("") })) })) },
    { history: true, devWarnings: false },
  );
  form.f.orders.upsert("o1", { lines: { l1: { sku: "S" } } });
  await tick();
  form.f.orders.rename("o1", "o2");
  await tick();
  form.undo();
  await tick();
  line("4. after undo", JSON.stringify(form.f.orders.keys()));
  form.redo();
  await tick();
  line("4. after redo", `${JSON.stringify(form.f.orders.keys())} ${JSON.stringify(form.getValue())}`);
  form.redo();
  await tick();
  line("4. after a second redo", JSON.stringify(form.f.orders.keys()));
  form.destroy();
}

// ── 5. asyncDependsOn pointing across a collection boundary.
{
  const seen = [];
  const validator = (value, ctx) => {
    seen.push({ path: ctx.path, value, dependency: ctx.form.fieldValue("header.currency") });
    return Promise.resolve([]);
  };
  const form = createForm(
    {
      header: group({ currency: field("EUR") }),
      rows: record(group({
        price: field("", [], { asyncValidators: [validator], asyncDependsOn: ["header.currency"] }),
      })),
    },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { price: "10" });
  await tick();
  form.f.header.currency.set("USD");
  await tick();
  line("5. runs after dependency change", JSON.stringify(seen));
  form.destroy();
}

// ── 6. A timeout racing a removal.
{
  const started = [];
  const validator = (value, ctx) => new Promise((resolve) => {
    started.push({ path: ctx.path, resolve });
  });
  const form = createForm(
    { rows: record(group({ tax: field("", [], { asyncValidators: [validator], asyncTimeoutMs: 20 }) })) },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { tax: "T" });
  await tick();
  form.f.rows.remove("a");
  await new Promise((r) => setTimeout(r, 40));
  line("6. after timeout past a removed row", `keys=${JSON.stringify(form.f.rows.keys())} pending=${form.state.pending()} valid=${form.state.valid()} fields=${JSON.stringify(form.fieldNames())}`);
  started[0]?.resolve(["late"]);
  await tick();
  line("6. after the late answer", `keys=${JSON.stringify(form.f.rows.keys())} pending=${form.state.pending()} value=${JSON.stringify(form.getValue())}`);
  form.destroy();
}
