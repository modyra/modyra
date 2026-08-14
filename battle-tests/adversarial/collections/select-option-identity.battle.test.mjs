/**
 * Choosing one option and being given another.
 *
 * `createSelectController` is the headless select every framework adapter wraps — Vue, Solid,
 * Svelte, React and Preact each build their `useMdySelect` on it and add only the bridge to their
 * own reactivity. Whatever it decides, all six do.
 *
 * It indexes options by a string key, and `keyFor` is optional: it defaults to
 * `String(option.value)`. `TValue` is unconstrained, and `@modyra/core`'s value contracts say in so
 * many words that an option's value is *whatever the option list holds* — so a list of domain
 * objects is not an exotic use, it is the documented one.
 *
 * `String({ id: 1 })` is `"[object Object]"`. So is every other object. The key index collapses to a
 * single entry holding whichever option was written last, and `setValue` resolves through it.
 *
 * The result is not a failure to select. It is selecting the wrong thing:
 *
 *     asked for { id: 1 }  ->  held { id: 3 }
 *     asked for { id: 2 }  ->  held { id: 3 }
 *     asked for { id: 3 }  ->  held { id: 3 }
 *
 * Nothing raises, nothing is logged, and the widget is internally consistent — it will render the
 * third option as selected, because that is what it believes. A user picks the first customer in the
 * list and the form submits the last one.
 *
 * Arrays are the near miss that makes the boundary clear: `String(["b"])` is `"b"`, distinct per
 * array, so a list of arrays works by accident. It is objects, and anything else whose `toString`
 * does not vary, that collapse.
 */

import { createSelectController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Ask a controller for one option and report what it ended up holding. */
function askFor(options, value, keyFor) {
  const controller = createSelectController({
    widgetId: "w",
    options,
    ...(keyFor ? { keyFor } : {}),
  });
  try {
    controller.setValue(value);
    return controller.state().selectedValue;
  } finally {
    controller.destroy();
  }
}

/** Three options whose values are domain objects, as a list loaded from an API would be. */
function objectOptions() {
  const values = [{ id: 1 }, { id: 2 }, { id: 3 }];
  return { values, options: values.map((value, index) => ({ value, label: `Customer ${index + 1}` })) };
}

battle(
  {
    claims: ["UI-003"],
    title: "a select holds the option that was chosen",
    environments: ["node"],
  },
  async (ctx) => {
    const { values, options } = objectOptions();

    for (const [index, wanted] of values.entries()) {
      const held = askFor(options, wanted);
      ctx.log.note("choosing one option from a list of objects", { index, wanted, held });

      expectEqual(held, wanted, {
        claimIds: ["UI-003"],
        what: `choosing option ${index} left the select holding a different one`,
        detail: JSON.stringify({ wanted, held }),
      });
    }
  },
);

battle(
  {
    claims: ["UI-003"],
    title: "the shapes that already work keep working",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the boundary of any fix: values that stringify distinctly resolve correctly
    // today, and must still. A fix that changed how string or number options are keyed would move
    // ids and selections that are correct right now.
    const strings = [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }];
    const numbers = [{ value: 1, label: "A" }, { value: 2, label: "B" }, { value: 3, label: "C" }];
    ctx.log.note("value shapes that stringify distinctly", {});

    for (const [label, options, wanted] of [
      ["strings", strings, "b"],
      ["numbers", numbers, 2],
    ]) {
      expectEqual(askFor(options, wanted), wanted, {
        claimIds: ["UI-003"],
        what: `a list of ${label} no longer holds the option that was chosen`,
      });
    }

    // Arrays work by accident rather than by design — `String(["b"])` is `"b"` — and are here so a
    // fix does not quietly change them either.
    const arrays = [["a"], ["b"], ["c"]].map((value, index) => ({ value, label: `L${index}` }));
    expectEqual(askFor(arrays, arrays[1].value), arrays[1].value, {
      claimIds: ["UI-003"],
      what: "a list of arrays no longer holds the option that was chosen",
    });

    // And the escape hatch a caller has today: naming the key themselves. This is what makes the
    // failure above a default rather than a limit — the controller can do it, it is only the
    // default that cannot.
    const { values, options } = objectOptions();
    expectEqual(askFor(options, values[1], (option) => String(option.value.id)), values[1], {
      claimIds: ["UI-003"],
      what: "a caller-supplied keyFor did not make object options selectable",
    });
  },
);

battle(
  {
    claims: ["UI-003"],
    title: "two options never answer to the same key",
    environments: ["node"],
  },
  async (ctx) => {
    // The mechanism under the symptom, asserted directly so a fix can be checked without driving a
    // selection: distinct options must have distinct keys, or every lookup through the index is a
    // coin toss decided by insertion order.
    const { options } = objectOptions();
    const controller = createSelectController({ widgetId: "w", options });

    try {
      const keys = options.map((option) => String(option.value));
      ctx.log.note("the key the default derives for each option", { keys });

      expectEqual(new Set(keys).size, options.length, {
        claimIds: ["UI-003"],
        what: "the default key derivation gives two different options the same key",
        detail: JSON.stringify(keys),
      });

      // The control: the controller does surface all three options, so the collapse is in the key
      // rather than in the list being truncated on the way in.
      expectEqual(controller.state().options.length, options.length, {
        claimIds: ["UI-003"],
        what: "the controller dropped options before any key was derived",
        detail: JSON.stringify(controller.state().options.length),
      });
    } finally {
      controller.destroy();
    }
  },
);
