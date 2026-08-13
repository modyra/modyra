/**
 * Hunt loops 21–24: a verdict nobody can read, and a stale run resolved by identity rather than by
 * whichever resolver happened to be captured last.
 */
import { createForm, field, group, record } from "@modyra/core";

const line = (label, value) => console.log(`${label}: ${value}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 21. A form validator naming a path that does not exist: where does the error go?
{
  const form = createForm(
    { rows: record(group({ code: field("") })), note: field("") },
    {
      validators: [() => [{ path: "rows.ghost.code", kind: "range", message: "invisible" }]],
      devWarnings: false,
    },
  );
  form.f.rows.upsert("a", { code: "C" });
  await tick();

  line("21. valid", String(form.state.valid()));
  line("21. canSubmit", String(form.state.canSubmit()));
  line("21. errorsFor(rows.ghost.code)", JSON.stringify(form.errorsFor("rows.ghost.code")()));
  line("21. errorsFor(rows)", JSON.stringify(form.errorsFor("rows")()));
  line("21. errorsFor(note)", JSON.stringify(form.errorsFor("note")()));
  line("21. collection errors", JSON.stringify(form.f.rows.errors()));
  const event = form.buildSubmitEvent?.();
  line("21. submit event errors", JSON.stringify(event?.errors ?? null));
  line("21. lastSubmitErrors", JSON.stringify(form.state.lastSubmitErrors()));
  form.destroy();
}

// ── 22. The same, but the path is a *declared* row's cell that later leaves.
{
  let failing = true;
  const form = createForm(
    { rows: record(group({ code: field("") })) },
    {
      validators: [() => (failing ? [{ path: "rows.a.code", kind: "range", message: "bad" }] : [])],
      devWarnings: false,
    },
  );
  form.f.rows.upsert("a", { code: "C" });
  await tick();
  line("22. while the row exists", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.code")())}`);
  form.f.rows.remove("a");
  await tick();
  line("22. after the row leaves", `valid=${form.state.valid()} errors=${JSON.stringify(form.errorsFor("rows.a.code")())} value=${JSON.stringify(form.getValue())}`);
  failing = false;
  form.f.rows.upsert("b", { code: "D" });
  await tick();
  line("22. rule satisfied again", `valid=${form.state.valid()}`);
  form.destroy();
}

// ── 23. A stale async run resolved by identity: the run started before a rename.
{
  const runs = [];
  const validator = (value, ctx) => new Promise((resolve) => {
    const run = { path: ctx.path, value, resolve, aborted: false };
    ctx.signal.addEventListener("abort", () => { run.aborted = true; });
    runs.push(run);
  });

  const form = createForm(
    { rows: record(group({ code: field("", [], { asyncValidators: [validator] }) })) },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "C" });
  await tick();
  line("23. runs after declaration", JSON.stringify(runs.map((r) => ({ p: r.path, a: r.aborted }))));

  form.f.rows.rename("a", "b");
  await tick();
  line("23. runs after rename", JSON.stringify(runs.map((r) => ({ p: r.path, a: r.aborted }))));

  // Only the pre-rename run answers, and it answers with an error.
  runs[0].resolve(["verdict computed for the key that was renamed away"]);
  await tick();
  line("23. after the stale answer", `errorsOnB=${JSON.stringify(form.errorsFor("rows.b.code")())} valid=${form.state.valid()} pending=${form.state.pending()}`);

  // Then the live one answers cleanly.
  const live = runs.filter((r) => !r.aborted);
  live[live.length - 1].resolve([]);
  await tick();
  line("23. after the live answer", `errorsOnB=${JSON.stringify(form.errorsFor("rows.b.code")())} valid=${form.state.valid()} pending=${form.state.pending()}`);
  form.destroy();
}

// ── 24. Two rows, one validator, answers crossed: does row b's answer reach row a?
{
  const runs = [];
  const validator = (value, ctx) => new Promise((resolve) => {
    runs.push({ path: ctx.path, value, resolve });
  });
  const form = createForm(
    { rows: record(group({ code: field("", [], { asyncValidators: [validator] }) })) },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "A" });
  form.f.rows.upsert("b", { code: "B" });
  await tick();
  line("24. runs", JSON.stringify(runs.map((r) => r.path)));

  // Answer b first with an error, then a cleanly.
  runs.find((r) => r.path === "rows.b.code")?.resolve(["b is wrong"]);
  runs.find((r) => r.path === "rows.a.code")?.resolve([]);
  await tick();
  line("24. verdicts", `a=${JSON.stringify(form.errorsFor("rows.a.code")())} b=${JSON.stringify(form.errorsFor("rows.b.code")())}`);
  line("24. validOf", `a=${form.f.rows.validOf("a")} b=${form.f.rows.validOf("b")}`);
  form.destroy();
}
