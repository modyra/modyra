/**
 * Hunt loops 7–12: conditions against mounting, a schema's word against a binding's, cross-field
 * verdicts over a collection, server error paths, and what a draft is allowed to carry.
 */
import { createForm, crossField, field, group, record, required, serverValidator } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 7. A section closes while the only mounted control is inside it.
{
  const form = createForm(
    {
      kind: field("company"),
      company: group({ vat: field("", [required()]) }, { when: (_v, all) => all.kind === "company" }),
    },
    { devWarnings: false },
  );
  form.claimField("company.vat");
  line("7. open, empty required", `valid=${form.state.valid()} submit=${JSON.stringify(form.submitValue())}`);
  form.f.kind.set("person");
  await tick();
  line("7. section closed, control still mounted", `valid=${form.state.valid()} submit=${JSON.stringify(form.submitValue())} value=${JSON.stringify(form.getValue())}`);
  form.removeField("company.vat");
  line("7. control unmounted too", `valid=${form.state.valid()} fields=${JSON.stringify(form.fieldNames())}`);
  form.destroy();
}

// ── 8. A schema condition and a control's binding, both speaking about one field.
{
  const form = createForm(
    {
      kind: field("company"),
      company: group({ vat: field("") }, { when: (_v, all) => all.kind === "company" }),
    },
    { devWarnings: false },
  );
  const rx = form.reactivity;
  const bound = rx.signal(true);
  form.claimField("company.vat");
  form.setDisabled("company.vat", bound);
  line("8. bound disabled while in play", `disabled=${form.getField("company.vat")().disabled()} submit=${JSON.stringify(form.submitValue())}`);
  form.f.kind.set("person");
  await tick();
  line("8. out of play", `interactivity=${form.getField("company.vat")?.().interactivity()} submit=${JSON.stringify(form.submitValue())}`);
  form.f.kind.set("company");
  await tick();
  bound.set(false);
  line("8. back in play, binding released", `disabled=${form.getField("company.vat")().disabled()} submit=${JSON.stringify(form.submitValue())}`);
  form.destroy();
}

// ── 9. A cross-field verdict attached to a row that then leaves.
{
  const form = createForm(
    { rows: record(group({ min: field(""), max: field("") })) },
    {
      validators: [
        crossField(["rows"], (value) => {
          const errors = [];
          for (const [key, row] of Object.entries(value.rows ?? {})) {
            if (row.min && row.max && Number(row.min) > Number(row.max)) {
              errors.push({ path: `rows.${key}.max`, kind: "range", message: "max below min" });
            }
          }
          return errors;
        }),
      ],
      devWarnings: false,
    },
  );
  form.f.rows.upsert("a", { min: "10", max: "1" });
  await tick();
  line("9. cross-field verdict on a row", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.max")())}`);
  form.f.rows.remove("a");
  await tick();
  line("9. after the row leaves", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.max")())} value=${JSON.stringify(form.getValue())}`);
  form.f.rows.upsert("a", { min: "1", max: "10" });
  await tick();
  line("9. after the key returns clean", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.max")())}`);
  form.destroy();
}

// ── 10. A server naming a path that is not one.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  form.f.rows.upsert("a", { code: "C" });
  const validate = serverValidator(form, { debounceMs: 0 });
  try {
    validate({
      errors: [
        { path: "__proto__", kind: "server", message: "polluted" },
        { path: "rows.a.code", kind: "server", message: "taken" },
        { path: "rows.ghost.code", kind: "server", message: "for a row that does not exist" },
      ],
    });
  } catch (error) {
    line("10. serverValidator threw", error.message);
  }
  await tick();
  line("10. after server errors", `polluted=${{}.polluted} fields=${JSON.stringify(form.fieldNames())} errors=${JSON.stringify(form.errorsFor("rows.a.code")())}`);
  form.destroy();
}

// ── 11. A draft told to exclude a path inside a collection.
{
  const store = new Map();
  const storage = { read: (k) => store.get(k) ?? null, write: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
  const schema = () => ({ rows: record(group({ code: field(""), secret: field("") })) });
  const first = createForm(schema(), {
    draft: { key: "d", storage, debounceMs: 0, exclude: ["rows.a.secret"] },
    devWarnings: false,
  });
  first.f.rows.upsert("a", { code: "C", secret: "s3cret" });
  await new Promise((r) => setTimeout(r, 30));
  line("11. stored draft", store.get("d") ?? "nothing written");
  first.destroy();
}

// ── 12. A draft whose envelope version does not match, and one past its expiry.
{
  const mk = (text, options) => {
    const store = new Map([["d", text]]);
    const storage = { read: (k) => store.get(k) ?? null, write: (k, v) => store.set(k, v), remove: (k) => store.delete(k) };
    return createForm({ name: field("") }, { draft: { key: "d", storage, ...options }, devWarnings: false });
  };
  const wrongVersion = mk(JSON.stringify({ __mdyDraft: 9, savedAt: Date.now(), value: { name: "old" } }), { version: 1 });
  line("12. version mismatch", JSON.stringify(wrongVersion.getValue()));
  const expired = mk(JSON.stringify({ __mdyDraft: 1, savedAt: Date.now() - 10_000, value: { name: "stale" } }), { ttlMs: 1000 });
  line("12. expired", JSON.stringify(expired.getValue()));
  const legacy = mk(JSON.stringify({ name: "legacy" }), {});
  line("12. envelope-less legacy", JSON.stringify(legacy.getValue()));
  wrongVersion.destroy();
  expired.destroy();
  legacy.destroy();
}
