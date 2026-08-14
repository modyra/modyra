/**
 * Hunt loops 35–40: who owns a handle, what a schema adapter knows about rows, what security does
 * inside a collection, and what a destroyed form still answers.
 */
import {
  createForm,
  field,
  group,
  getFieldHandleOwner,
  handleFormOf,
  observerFor,
  record,
  vanillaReactivity,
} from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 35. A cell handle's owner, and what observerFor answers for it.
{
  const rx = vanillaReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: rx, devWarnings: false });
  form.f.rows.upsert("a", { code: "C" });
  const cell = form.f.rows.cell("a", "code");

  line("35. owner is the form's runtime", String(getFieldHandleOwner(cell) === rx));
  line("35. handleFormOf", String(handleFormOf(cell) === form));
  line("35. observerFor(owner)", String(observerFor(cell, rx) === rx));

  const foreign = vanillaReactivity();
  let diagnostic = null;
  const realWarn = console.warn;
  console.warn = (...args) => { diagnostic = args.join(" "); };
  const chosen = observerFor(cell, foreign);
  console.warn = realWarn;
  line("35. observerFor(foreign)", `chose=${chosen === foreign ? "foreign" : chosen === rx ? "owner" : "other"} diagnostic=${diagnostic ?? "none"}`);
  form.destroy();
}

// ── 36. A handle whose form was destroyed.
{
  const rx = vanillaReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: rx, devWarnings: false });
  form.f.rows.upsert("a", { code: "C" });
  const cell = form.f.rows.cell("a", "code");
  form.destroy();

  let threw = null;
  let read = null;
  try { read = cell.value(); } catch (error) { threw = error.message; }
  line("36. reading a cell after destroy", threw ? `THREW ${threw}` : JSON.stringify(read));

  let setThrew = null;
  try { cell.set("after"); } catch (error) { setThrew = error.message; }
  line("36. writing a cell after destroy", setThrew ? `THREW ${setThrew}` : JSON.stringify(cell.value()));
  line("36. form value after destroy", (() => { try { return JSON.stringify(form.getValue()); } catch (e) { return `THREW ${e.message}`; } })());
}

// ── 37. Two forms, one path: does a handle from one reach the other?
{
  const a = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  const b = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  a.f.rows.upsert("k", { code: "A" });
  b.f.rows.upsert("k", { code: "B" });
  const fromA = a.f.rows.cell("k", "code");
  fromA.set("A2");
  line("37. two forms, same path", `a=${JSON.stringify(a.getValue())} b=${JSON.stringify(b.getValue())}`);
  line("37. handleFormOf points at its own form", String(handleFormOf(fromA) === a));
  a.destroy();
  b.destroy();
}

// ── 38. Sanitisation and length caps inside a row.
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { security: { sanitize: "strict", maxValueLength: 8 }, devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "<script>alert(1)</script>" });
  line("38. row value after sanitising", JSON.stringify(form.getValue()));
  form.f.rows.cell("a", "code").set("0123456789abcdef");
  line("38. row value after a long write", JSON.stringify(form.getValue()));
  form.destroy();
}

// ── 39. A readonly cell: submitted or not?
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  const rx = form.reactivity;
  form.f.rows.upsert("a", { code: "C" });
  form.setReadonly("rows.a.code", rx.signal(true));
  line("39. readonly cell", `interactivity=${form.getField("rows.a.code")().interactivity()} submit=${JSON.stringify(form.submitValue())}`);
  form.destroy();
}

// ── 40. Destroy while a draft write and a history entry are pending.
{
  const store = new Map();
  const storage = { read: (k) => store.get(k) ?? null, write: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { draft: { key: "d", storage, debounceMs: 50 }, history: { debounceMs: 50 }, devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "C" });
  form.destroy();
  await new Promise((r) => setTimeout(r, 120));
  line("40. after destroy with pending timers", `draftWritten=${store.has("d")} destroyed=${form.destroyed}`);
}
