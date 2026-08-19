/**
 * A server check that never asks again, because the dependency it declared does not exist.
 *
 * `asyncDependsOn` is the list of paths whose changes re-run a field's async validators. It exists
 * for exactly one failure: a verdict obtained from a server about one value, still standing after
 * the value it was about has changed. `MdyFieldOptions` says so — *"dotted paths whose changes
 * re-run the async validators (cross-field server checks)"*.
 *
 * A row of a collection is a **template**: declared once, instantiated per key. A cell in it names
 * its sibling the only way it can, by the name that sibling has inside the row. That name is
 * resolved against the form's root, where it is not:
 *
 *   at the root, dependsOn ["code"]        re-runs        ← the control
 *   in a row,    dependsOn ["code"]        never re-runs
 *   in a row,    dependsOn ["rows.a.code"] re-runs        ← and is unwritable in a template
 *   in a row,    dependsOn ["rows.*.code"] never re-runs
 *   in a row,    dependsOn ["./code"]      never re-runs
 *
 * The third line is the important one. It is the only spelling that works, and a template cannot
 * write it: the template is declared before any row exists and is shared by all of them, so it does
 * not know — and must not know — the key. **There is no correct way to write this in a row.**
 *
 * What it costs, measured:
 *
 *   the server approves the row                       form valid
 *   the user replaces the code with something else    form still valid, no errors
 *
 * The approval stands for an input that is gone. And the direction is the one that opens: had the
 * old verdict been a refusal, the stale answer would have blocked a submit that should pass —
 * annoying. It was an approval, so the form submits a value nothing ever checked.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settle = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs one arrangement and reports which paths the async validator was asked about. */
async function reRunsFor(build, drive) {
  const asked = [];
  const check = async (value, ctx) => {
    asked.push(ctx.path);
    return [];
  };
  const form = createForm(build(check), { devWarnings: false });
  try {
    await drive.setUp?.(form);
    await settle();
    asked.length = 0;
    await drive.change(form);
    await settle();
    return [...asked];
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["COL-001", "VAL-002"],
    title: "a dependency declared in a row's template re-runs when that row's cell changes",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the same declaration, at the root, where the name resolves.
    const atRoot = await reRunsFor(
      (check) => ({
        code: field(""),
        verified: field("", [], { asyncValidators: [check], asyncDependsOn: ["code"], asyncDebounceMs: 0 }),
      }),
      { change: (form) => form.f.code.set("A2") },
    );

    expectClaim(atRoot.length > 0, {
      claimIds: ["VAL-002"],
      what: "asyncDependsOn does not re-run even at the root, so the probe is wrong before the contract is",
      detail: JSON.stringify(atRoot),
    });

    const rowSchema = (dependsOn) => (check) => ({
      rows: record(
        group({
          code: field(""),
          verified: field("", [], {
            asyncValidators: [check],
            asyncDependsOn: dependsOn,
            asyncDebounceMs: 0,
          }),
        }),
      ),
    });
    const drive = {
      setUp: (form) => form.f.rows.upsert("a", { code: "A1", verified: "v" }),
      change: (form) => form.f.rows.row("a").code.set("A2"),
    };

    // Every spelling a template could use for its own sibling. The absolute one is included to show
    // the mechanism works and only the addressing fails — it is not a spelling a template can write,
    // because a template is shared by every row and predates all of them.
    const spellings = [
      { spelling: 'the sibling\'s own name, ["code"]', writableInATemplate: true, asked: await reRunsFor(rowSchema(["code"]), drive) },
      { spelling: 'a relative path, ["./code"]', writableInATemplate: true, asked: await reRunsFor(rowSchema(["./code"]), drive) },
      { spelling: 'a wildcard, ["rows.*.code"]', writableInATemplate: true, asked: await reRunsFor(rowSchema(["rows.*.code"]), drive) },
      { spelling: 'the row\'s full path, ["rows.a.code"]', writableInATemplate: false, asked: await reRunsFor(rowSchema(["rows.a.code"]), drive) },
    ];
    ctx.log.note("how a row's cell can name its sibling, and whether the check re-runs", { atRoot, spellings });

    // At least one spelling a template can actually write must re-run the check.
    expectClaim(
      spellings.some((entry) => entry.writableInATemplate && entry.asked.length > 0),
      {
        claimIds: ["COL-001", "VAL-002"],
        what: "no way of naming a sibling that a row's template can write re-runs the check, so a cross-field server check inside a collection cannot be declared at all",
        detail: JSON.stringify(spellings),
      },
    );

    // And the consequence, on the arrangement an author would actually write: a verdict about a
    // value that has since changed must not still stand.
    const stale = await (async () => {
      const form = createForm(
        {
          rows: record(
            group({
              code: field(""),
              verified: field("", [], {
                asyncValidators: [async (value) => (value === "ok" ? [] : ["the server refused this"])],
                asyncDependsOn: ["code"],
                asyncDebounceMs: 0,
              }),
            }),
          ),
        },
        { devWarnings: false },
      );
      try {
        form.f.rows.upsert("a", { code: "A1", verified: "ok" });
        await settle();
        const approved = form.state.valid();
        form.f.rows.row("a").code.set("SOMETHING ELSE ENTIRELY");
        await settle();
        return { approved, stillValid: form.state.valid(), pending: form.state.pending() };
      } finally {
        form.destroy();
      }
    })();
    ctx.log.note("what happens to an approval once the value it was about changes", stale);

    expectClaim(stale.approved === true, {
      claimIds: ["VAL-002"],
      what: "the server check never approved the row, so there is no approval for a change to invalidate",
      detail: JSON.stringify(stale),
    });

    expectEqual({ approvalSurvivedTheChange: stale.stillValid && !stale.pending }, { approvalSurvivedTheChange: false }, {
      claimIds: ["VAL-002", "COL-001"],
      what: "a server's approval of a row still stands after the value it was about was replaced, so the form submits something nothing ever checked",
    });
  },
);
