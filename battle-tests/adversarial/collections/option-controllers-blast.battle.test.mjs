/**
 * The same two defects in the next controller along, and the one that opted out.
 *
 * `createSelectController` derives an option's key with `String(option.value)` and builds its view
 * parts from the declared list rather than the painted one. `createMultiselectFieldController` does
 * both, in its own file — so the blast radius is not one widget, and a fix to the select alone
 * leaves a multiselect doing exactly what the select stopped doing.
 *
 * The multiselect is the worse of the two for the key collapse, because a multiselect is *how* a
 * list of domain objects is chosen from. Toggling the first of three object-valued options puts the
 * third into the form, and the widget then draws a chip for the third — internally consistent,
 * externally wrong, and silent.
 *
 * The third battle is a divergence rather than a defect in one place. `options-reconciliation` opens
 * by naming its own scope: "Any control that offers a list faces this: a form holds `"fr"`, the
 * options arrive without it, and the control has to show something." Select and multiselect both
 * import it. `createOptionFieldController` — the radio group and the segmented control — does not,
 * so a radio group holding a value its list does not offer paints nothing at all: the user sees an
 * unanswered question while the form holds an answer, and submitting keeps the answer they cannot
 * see.
 *
 * Whether radio should paint an unrecognised entry is a design decision and the reconciliation
 * module has already argued one side of it. What is not a decision is that two of the three controls
 * do it and the third does not, with nothing saying why.
 */

import { createForm, field } from "@modyra/core";
import { createMultiselectFieldController, createOptionFieldController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Three options whose values are domain objects, as an API returns them. */
function people() {
  const values = [{ id: 1, name: "Ada" }, { id: 2, name: "Grace" }, { id: 3, name: "Hopper" }];
  return { values, options: values.map((value) => ({ value, label: value.name })) };
}

battle(
  {
    claims: ["UI-003"],
    title: "a multiselect adds the option that was toggled",
    environments: ["node"],
  },
  async (ctx) => {
    const { values, options } = people();
    const form = createForm({ picks: field([]) }, { devWarnings: false });
    const controller = createMultiselectFieldController({
      widgetId: "w",
      handle: form.f.picks,
      options,
      mode: "multiple",
    });

    try {
      // The default `keyFor` is the same one the select uses, in a separate file. Every option
      // answers to the same key, so the index holds whichever was written last.
      const keys = options.map((option) => String(option.value));
      ctx.log.note("the key a multiselect derives for each option", { keys });

      expectEqual(new Set(keys).size, options.length, {
        claimIds: ["UI-003"],
        what: "a multiselect gives two different options the same key",
        detail: JSON.stringify(keys),
      });

      controller.dispatch({ type: "toggle", optionKey: keys[0] });
      const held = form.getValue().picks;
      ctx.log.note("what the form holds after toggling the first option", { held });

      expectEqual(held, [values[0]], {
        claimIds: ["UI-003"],
        what: "toggling the first option put a different one into the form",
        detail: JSON.stringify({ toggled: values[0], held }),
      });
    } finally {
      controller.destroy?.();
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["UI-004", "A11Y-001"],
    title: "a multiselect's surviving choice is one of its options",
    environments: ["node"],
  },
  async (ctx) => {
    // A value the reloaded list does not contain, kept and painted — and then not given a part,
    // the same way the select does not give one.
    const form = createForm({ picks: field(["en"]) }, { devWarnings: false });
    const controller = createMultiselectFieldController({
      widgetId: "w",
      handle: form.f.picks,
      options: [{ value: "de", label: "Deutsch" }],
      mode: "multiple",
    });

    try {
      const painted = controller.state().options ?? [];
      const parts = controller.view().parts ?? {};
      const missing = painted
        .map((option) => String(option.value))
        .filter((key) => parts[key] === undefined);
      ctx.log.note("what a multiselect paints against what it can bind", {
        painted: painted.map((option) => option.label),
        missing,
      });

      // The control: the survivor is painted and the declared option does have a part.
      expectClaim(painted.some((option) => option.value === "en") && parts.de !== undefined, {
        claimIds: ["UI-004"],
        what: "the survivor is not painted or the declared option has no part, so this compares nothing",
        detail: JSON.stringify({ painted: painted.map((option) => option.value), parts: Object.keys(parts) }),
      });

      expectEqual(missing, [], {
        claimIds: ["UI-004", "A11Y-001"],
        what: "a painted option has no part to bind, so it renders as something that is not an option",
        detail: JSON.stringify({ missing, parts: Object.keys(parts) }),
      });
    } finally {
      controller.destroy?.();
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["UI-004"],
    title: "every control that offers a list shows what it will not erase",
    environments: ["node"],
  },
  async (ctx) => {
    // A radio group holding a value its list does not offer. The value stays — nothing erases it —
    // and there is nothing on screen for it, so the user is looking at an unanswered question that
    // has an answer.
    const form = createForm({ pick: field("fr") }, { devWarnings: false });
    const controller = createOptionFieldController({
      widgetId: "w",
      handle: form.f.pick,
      options: [{ value: "en", label: "English" }, { value: "de", label: "Deutsch" }],
    });

    try {
      const parts = controller.view().parts ?? {};
      ctx.log.note("what a radio group shows for a value its list does not offer", {
        held: form.getValue().pick,
        parts: Object.keys(parts),
      });

      // The control: the value is kept, which is the half every control agrees on.
      expectEqual(form.getValue().pick, "fr", {
        claimIds: ["UI-004"],
        what: "the radio group erased a value its list did not offer",
      });

      // And the declared options are there, so a missing part below is the survivor rather than an
      // empty view.
      expectClaim(parts.en !== undefined && parts.de !== undefined, {
        claimIds: ["UI-004"],
        what: "the declared options have no parts, so this battle compares nothing",
        detail: JSON.stringify(Object.keys(parts)),
      });

      // The half they do not agree on. Select and multiselect paint an entry for the held value;
      // this one paints nothing, and the reconciliation module's own scope is "any control that
      // offers a list".
      expectClaim(parts.fr !== undefined, {
        claimIds: ["UI-004"],
        what: "a radio group holding a value its list does not offer shows the user nothing for it",
        detail: JSON.stringify(Object.keys(parts)),
      });
    } finally {
      controller.destroy?.();
      form.destroy();
    }
  },
);
