/**
 * Loops 45–50: a zod-built form under the same structural pressure, submit modes, change tracking,
 * touched propagation and deactivation.
 */
import { createForm, field, group, record } from "@modyra/core";
import { createZodForm, buildZodTree } from "@modyra/zod";
import { z } from "zod";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 45. A record built from a zod schema: does it stay keyed?
{
  const schema = z.object({
    rows: z.record(z.string(), z.object({ code: z.string().min(1) })),
  });
  let form = null;
  try {
    form = createZodForm(schema);
    line("45. zod record — tree keys", JSON.stringify(Object.keys(buildZodTree(schema))));
    line("45. zod record — value", JSON.stringify(form.getValue()));
    if (form.f.rows?.upsert) {
      form.f.rows.upsert("0", { code: "A" });
      form.f.rows.upsert("01", { code: "B" });
      line("45. after numeric keys", `${JSON.stringify(form.getValue())} isArray=${Array.isArray(form.getValue().rows)}`);
    } else {
      line("45. zod record — handle kind", Object.keys(form.f.rows ?? {}).join(","));
    }
  } catch (error) {
    line("45. zod record THREW", error.message);
  } finally {
    form?.destroy();
  }
}

// ── 46. submitMode "always" and "manual" with an invalid row.
{
  for (const submitMode of ["valid-only", "always", "manual"]) {
    const form = createForm(
      { rows: record(group({ code: field("", [(v) => (v ? [] : ["required"])]) })) },
      { submitMode, devWarnings: false },
    );
    form.f.rows.upsert("a", { code: "" });
    await tick();
    const event = form.buildSubmitEvent();
    line(`46. ${submitMode}`, `canSubmit=${form.state.canSubmit()} eventValid=${event.valid} value=${JSON.stringify(event.value)}`);
    form.destroy();
  }
}

// ── 47. getChanges() across structural changes.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });
  await tick();
  line("47. after declaring a row", JSON.stringify(form.getChanges()));
  form.f.rows.cell("a", "code").set("A2");
  line("47. after editing it", JSON.stringify(form.getChanges()));
  form.f.rows.remove("a");
  line("47. after removing it", JSON.stringify(form.getChanges()));
  form.destroy();
}

// ── 48. markAllTouched over rows that arrive later.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });
  form.markAllTouched();
  form.f.rows.upsert("b", { code: "B" });
  line("48. touched", `a=${form.f.rows.cell("a", "code").touched()} b=${form.f.rows.cell("b", "code").touched()}`);
  form.destroy();
}

// ── 49. Deactivated form: structural changes while effects are paused.
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    { autoActivate: false, history: true, devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "A" });
  line("49. while deactivated", `keys=${JSON.stringify(form.f.rows.keys())} value=${JSON.stringify(form.getValue())} canUndo=${form.canUndo()}`);
  form.activate();
  await tick();
  form.f.rows.upsert("b", { code: "B" });
  await tick();
  line("49. after activate", `keys=${JSON.stringify(form.f.rows.keys())} canUndo=${form.canUndo()}`);
  form.undo();
  await tick();
  line("49. after undo", JSON.stringify(form.f.rows.keys()));
  form.destroy();
}

// ── 50. A draft carrying a value the writer could not serialise.
{
  const store = new Map();
  const storage = { read: (k) => store.get(k) ?? null, write: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  const form = createForm(
    { rows: record(group({ code: field("") })), big: field(0) },
    { draft: { key: "d", storage, debounceMs: 0 }, devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "A" });
  form.f.big.set(10n);
  await new Promise((r) => setTimeout(r, 30));
  line("50. draft after a BigInt write", store.get("d") ?? "nothing written");
  form.f.big.set(11);
  await new Promise((r) => setTimeout(r, 30));
  line("50. draft after a serialisable write", store.get("d") ?? "nothing written");
  form.destroy();
}
