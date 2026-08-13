/**
 * Hunt loops 17–20: a form-level verdict aimed at a row that exists, at one that does not, and at a
 * path that is not one — through the documented raw validator, whose errors name their own path.
 */
import { createForm, field, group, record } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

/** The documented shape: a form validator returns errors attributed to field paths. */
const rowRule = (value) => {
  const errors = [];
  for (const [key, row] of Object.entries(value.rows ?? {})) {
    if (row.min && row.max && Number(row.min) > Number(row.max)) {
      errors.push({ path: `rows.${key}.max`, kind: "range", message: "max below min" });
    }
  }
  return errors;
};

// ── 17. A verdict aimed at a row's cell, through the raw validator.
{
  const form = createForm(
    { rows: record(group({ min: field(""), max: field("") })) },
    { validators: [rowRule], devWarnings: false },
  );
  form.f.rows.upsert("a", { min: "10", max: "1" });
  await tick();
  line("17. form valid", String(form.state.valid()));
  line("17. errorsFor(rows.a.max)", JSON.stringify(form.errorsFor("rows.a.max")()));
  line("17. cell errors", JSON.stringify(form.f.rows.cell("a", "max").errors()));
  line("17. validOf(a)", String(form.f.rows.validOf("a")));

  // The row is fixed: the verdict must go.
  form.f.rows.cell("a", "max").set("99");
  await tick();
  line("17. after the row is fixed", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.max")())}`);
  form.destroy();
}

// ── 18. A verdict aimed at a row that has been removed.
{
  const stale = [{ path: "rows.ghost.max", kind: "range", message: "for a row nobody declared" }];
  const form = createForm(
    { rows: record(group({ min: field(""), max: field("") })) },
    { validators: [() => stale], devWarnings: false },
  );
  form.f.rows.upsert("a", { min: "1", max: "2" });
  await tick();
  line("18. verdict for an undeclared row", `valid=${form.state.valid()} fields=${JSON.stringify(form.fieldNames())} errors=${JSON.stringify(form.errorsFor("rows.ghost.max")())}`);
  line("18. value", JSON.stringify(form.getValue()));
  form.destroy();
}

// ── 19. A verdict aimed at a path that is not one.
{
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    {
      validators: [() => [
        { path: "__proto__", kind: "server", message: "polluted" },
        { path: "rows.a.__proto__", kind: "server", message: "polluted deeper" },
      ]],
      devWarnings: false,
    },
  );
  form.f.rows.upsert("a", { code: "C" });
  await tick();
  line("19. hostile verdict paths", `polluted=${{}.polluted} fields=${JSON.stringify(form.fieldNames())} valid=${form.state.valid()}`);
  form.destroy();
}

// ── 20. An async verdict on a cell of a row, and the row is fixed while it runs.
{
  let resolveRun;
  const form = createForm(
    {
      rows: record(group({
        code: field("", [], {
          asyncValidators: [() => new Promise((resolve) => { resolveRun = resolve; })],
        }),
      })),
    },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "C" });
  await tick();
  form.f.rows.rename("a", "b");
  await tick();
  resolveRun?.(["a verdict for the key that was renamed away"]);
  await tick();
  line("20. after rename mid-run", `keys=${JSON.stringify(form.f.rows.keys())} errorsOnB=${JSON.stringify(form.errorsFor("rows.b.code")())} valid=${form.state.valid()} pending=${form.state.pending()}`);
  form.destroy();
}
