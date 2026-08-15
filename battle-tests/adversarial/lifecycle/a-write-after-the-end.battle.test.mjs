/**
 * A write that arrives after the form was destroyed, and the two answers it produces.
 *
 * That a destroyed form still answers is deliberate: a renderer torn down in the other order keeps
 * reading for a beat, and a form that started throwing would turn an ordinary unmount race into a
 * crash. `getValue()` and the value signal both answer with what the form held at the end.
 *
 * A write is the case underneath that. The same race that produces a late read produces a late write —
 * a control's change handler firing as its host is disposed — and the form has two surfaces a
 * renderer reads from. `getValue()` keeps the value from the end. The field handle's `value()` takes
 * the write and reports it, its validators run against it, and its `valid()` answers about it, while
 * `state.valid()` and `canSubmit()` stay as they were.
 *
 * So a control still on screen shows what the user typed and an error explaining why it is wrong,
 * about a form that holds neither and will never submit either. Whichever way the contract is meant to
 * read — the write is refused, or the write lands — the two surfaces have to give the same answer, and
 * that is what is asserted here rather than which of the two wins.
 *
 * What does not happen is asserted alongside, because it bounds the finding: no async validator runs
 * after destroy. The work that reaches outside the process stays stopped.
 */

import { createForm, field, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["LIF-001", "REA-002"],
    title: "a write after destroy leaves the two read surfaces saying different things",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ name: field("start", [required()]) }, { devWarnings: false });
    form.f.name.set("typed");

    // The control: alive, the two surfaces agree, which is what makes the comparison below about
    // destruction rather than about them never having agreed.
    expectEqual([form.f.name.value(), form.getValue().name], ["typed", "typed"], {
      claimIds: ["REA-002"],
      what: "the handle and the form disagree about a value while the form is alive",
    });

    form.destroy();

    // Answering after the end is the documented behaviour, and both surfaces still agree here.
    expectEqual([form.f.name.value(), form.getValue().name], ["typed", "typed"], {
      claimIds: ["LIF-001"],
      what: "a destroyed form stopped answering, or its two surfaces already disagree before any write",
    });

    // The late write: one operation, the one an unmounting control produces.
    form.f.name.set("");
    ctx.log.note("a write that arrived after the end", {
      handle: form.f.name.value(),
      getValue: form.getValue().name,
      handleErrors: form.f.name.errors().map((each) => each.message),
      handleValid: form.f.name.valid?.(),
      formValid: form.state.valid(),
    });

    expectEqual(form.f.name.value(), form.getValue().name, {
      claimIds: ["REA-002", "LIF-001"],
      what: "after a write to a destroyed form the handle and the form report different values, and a control renders the handle",
      detail: JSON.stringify({ handle: form.f.name.value(), getValue: form.getValue().name }),
    });

    // The same disagreement in the verdict a control paints beside the value.
    expectEqual(form.f.name.valid?.() ?? form.state.valid(), form.state.valid(), {
      claimIds: ["REA-002", "LIF-001"],
      what: "the field says it is invalid and the form it belongs to says everything is valid",
      detail: JSON.stringify({ field: form.f.name.valid?.(), form: form.state.valid() }),
    });

    expectEqual(form.f.name.errors().map((each) => each.message), [], {
      claimIds: ["LIF-001"],
      what: "a validator ran on a destroyed form and produced a message no submission will ever carry",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "VAL-001"],
    title: "no async validator runs after the form was destroyed",
    environments: ["node"],
  },
  async (ctx) => {
    let calls = 0;
    const check = async (value) => {
      calls += 1;
      await settled(10);
      return value === "bad" ? [{ message: "taken" }] : [];
    };

    const form = createForm(
      { name: field("start", [required()], { asyncValidators: [check], asyncDebounceMs: 0 }) },
      { devWarnings: false },
    );

    form.f.name.set("first");
    await settled(80);
    const before = calls;

    // The control: the validator is reachable at all. A count that never moved would make the
    // assertion below true for the wrong reason.
    expectClaim(before > 0, {
      claimIds: ["VAL-001"],
      what: "the async validator never ran while the form was alive, so its silence after destroy means nothing",
    });

    form.destroy();
    form.f.name.set("bad");
    await settled(120);
    ctx.log.note("what a write after the end started", { before, after: calls });

    expectEqual(calls, before, {
      claimIds: ["LIF-001", "VAL-001"],
      what: "a write to a destroyed form started an async validator, which is work reaching outside the process",
    });

    expectEqual(form.state.pending(), false, {
      claimIds: ["LIF-001"],
      what: "a destroyed form reports itself as waiting for something",
    });
  },
);
