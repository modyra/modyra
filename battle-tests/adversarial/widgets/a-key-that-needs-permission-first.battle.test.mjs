/**
 * A key the table declares without conditions is a key a control answers as declared.
 *
 * `MDY_WIDGET_KEYBOARD` carries a `when` on each binding — `"open"`, `"closed"` — so the table can
 * already say that a key applies only in some state. What it cannot say is that a key applies only if
 * the field **asked for the capability**, and `reorderable` is exactly that: opt-in, off by default.
 *
 * So a consumer reading the table to build a help panel, or a renderer reading it to decide what to
 * bind, is told about keys that a control written the ordinary way will not honour. The reader has no
 * way to tell those from the ones it will.
 *
 * **This is the cheap half of a check that already exists and costs ten minutes.**
 * `every-key-a-kind-declares.spec.ts` mounts every kind in a browser, presses every binding at every
 * focusable part, and reports the same four keys — which is the honest measurement and is far too
 * slow to run except at a boundary. Asking the table directly costs milliseconds and catches the
 * declaration rather than its consequence, so the two are worth having together: this one fails the
 * moment a binding is written, that one fails if a binding is written correctly and implemented
 * wrongly.
 *
 * The rule asserted is the narrow one, because it is the one the evidence supports: **a binding whose
 * intent is a capability the field opts into must carry a precondition.** It does not say what the
 * precondition should look like — `when: "reorderable"`, a separate field, anything — because that is
 * a contract decision and a battle must not make it.
 */
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/** Intents that only exist when a field turned the capability on. */
const OPT_IN_INTENTS = ["reorder", "move-selected"];

battle(
  {
    claims: ["A11Y-001"],
    title: "a key that needs the field's permission says so in the table",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = Object.entries(MDY_WIDGET_KEYBOARD)
      .filter(([, list]) => Array.isArray(list))
      .flatMap(([kind, list]) => list.map((binding) => ({ kind, ...binding })));

    const optIn = declared.filter((binding) => OPT_IN_INTENTS.includes(binding.intent));

    ctx.log.note("bindings whose intent needs a capability the field opts into", {
      found: optIn.map((binding) => `${binding.kind} ${binding.key} ${binding.intent} when=${binding.when ?? "(none)"}`),
    });

    // The premise: the table declares such a binding at all. A table with none would pass this while
    // saying nothing, and a capability that stops being opt-in should retire this battle rather than
    // leave it green and meaningless.
    expectEqual(optIn.length > 0, true, {
      claimIds: ["A11Y-001"],
      what: "no binding declares an intent that needs a capability, so this battle is comparing nothing",
      detail: JSON.stringify(declared.map((binding) => binding.intent).filter((intent, at, all) => all.indexOf(intent) === at)),
    });

    const unconditional = optIn.filter((binding) => binding.when === undefined || binding.when === null);
    expectEqual(unconditional.map((binding) => `${binding.kind} ${binding.key}`), [], {
      claimIds: ["A11Y-001"],
      what: "the table declares a key for a capability the field must opt into, with no precondition — so a consumer reading it cannot tell that key from one an ordinary control answers",
      detail: JSON.stringify(unconditional),
    });
  },
);
