/**
 * A field can be refused by more than one thing, and it has one answer.
 *
 * The conditions subsystem states its rule in a sentence: *the signal a field's interactivity reads
 * is true while **any** condition refuses it — one signal per field however many conditions there
 * are, so a field's activity is one question with one answer, not a stack of overrides where the last
 * writer wins.*
 *
 * That is a truth table, and almost every test in this suite exercises one row of it: a single
 * condition, on one node. A refactor that turned "any refuses" into "the innermost decides" or "the
 * last one set wins" would pass all of them, because with one condition every rule agrees.
 *
 * The rows that tell the rules apart are the ones where two conditions disagree, and the case where a
 * declarative condition and an imperative binding meet on the same field — a `when` written in the
 * schema and a `setInactive` called at runtime are different mechanisms, and "one answer" is a claim
 * about them together.
 *
 * Green. It exists because the rule is invisible until something contradicts it.
 */

import { createForm, field, group, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 70));

async function submitted(form) {
  let payload = null;
  await form.submit((value) => {
    payload = value;
  });
  return payload;
}

battle(
  {
    claims: ["VAL-003", "COL-003"],
    title: "two conditions on one field are one answer, and any refusal is the answer",
    environments: ["node"],
  },
  async (ctx) => {
    // The whole truth table for two conditions: one on the section, one on the field inside it. Only
    // the row where both agree keeps the field in play, and the three rows that differ are what tell
    // "any refuses" apart from "the innermost decides".
    for (const [section, inner, kept] of [
      [true, true, true],
      [true, false, false],
      [false, true, false],
      [false, false, false],
    ]) {
      const form = createForm(
        {
          keep: field("k"),
          sect: group({ inner: field("i", [], { when: () => inner }) }, { when: () => section }),
        },
        { devWarnings: false },
      );
      await settled();
      const payload = await submitted(form);
      form.destroy();
      ctx.log.note("two conditions on one field", { section, inner, payload });

      expectEqual(payload, kept ? { keep: "k", sect: { inner: "i" } } : { keep: "k" }, {
        claimIds: ["VAL-003"],
        what: `a section saying ${section} and a field saying ${inner} did not give the answer "any refusal wins"`,
      });
    }

    // Three levels, because "any" has to mean any and not "either of the nearest two".
    for (const [outer, middle, leaf] of [
      [false, true, true],
      [true, false, true],
      [true, true, false],
    ]) {
      const form = createForm(
        {
          keep: field("k"),
          one: group(
            { two: group({ leaf: field("L", [], { when: () => leaf }) }, { when: () => middle }) },
            { when: () => outer },
          ),
        },
        { devWarnings: false },
      );
      await settled();
      const payload = await submitted(form);
      form.destroy();
      ctx.log.note("three conditions between the form and the leaf", { outer, middle, leaf, payload });

      expectEqual(payload, { keep: "k" }, {
        claimIds: ["VAL-003", "COL-003"],
        what: `with conditions ${JSON.stringify([outer, middle, leaf])} the leaf stayed in play, so a refusal further away was not counted`,
      });
    }

    // The control for the three above: all three agreeing keeps it, so the rows are about the
    // refusals rather than about depth losing the field.
    const open = createForm(
      {
        keep: field("k"),
        one: group(
          { two: group({ leaf: field("L", [], { when: () => true }) }, { when: () => true }) },
          { when: () => true },
        ),
      },
      { devWarnings: false },
    );
    await settled();
    expectEqual(await submitted(open), { keep: "k", one: { two: { leaf: "L" } } }, {
      claimIds: ["VAL-003"],
      what: "three conditions all saying yes still left the leaf out of play",
    });
    open.destroy();

    // And the two mechanisms meeting: a condition written in the schema and a binding set at runtime
    // are different things, and "one answer" is a claim about them together.
    const reactivity = vanillaReactivity();
    const off = reactivity.signal(false);
    const both = createForm(
      { keep: field("k"), sect: group({ inner: field("i") }, { when: () => true }) },
      { devWarnings: false },
    );
    both.setInactive("sect", () => off());
    await settled();
    const whileAllowed = await submitted(both);
    off.set(true);
    await settled();
    const onceRefused = await submitted(both);
    both.destroy();
    ctx.log.note("a schema condition and a runtime binding on one section", { whileAllowed, onceRefused });

    expectEqual([whileAllowed, onceRefused], [{ keep: "k", sect: { inner: "i" } }, { keep: "k" }], {
      claimIds: ["VAL-003"],
      what: "a runtime refusal did not overrule a schema condition that was allowing the section",
    });
  },
);
