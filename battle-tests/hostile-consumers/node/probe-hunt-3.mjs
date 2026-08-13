/**
 * Hunt loops 13–16: where a cross-field verdict lands when it names a row's cell, and what a server
 * verdict does with the same path.
 */
import { createForm, crossField, field, group, record, serverValidator } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

const rowRule = crossField(["rows"], (value) => {
  const errors = [];
  for (const [key, row] of Object.entries(value.rows ?? {})) {
    if (row.min && row.max && Number(row.min) > Number(row.max)) {
      errors.push({ path: `rows.${key}.max`, kind: "range", message: "max below min" });
    }
  }
  return errors;
});

// ── 13. A cross-field error naming a row's cell: is it readable where it was aimed?
{
  const form = createForm(
    { rows: record(group({ min: field(""), max: field("") })), note: field("") },
    { validators: [rowRule], devWarnings: false },
  );
  form.f.rows.upsert("a", { min: "10", max: "1" });
  await tick();

  line("13. form valid", String(form.state.valid()));
  line("13. errorsFor(rows.a.max)", JSON.stringify(form.errorsFor("rows.a.max")()));
  line("13. getField(rows.a.max).errors", JSON.stringify(form.getField("rows.a.max")?.().errors() ?? null));
  line("13. cell handle errors", JSON.stringify(form.f.rows.cell("a", "max").errors()));
  line("13. rows.validOf(a)", String(form.f.rows.validOf("a")));
  line("13. collection errors", JSON.stringify(form.f.rows.errors()));
  form.destroy();
}

// ── 14. The same rule against a plain nested group, for comparison.
{
  const rule = crossField(["range"], (value) => (
    Number(value.range?.min) > Number(value.range?.max)
      ? [{ path: "range.max", kind: "range", message: "max below min" }]
      : []
  ));
  const form = createForm(
    { range: group({ min: field(""), max: field("") }) },
    { validators: [rule], devWarnings: false },
  );
  form.f.range.min.set("10");
  form.f.range.max.set("1");
  await tick();
  line("14. group — errorsFor(range.max)", JSON.stringify(form.errorsFor("range.max")()));
  line("14. group — field errors", JSON.stringify(form.getField("range.max")().errors()));
  line("14. group — valid", String(form.state.valid()));
  form.destroy();
}

// ── 15. A server verdict naming a row's cell, and one naming a row that is gone.
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  form.f.rows.upsert("a", { code: "C" });
  await tick();

  const validator = serverValidator({ debounceMs: 0 });
  line("15. serverValidator shape", typeof validator);

  form.setServerErrors?.([
    { path: "rows.a.code", kind: "server", message: "taken" },
    { path: "rows.ghost.code", kind: "server", message: "for a row that is not there" },
    { path: "__proto__", kind: "server", message: "polluted" },
  ]);
  await tick();
  line("15. after server errors", `valid=${form.state.valid()} onCell=${JSON.stringify(form.errorsFor("rows.a.code")())} polluted=${{}.polluted}`);
  form.destroy();
}

// ── 16. My own new rule, attacked: does a binding retained across a removal ever go stale?
{
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false });
  const rx = form.reactivity;
  const bound = rx.signal(true);

  form.claimField("rows.a.code");
  form.setDisabled("rows.a.code", bound);
  form.f.rows.upsert("a", { code: "C" });
  line("16. bound before declaration", String(form.getField("rows.a.code")().disabled()));

  // The control goes away, then the row does, then both come back — with nobody re-binding.
  form.removeField("rows.a.code");
  form.f.rows.remove("a");
  form.f.rows.upsert("a", { code: "C2" });
  line("16. control released, row returned", `disabled=${form.getField("rows.a.code")().disabled()} submit=${JSON.stringify(form.submitValue())}`);

  // And a fresh control on the same path must not inherit a binding nobody made.
  form.claimField("rows.a.code");
  line("16. a new control on the same path", String(form.getField("rows.a.code")().disabled()));
  form.destroy();
}
