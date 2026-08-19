/**
 * A row whose cells are all disabled, and the list it leaves behind.
 *
 * `submitValue()` documents itself in one line — *"What would be sent right now: every field except
 * the disabled ones"* — and that is a promise about **fields**. A row is not a field: in a positional
 * collection it is a position, and position is identity. Drop one and every row after it is renumbered.
 *
 * Two rows, one cell each, the first row's cell disabled:
 *
 *     getValue      [{code: "X1"}, {code: "X2"}]     both rows, as the form holds them
 *     submitValue   [{code: "X2"}]                   a list of one, and X2 is now index 0
 *
 * A row with a second, enabled cell keeps its place — `[{note: "N1"}, {…}]` — so what decides is
 * whether anything of the row survives, not whether the row is disabled. A renderer expressing "this
 * line is locked" the ordinary way, by disabling its cells, produces a payload where the rows that
 * remain have moved, and nothing says so.
 *
 * The keyed collection loses the row too, and that is the defensible half: a key that is not sent is
 * a key a merge leaves alone. A list has no such reading — index 0 means the first row, and the
 * server is told the first row is one the user can see below it.
 *
 * Green when a positional collection's payload keeps the positions the form holds: the row survives
 * with what it has left, or the contract says a fully disabled row is removed and a consumer reading
 * `submitValue` can tell it happened.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Two rows apiece, in both kinds of collection, so the two answers are read from one form. */
function twoRows(cells) {
  const shape = () => group(Object.fromEntries(cells.map((name, index) => [name, field(`v${index}`)])));
  const row = (suffix) => Object.fromEntries(cells.map((name, index) => [name, `v${index}${suffix}`]));
  return createForm({
    items: array(shape(), { initial: [row("a"), row("b")] }),
    rows: record(shape(), { initial: { a: row("a"), b: row("b") } }),
  }, { devWarnings: false });
}

/** What a renderer does to say a control cannot be used: a binding carrying a signal. */
function disable(form, path) {
  form.setDisabled(path, form.reactivity.signal(true));
}

battle(
  {
    claims: ["VAL-002", "SUB-002", "COL-001"],
    title: "a row whose cells are disabled leaves the rows after it where they were",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a row with something left in it keeps its place, so what the measurement below
    // finds is the empty row rather than disabling in general.
    const partly = twoRows(["code", "note"]);
    disable(partly, "items.0.code");
    const partial = partly.submitValue().items;
    ctx.log.note("one cell of two disabled", { submitted: partial });
    expectEqual(partial, [{ note: "v1a" }, { code: "v0b", note: "v1b" }], {
      claimIds: ["VAL-002"],
      what: "a row with an enabled cell left in it did not keep its place, so this battle cannot say the empty row is what matters",
    });
    partly.destroy();

    const form = twoRows(["code"]);
    disable(form, "items.0.code");
    disable(form, "rows.a.code");
    const submitted = form.submitValue();
    ctx.log.note("the only cell of the first row disabled, in both kinds", {
      held: form.getValue(),
      submitted,
    });

    // The premise: the form still holds both rows, so nothing has been removed — this is about what
    // is sent, not about what the form knows.
    expectEqual(form.getValue().items.length, 2, {
      claimIds: ["COL-001"],
      what: "disabling a cell removed the row from the form itself, which is a plainer defect than the one this battle is about",
    });

    // A list's positions are its identities: whatever happens to the disabled row, the row after it
    // is still the second one.
    expectClaim(submitted.items.length === 2 || submitted.items[submitted.items.length - 1] === undefined, {
      claimIds: ["SUB-002", "VAL-002"],
      what: "a fully disabled row was dropped from a positional payload, so every row after it is sent at a position it does not have",
      detail: JSON.stringify({ held: form.getValue().items, submitted: submitted.items }),
    });

    form.destroy();
  },
);
