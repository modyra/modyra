/**
 * A form that refuses to submit must be able to say why.
 *
 * A form-level validator returns errors attributed to field paths. A keyed collection's paths are
 * data, so a rule about rows names one — `rows.a.code` — and the row it named can leave: the rule
 * is computed from a server response, a snapshot, a list of ids. The error still counts towards
 * `valid`, and the path it names no longer has a field to carry it.
 *
 * It surfaces at the form's own bucket instead, the principle the engine already states for server
 * errors, where a path matching no field surfaces at the form rather than being dropped. Both halves
 * are under attack here: an error that stops counting is as much a break as one that becomes
 * unreadable, because each leaves a consumer unable to explain a form that will not submit.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** Every public place an error could be read from. */
function visibleErrors(form, path) {
  return [
    ...form.errorsFor(path)(),
    ...form.errorsFor("")(),
    ...form.buildSubmitEvent().errors,
    ...form.state.lastSubmitErrors(),
  ];
}

battle(
  {
    claims: ["VAL-003", "SUB-001"],
    title: "a verdict that decides validity is readable somewhere",
    environments: ["node"],
  },
  async (ctx) => {
    // A rule about rows, naming the row it is about — and a row that leaves while it says so.
    let failing = true;
    const form = createForm(
      { rows: record(group({ code: field("") })) },
      {
        validators: [() => (failing ? [{ path: "rows.a.code", kind: "range", message: "bad code" }] : [])],
        devWarnings: false,
      },
    );
    ctx.log.note("rule naming a row's cell", { path: "rows.a.code" });

    try {
      form.f.rows.upsert("a", { code: "C" });
      await ctx.scheduler.flush();

      expectClaim(visibleErrors(form, "rows.a.code").length > 0, {
        claimIds: ["VAL-003"],
        what: "while the row exists, the verdict is readable",
        detail: JSON.stringify(visibleErrors(form, "rows.a.code")),
      });

      // The row leaves. The rule has not changed its mind — it still names that path.
      form.f.rows.remove("a");
      await ctx.scheduler.flush();
      ctx.log.note("row removed while the rule still names it", {});

      const stuck = !form.state.valid();
      const readable = visibleErrors(form, "rows.a.code");

      // Both halves, positively. As an implication this passes whenever the form is valid — which is
      // the other way the promise breaks: a rule that still names a path, silently dropped from the
      // verdict as well as from every read. Neither escape is left open.
      expectClaim(stuck, {
        claimIds: ["VAL-003"],
        what: "a rule that still names a departed row's cell still counts towards the verdict",
        detail: `valid=${form.state.valid()} canSubmit=${form.state.canSubmit()}`,
      });

      expectClaim(readable.length > 0, {
        claimIds: ["VAL-003", "SUB-001"],
        what: "a form that will not submit says why through some public read",
        detail: `valid=${form.state.valid()} canSubmit=${form.state.canSubmit()} readable=${JSON.stringify(readable)}`,
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["VAL-003"],
    title: "a verdict naming a path that never existed is readable too",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm(
      { rows: record(group({ code: field("") })), note: field("") },
      {
        validators: [() => [{ path: "rows.ghost.code", kind: "range", message: "never existed" }]],
        devWarnings: false,
      },
    );
    ctx.log.note("rule naming a path with no field", { path: "rows.ghost.code" });

    try {
      form.f.rows.upsert("a", { code: "C" });
      await ctx.scheduler.flush();

      const readable = visibleErrors(form, "rows.ghost.code");

      // Stated positively for the same reason as above: as an implication, a form that quietly went
      // valid would pass while the rule it was given had vanished without trace.
      expectClaim(!form.state.valid(), {
        claimIds: ["VAL-003"],
        what: "a rule naming a path that never existed still counts towards the verdict",
        detail: `valid=${form.state.valid()}`,
      });

      expectClaim(readable.length > 0, {
        claimIds: ["VAL-003"],
        what: "the verdict that made the form invalid can be read",
        detail: `valid=${form.state.valid()} readable=${JSON.stringify(readable)}`,
      });
    } finally {
      form.destroy();
    }
  },
);
