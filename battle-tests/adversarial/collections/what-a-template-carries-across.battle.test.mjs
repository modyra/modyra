/**
 * What a row's template carries across instantiation, and the one thing it does not.
 *
 * A row is declared once and built many times, so every option written on a cell has to survive
 * being instantiated under a key nobody knew at declaration time. Three separate mechanisms have
 * already failed at exactly that boundary — `sensitive` was not honoured one row down, the
 * sanitizer ran twice through a collection write, and `asyncDependsOn` still resolves against the
 * form's root.
 *
 * Three failures at one boundary is a reason to walk the rest of the list rather than wait for the
 * fourth. Walked, the boundary turns out to be narrower and more specific than "a template loses its
 * declarations":
 *
 *   asyncDebounceMs   carried — a long debounce delays the run in a row as it does at the root
 *   asyncTimeoutMs    carried — an unsettling validator times out with `async-timeout` either way
 *   asyncWhen         carried — a false precondition skips the call either way
 *   when              carried — a cell reads its enclosing row, which is what a row's rule needs
 *   asyncDependsOn    NOT carried, and it is the only one of the five that names a path
 *
 * So the rule is not that a template loses things. It is that **a declaration containing a path is
 * not rewritten relative to the row it lands in** — which says where to look next, and says it about
 * every other slot that carries a path rather than a value.
 *
 * This battle is green, and holds the four that work. It is worth holding precisely because the
 * boundary has been shown to be fragile: a regression in `when` one row down would put a field back
 * in play that a row's own rule had taken out, and the collection is where that is least likely to
 * be noticed.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Builds the same one-cell arrangement at the root and inside a row, and drives both the same way. */
async function bothPlaces(cell, drive) {
  const answers = {};
  for (const where of ["root", "row"]) {
    const form =
      where === "root"
        ? createForm({ gate: field("shut"), x: cell() }, { devWarnings: false })
        : createForm({ rows: record(group({ gate: field("shut"), x: cell() })) }, { devWarnings: false });
    try {
      if (where === "row") {
        form.f.rows.upsert("a", { gate: "shut", x: "" });
        await wait(300);
      }
      answers[where] = await drive({
        form,
        cell: () => (where === "root" ? form.f.x : form.f.rows.row("a").x),
        sibling: () => (where === "root" ? form.f.gate : form.f.rows.row("a").gate),
        path: where === "root" ? "x" : "rows.a.x",
      });
    } finally {
      form.destroy();
    }
  }
  return answers;
}

battle(
  {
    claims: ["COL-001", "VAL-002"],
    title: "a cell of a row behaves as the same cell at the root",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = {};

    // The counter lives out here, so what is measured is how many times the validator actually ran
    // rather than a list the drive function just created.
    const debounceRuns = { calls: 0 };
    observed.asyncDebounceMs = await bothPlaces(
      () =>
        field("", [], {
          asyncValidators: [
            async () => {
              debounceRuns.calls += 1;
              return [];
            },
          ],
          asyncDebounceMs: 300,
        }),
      async ({ cell }) => {
        debounceRuns.calls = 0;
        cell().set("v");
        await wait(80);
        const duringTheWindow = debounceRuns.calls;
        await wait(500);
        return { ranDuringTheWindow: duringTheWindow > 0, ranAfterIt: debounceRuns.calls > 0 };
      },
    );

    observed.asyncTimeoutMs = await bothPlaces(
      () =>
        field("", [], {
          asyncValidators: [() => new Promise(() => undefined)],
          asyncDebounceMs: 0,
          asyncTimeoutMs: 150,
        }),
      async ({ form, cell, path }) => {
        cell().set("v");
        await wait(80);
        const pendingDuring = form.state.pending();
        await wait(320);
        return {
          pendingDuring,
          settled: !form.state.pending(),
          kinds: form.errorsFor(path)().map((each) => each.kind),
        };
      },
    );

    observed.asyncWhen = await bothPlaces(
      () => {
        const seen = { calls: 0 };
        const cell = field("", [], {
          asyncValidators: [
            async () => {
              seen.calls += 1;
              return [];
            },
          ],
          asyncDebounceMs: 0,
          asyncWhen: (value) => String(value).length > 3,
        });
        cell.seen = seen;
        return cell;
      },
      async ({ form, cell }) => {
        cell().set("ab");
        await wait(120);
        const skippedShort = !form.state.pending();
        cell().set("abcdef");
        await wait(120);
        return { skippedShort, settled: !form.state.pending() };
      },
    );

    observed.when = await bothPlaces(
      () => field("", [], { when: (_value, enclosing) => enclosing.gate === "open" }),
      async ({ cell, sibling }) => {
        const whileShut = cell().disabled();
        sibling().set("open");
        await wait(80);
        return { outWhileShut: whileShut, outWhileOpen: cell().disabled() };
      },
    );

    ctx.log.note("each option, at the root and one row down", observed);

    // The instrument: the root arrangement has to actually exercise each option, or "the row agrees"
    // would be two nothings agreeing.
    expectClaim(
      observed.asyncDebounceMs.root.ranDuringTheWindow === false &&
        observed.asyncDebounceMs.root.ranAfterIt === true &&
        observed.asyncTimeoutMs.root.pendingDuring === true &&
        observed.asyncTimeoutMs.root.kinds.includes("async-timeout") &&
        observed.when.root.outWhileShut === true &&
        observed.when.root.outWhileOpen === false &&
        observed.asyncWhen.root.skippedShort === true,
      {
        claimIds: ["VAL-002"],
        what: "an option does nothing even at the root, so agreement one row down would be two nothings agreeing",
        detail: JSON.stringify(observed),
      },
    );

    for (const [option, answers] of Object.entries(observed)) {
      expectEqual(answers.row, answers.root, {
        claimIds: ["COL-001", "VAL-002"],
        what: `\`${option}\` declared in a row's template behaves differently from the same declaration at the root`,
      });
    }
  },
);
