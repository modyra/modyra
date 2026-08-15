/**
 * A select whose options arrive after the value does.
 *
 * `reconcileSelectValue` is called every time an option list changes — loaded from a server,
 * filtered as the user types, replaced when a dependent field moves. The decision it makes is a
 * refusal: **the widget does not write to the model to make itself consistent.** A value the list
 * does not recognise is a value the form holds and the rules can judge, and erasing it destroys the
 * one thing that would let a person fix it. An import carrying a category that does not exist yet is
 * exactly the row somebody has to see.
 *
 * What it does repair is the representation. A value that matches an option loosely — `"1"` against
 * `1`, which is what a value read from JSON looks like — is replaced by the option's own value, so
 * identity comparisons downstream work on the thing the list holds rather than on a copy of it.
 *
 * Both halves are documented and neither had a battle, and they fail in opposite directions: a
 * reconciler that repaired too much would silently delete an unknown value, and one that repaired too
 * little would leave a select unable to show a choice the user made.
 *
 * The third battle here is the second failure, reached from an ordinary place. An option whose value
 * is an object — a customer, a category — arriving as a fresh object rather than the identical
 * reference is what a draft restore, a refetch and an import all produce. The engine says it is an
 * offered option; `defaultOptionKey` gives it the option's key, structurally, "the same rule `oneOf`
 * uses for an option (ADR 0051)". The reconciler's own comparison does not: objects are the same
 * choice only by reference.
 *
 * So the list gains an entry for a value that is already in it, labelled with its own JSON, sharing
 * a key with the option below it — which is the failure `defaultOptionKey`'s comment is about:
 * "a user picks the first customer and the widget selects the third, silently".
 */

import { oneOf } from "@modyra/core";
import { defaultOptionKey, optionsWithUnrecognizedValue, reconcileSelectValue } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const OPTIONS = Object.freeze([
  Object.freeze({ value: 1, label: "One" }),
  Object.freeze({ value: 2, label: "Two" }),
]);

battle(
  {
    claims: ["PER-003", "VAL-003"],
    title: "a value the option list does not contain is not erased by the list changing",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a value the list does contain is kept, so what follows is about the unknown one
    // rather than about a reconciler that never changes anything.
    const known = reconcileSelectValue({ value: 2, parkedValue: null }, OPTIONS);
    expectEqual(known, { value: 2, parkedValue: null }, {
      claimIds: ["PER-003"],
      what: "a value the list contains did not survive reconciliation",
    });

    for (const [what, options] of [
      ["a list that does not have it", OPTIONS],
      ["a list that has not loaded yet", []],
    ]) {
      const outcome = reconcileSelectValue({ value: 99, parkedValue: null }, options);
      ctx.log.note("a value the list does not know", { what, outcome });

      // Erasing it is the failure: the person who imported the row can no longer see what they
      // imported, and the validation message names a value that is not on screen.
      expectEqual(outcome.value, 99, {
        claimIds: ["PER-003", "VAL-003"],
        what: `${what}: the value the model held was thrown away when the options changed`,
      });
    }
  },
);

battle(
  {
    claims: ["PER-003"],
    title: "a value that matches an option loosely becomes the option's own value",
    environments: ["node"],
  },
  async (ctx) => {
    // What a value read from JSON looks like: the right choice, the wrong type. Left as it is, every
    // identity comparison downstream — the selected option, the highlighted row — answers no.
    const outcome = reconcileSelectValue({ value: "1", parkedValue: null }, OPTIONS);
    ctx.log.note("a loose match", { outcome });

    expectEqual(outcome.value, 1, {
      claimIds: ["PER-003"],
      what: "a value that matches an option loosely was not repaired to the option's value",
    });

    // Identity rather than equality: the point of the repair is that the model now holds the same
    // thing the list does, so a comparison by reference finds it.
    expectClaim(outcome.value === OPTIONS[0].value, {
      claimIds: ["PER-003"],
      what: "the repaired value equals the option's value without being it",
    });

  },
);

battle(
  {
    claims: ["PER-003", "A11Y-002"],
    title: "an option that came back as a fresh object is one option, not two",
    environments: ["node"],
  },
  async (ctx) => {
    // An option list of objects, and the same choice arriving as a fresh one: a draft restored, a
    // list refetched, a row imported.
    const options = [
      { value: { id: 1, name: "Ada" }, label: "Ada" },
      { value: { id: 2, name: "Bo" }, label: "Bo" },
    ];
    const restored = JSON.parse(JSON.stringify(options[0].value));

    // The two layers that already agree, which is what makes the third one the odd answer rather
    // than the strict one.
    expectEqual(oneOf(options.map((option) => option.value))(restored), [], {
      claimIds: ["PER-003"],
      what: "the engine no longer offers an option that came back as a fresh object",
    });

    expectEqual(defaultOptionKey(restored), defaultOptionKey(options[0].value), {
      claimIds: ["PER-003"],
      what: "the widget no longer keys an option by what it holds",
    });

    const reconciled = reconcileSelectValue({ value: restored, parkedValue: null }, options);
    const shown = optionsWithUnrecognizedValue(options, reconciled.value);
    const keys = shown.map((option) => defaultOptionKey(option.value));
    const duplicated = keys.filter((key, index) => keys.indexOf(key) !== index);
    ctx.log.note("the list a select would render", {
      entries: shown.map((option) => option.label),
      duplicated,
    });

    // Two options went in and the user is shown three, two of them the same customer — one named
    // "Ada" and one named by its own JSON.
    expectEqual(shown.length, options.length, {
      claimIds: ["PER-003"],
      what: `a select showing ${options.length} options renders ${shown.length}, because a value already in the list was called unrecognised`,
      detail: JSON.stringify(shown.map((option) => option.label)),
    });

    // And a key is what becomes a part id and lands in aria-activedescendant, so two entries sharing
    // one is a keyboard pointing at whichever the DOM found first.
    expectEqual(duplicated, [], {
      claimIds: ["A11Y-002"],
      what: "two entries in one list share a key",
    });
  },
);

battle(
  {
    claims: ["PER-003"],
    title: "a value parked before its option existed comes back when it arrives",
    environments: ["node"],
  },
  async (ctx) => {
    // The state an earlier version of this widget could leave behind: a value set before the list
    // loaded. It is restored when its option turns up and kept while it has not.
    const arrived = reconcileSelectValue({ value: null, parkedValue: 2 }, OPTIONS);
    ctx.log.note("its option arrived", { arrived });

    expectEqual(arrived, { value: 2, parkedValue: null }, {
      claimIds: ["PER-003"],
      what: "a parked value was not restored when its option arrived",
    });

    const waiting = reconcileSelectValue({ value: null, parkedValue: 99 }, OPTIONS);
    expectEqual(waiting, { value: null, parkedValue: 99 }, {
      claimIds: ["PER-003"],
      what: "a parked value whose option has not arrived was dropped or promoted",
    });

    const empty = reconcileSelectValue({ value: null, parkedValue: null }, OPTIONS);
    expectEqual(empty, { value: null, parkedValue: null }, {
      claimIds: ["PER-003"],
      what: "a select holding nothing came out of reconciliation holding something",
    });
  },
);
