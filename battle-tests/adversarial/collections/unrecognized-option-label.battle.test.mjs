/**
 * A selection that survives a refetch and is shown as "[object Object]".
 *
 * `options-reconciliation` states the rule it exists for: a value the options do not contain is
 * still the value, so *what it will not erase, it has to show*. A form holds a customer, the list
 * reloads without them, and the widget keeps the selection and paints an entry for it rather than
 * silently clearing the field.
 *
 * The entry is built as `{ value, label: String(value) }`. For a primitive that is the documented
 * behaviour and a reasonable one — an unrecognised `"fr"` shows as `fr`, which is less than the
 * label the list would have given it and still names the thing. For an object it is
 * `"[object Object]"`, which names nothing at all.
 *
 * So the mechanism that exists to stop a user losing their choice shows them a choice they cannot
 * read. Worse than the value being cleared in one respect: cleared is visible, and a field reading
 * `[object Object]` looks like it has a value and gives the user nothing to act on.
 *
 * This is not the key collapse filed against `createSelectController` — it survives a correct
 * caller-supplied `keyFor`, because the label is derived separately and no `labelFor` exists to
 * supply. Fixing the key does not fix this.
 *
 * The same module already knows the hazard. Its own `sameChoice` refuses to compare objects through
 * `String()`, in a comment that says why: "`String()` renders every plain object as
 * `[object Object]`, so a comparison through it says two different entities are the same one". The
 * comparison was hardened against exactly the coercion the label still performs.
 */

import {
  createSelectController,
  optionsWithUnrecognizedValue,
  optionsWithUnrecognizedValues,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A page of results that no longer contains what the user picked. */
const REFETCHED = Object.freeze([{ value: { id: 3, name: "Hopper" }, label: "Hopper" }]);

/** Whether a label tells the reader which thing it is. */
const namesNothing = (label) => label === "[object Object]" || label === "[object Array]";

battle(
  {
    claims: ["UI-004"],
    title: "a selection the list no longer offers is shown as something a reader can identify",
    environments: ["node"],
  },
  async (ctx) => {
    const held = { id: 1, name: "Ada" };
    const painted = optionsWithUnrecognizedValue(REFETCHED, held);
    const survivor = painted.find((option) => option.value === held);
    ctx.log.note("a held object after the list reloaded without it", {
      labels: painted.map((option) => option.label),
    });

    // The control: the value is kept, which is the rule this module exists for. If it were dropped
    // the label would be nobody's problem and this battle would be about a different defect.
    expectClaim(survivor !== undefined, {
      claimIds: ["UI-004"],
      what: "the held value was dropped from the painted list instead of being kept",
      detail: JSON.stringify(painted.map((option) => option.label)),
    });

    expectClaim(!namesNothing(survivor.label), {
      claimIds: ["UI-004"],
      what: "a surviving selection is shown as text that names nothing",
      detail: JSON.stringify({ held, label: survivor.label }),
    });

    // The multi-value form has the same rule and the same derivation, so a fix to one that misses
    // the other leaves a multiselect showing what a select no longer does.
    const many = optionsWithUnrecognizedValues(REFETCHED, [held, { id: 2, name: "Grace" }]);
    ctx.log.note("two held objects after the same reload", { labels: many.map((option) => option.label) });

    expectClaim(!many.some((option) => namesNothing(option.label)), {
      claimIds: ["UI-004"],
      what: "a multi-value control shows a surviving selection as text that names nothing",
      detail: JSON.stringify(many.map((option) => option.label)),
    });
  },
);

battle(
  {
    claims: ["UI-004"],
    title: "a primitive that the list no longer offers still names itself",
    environments: ["node"],
  },
  async (ctx) => {
    // The boundary, and the behaviour a fix must not disturb: a primitive names itself, which is
    // less than the list's label and is still a thing the reader can act on. This is the documented
    // case and it is correct.
    const options = [{ value: "en", label: "English" }];

    for (const held of ["fr", 7, true]) {
      const painted = optionsWithUnrecognizedValue(options, held);
      const survivor = painted.find((option) => option.value === held);
      ctx.log.note("a held primitive after the list reloaded without it", {
        held,
        label: survivor?.label ?? null,
      });

      expectEqual(survivor?.label, String(held), {
        claimIds: ["UI-004"],
        what: `a held ${typeof held} stopped naming itself when the list no longer offered it`,
        detail: JSON.stringify({ held, label: survivor?.label ?? null }),
      });
    }

    // And a value the list does contain is left alone entirely — no synthetic entry, no duplicate.
    const recognised = optionsWithUnrecognizedValue(options, "en");
    expectEqual(recognised, options, {
      claimIds: ["UI-004"],
      what: "a value the list offers was painted a second time",
      detail: JSON.stringify(recognised.map((option) => option.label)),
    });

    // Nothing held, nothing added.
    for (const empty of [null, undefined, ""]) {
      expectEqual(optionsWithUnrecognizedValue(options, empty), options, {
        claimIds: ["UI-004"],
        what: `an empty selection (${String(empty)}) added an entry to the list`,
      });
    }
  },
);

battle(
  {
    claims: ["UI-004", "A11Y-001"],
    title: "the surviving choice is an option the listbox can name",
    environments: ["node"],
  },
  async (ctx) => {
    // The state contract is explicit about what a renderer paints: "A renderer paints this rather
    // than the list it was handed. That is what makes 'a widget does not erase what it cannot show'
    // a property of the contract instead of a habit each renderer has to remember."
    //
    // The view builds its option parts from the *declared* list instead. So a renderer that follows
    // the contract paints one element more than it has parts for, and the extra one is the survivor
    // — the single entry the user needs in order to see and replace their value.
    const controller = createSelectController({
      widgetId: "w",
      options: [{ value: "en", label: "English" }],
    });

    try {
      controller.setValue("en");
      controller.setOptions([{ value: "de", label: "Deutsch" }]);

      const painted = controller.state().options;
      const parts = controller.view().parts;
      const missing = painted
        .map((option) => String(option.value))
        .filter((key) => parts[key] === undefined);
      ctx.log.note("what a renderer paints against what it can bind", {
        painted: painted.map((option) => option.label),
        parts: Object.keys(parts),
        missing,
      });

      // The control: the survivor is in the list the contract says to paint, and the declared option
      // does have a part — so a failure below is the survivor specifically rather than the view
      // being empty.
      expectClaim(painted.some((option) => option.value === "en") && parts.de !== undefined, {
        claimIds: ["UI-004"],
        what: "the survivor is not painted or the declared option has no part, so this compares nothing",
        detail: JSON.stringify({ painted: painted.map((option) => option.value), parts: Object.keys(parts) }),
      });

      // Every painted option needs a part. Without one it renders with no id, no `role="option"`
      // and no `aria-selected` — an element inside a listbox that is not an option, and one that
      // `aria-activedescendant` could never point at.
      expectEqual(missing, [], {
        claimIds: ["UI-004", "A11Y-001"],
        what: "a painted option has no part to bind, so it renders inside the listbox as something that is not an option",
        detail: JSON.stringify({ missing, parts: Object.keys(parts) }),
      });
    } finally {
      controller.destroy();
    }
  },
);
