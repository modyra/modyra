/**
 * Hunt loops 25–30: positional collections under churn, and what a form leaves behind.
 */
import { array, createForm, field, group, record } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 25. A verdict in flight while its row moves inside the array.
{
  const runs = [];
  const validator = (value, ctx) => new Promise((resolve) => {
    const run = { path: ctx.path, value, resolve, aborted: false };
    ctx.signal.addEventListener("abort", () => { run.aborted = true; });
    runs.push(run);
  });
  const form = createForm(
    { items: array(group({ sku: field("", [], { asyncValidators: [validator] }) })) },
    { devWarnings: false },
  );
  form.f.items.push({ sku: "A" });
  form.f.items.push({ sku: "B" });
  await tick();
  line("25. runs", JSON.stringify(runs.map((r) => ({ p: r.path, v: r.value }))));

  form.f.items.move(0, 1);
  await tick();
  line("25. after move", `value=${JSON.stringify(form.getValue())} runs=${JSON.stringify(runs.map((r) => ({ p: r.path, v: r.value, a: r.aborted })))}`);

  // The run started for index 0 (value "A") answers with an error. "A" now lives at index 1.
  runs[0].resolve(["A is rejected"]);
  await tick();
  line("25. verdict after the move", `0=${JSON.stringify(form.errorsFor("items.0.sku")())} 1=${JSON.stringify(form.errorsFor("items.1.sku")())}`);
  form.destroy();
}

// ── 26. Removing an array row while a control is mounted on it, then undoing.
{
  const form = createForm(
    { items: array(group({ sku: field("") })) },
    { history: true, devWarnings: false },
  );
  form.f.items.push({ sku: "A" });
  form.f.items.push({ sku: "B" });
  await tick();
  form.claimField("items.1.sku");
  form.f.items.remove(0);
  await tick();
  line("26. after removing index 0", `value=${JSON.stringify(form.getValue())} fields=${JSON.stringify(form.fieldNames())}`);
  form.undo();
  await tick();
  line("26. after undo", `value=${JSON.stringify(form.getValue())} fields=${JSON.stringify(form.fieldNames())}`);
  form.destroy();
}

// ── 27. A patch naming array rows by index.
{
  const form = createForm({ items: array(group({ sku: field("") })) }, { devWarnings: false });
  form.f.items.setAll([{ sku: "A" }, { sku: "B" }]);
  form.patch({ items: { 1: { sku: "B2" } } });
  line("27. patch by index", JSON.stringify(form.getValue()));
  line("27. isArray", String(Array.isArray(form.getValue().items)));
  form.destroy();
}

// ── 28. setValue with fewer rows, then undo.
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { history: true, devWarnings: false },
  );
  form.f.rows.setAll({ a: { code: "A" }, b: { code: "B" } });
  await tick();
  form.setValue({ rows: { a: { code: "A2" } } });
  await tick();
  line("28. after setValue", `keys=${JSON.stringify(form.f.rows.keys())} value=${JSON.stringify(form.getValue())}`);
  form.undo();
  await tick();
  line("28. after undo", `keys=${JSON.stringify(form.f.rows.keys())} value=${JSON.stringify(form.getValue())}`);
  form.destroy();
}

// ── 29. mutate() around a structural change: one undo step, or several?
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { history: true, devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "A" });
  await tick();
  form.mutate(() => {
    form.f.rows.upsert("b", { code: "B" });
    form.f.rows.cell("a", "code").set("A2");
    form.f.rows.upsert("c", { code: "C" });
  });
  await tick();
  line("29. after mutate", JSON.stringify(form.f.rows.keys()));
  form.undo();
  await tick();
  line("29. one undo", `keys=${JSON.stringify(form.f.rows.keys())} value=${JSON.stringify(form.getValue())}`);
  form.destroy();
}

// ── 30. Churn: does anything accumulate per key that never comes back?
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  const rx = form.reactivity;
  for (let i = 0; i < 500; i += 1) {
    const key = `tmp:${i}`;
    form.claimField(`rows.${key}.code`);
    form.setDisabled(`rows.${key}.code`, rx.signal(true));
    form.f.rows.upsert(key, { code: "x" });
    form.removeField(`rows.${key}.code`);
    form.f.rows.remove(key);
  }
  line("30. after 500 declare/remove cycles", `fields=${form.fieldNames().length} keys=${form.f.rows.keys().length}`);
  const heap = process.memoryUsage().heapUsed / 1024 / 1024;
  line("30. heap (MB, indicative)", heap.toFixed(1));
  form.destroy();
  line("30. after destroy", `destroyed=${form.destroyed}`);
}
