/**
 * Loops 64–68: the React adapter's store over a keyed collection, and what the reactivity contract
 * does when a subscriber outlives the thing it subscribed to.
 */
import { createForm, field, group, record, vanillaReactivity } from "@modyra/core";
import { createFieldStore, createStore, reactReactivity } from "@modyra/react";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 64. A field store over a cell that does not exist yet.
{
  const rx = reactReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: rx, devWarnings: false });
  const cell = form.f.rows.cell("a", "code");
  const store = createFieldStore(cell);

  const seen = [];
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));

  line("64. snapshot before the row exists", JSON.stringify(store.getSnapshot()));
  form.f.rows.upsert("a", { code: "A" });
  await tick();
  line("64. snapshot after the row arrives", JSON.stringify(store.getSnapshot()));
  line("64. notifications", String(seen.length));

  form.f.rows.remove("a");
  await tick();
  line("64. after the row leaves", JSON.stringify(store.getSnapshot()));

  unsubscribe();
  form.f.rows.upsert("a", { code: "B" });
  await tick();
  line("64. after unsubscribing", `notifications=${seen.length} snapshot=${JSON.stringify(store.getSnapshot())}`);
  form.destroy();
}

// ── 65. A store whose form is destroyed while it is still subscribed.
{
  const rx = reactReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: rx, devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });
  const store = createFieldStore(form.f.rows.cell("a", "code"));
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });

  form.destroy();
  await tick();

  let read = null;
  try { read = JSON.stringify(store.getSnapshot()); } catch (error) { read = `THREW ${error.message}`; }
  line("65. store read after destroy", read);
  line("65. notifications after destroy", String(notifications));
  let threw = null;
  try { unsubscribe(); } catch (error) { threw = error.message; }
  line("65. unsubscribe after destroy", threw ? `THREW ${threw}` : "clean");
}

// ── 66. A form-level store: does a structural change notify?
{
  const rx = reactReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: rx, devWarnings: false });
  // The store observes signals, and is given the runtime that owns them.
  const store = createStore([form.value, form.state.valid, form.fieldNames], rx);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });

  form.f.rows.upsert("a", { code: "A" });
  await tick();
  const afterDeclare = notifications;
  form.f.rows.cell("a", "code").set("A2");
  await tick();
  const afterEdit = notifications;
  form.f.rows.remove("a");
  await tick();
  line("66. notifications", `declare=${afterDeclare} edit=${afterEdit - afterDeclare} remove=${notifications - afterEdit}`);
  line("66. final version", String(store.getSnapshot()));
  unsubscribe();
  form.destroy();
}

// ── 67. Two runtimes over one form: which one sees the change?
{
  const owner = vanillaReactivity();
  const form = createForm({ rows: record(group({ code: field("") })) }, { reactivity: owner, devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });

  const foreign = reactReactivity();
  let foreignReads = 0;
  const computed = foreign.computed(() => {
    foreignReads += 1;
    return form.f.rows.cell("a", "code").value();
  });
  line("67. foreign computed first read", `${computed()} reads=${foreignReads}`);
  form.f.rows.cell("a", "code").set("A2");
  line("67. after the owner's write", `${computed()} reads=${foreignReads}`);
  form.destroy();
}

// ── 68. The engine's own value signal under a foreign runtime.
{
  const owner = vanillaReactivity();
  const form = createForm({ name: field("x") }, { reactivity: owner, devWarnings: false });
  const foreign = reactReactivity();
  const mirror = foreign.computed(() => form.value());
  line("68. mirror before", JSON.stringify(mirror()));
  form.f.name.set("y");
  line("68. mirror after", JSON.stringify(mirror()));
  form.destroy();
}
