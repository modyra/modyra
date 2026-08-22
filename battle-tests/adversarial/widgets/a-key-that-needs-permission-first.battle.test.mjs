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

/**
 * Which intents are opt-in is **read from the table**, not listed here.
 *
 * It was listed here — `["reorder", "move-selected"]` — and when the reordering intent was renamed
 * to `grab` this battle stopped finding anything and failed its own premise check rather than
 * passing empty. That is the check working, and it is also a copy of something the table owns, which
 * is the shape this campaign has now found five times.
 *
 * An intent is opt-in if **any** binding declaring it names a capability. The rule then becomes the
 * one worth having: if one binding of an intent is gated and another is not, the table is telling a
 * reader two different things about the same capability.
 */
const optInIntents = (declared) => new Set(
  declared.filter((binding) => binding.requires !== undefined && binding.requires !== null)
    .map((binding) => binding.intent),
);

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

    const intents = optInIntents(declared);
    const optIn = declared.filter((binding) => intents.has(binding.intent));

    ctx.log.note("bindings whose intent needs a capability the field opts into", {
      found: optIn.map((binding) =>
        `${binding.kind} ${binding.key} ${binding.intent} when=${binding.when ?? "(none)"} requires=${binding.requires ?? "(none)"}`),
    });

    // The premise: the table declares such a binding at all. A table with none would pass this while
    // saying nothing, and a capability that stops being opt-in should retire this battle rather than
    // leave it green and meaningless.
    expectEqual(optIn.length > 0, true, {
      claimIds: ["A11Y-001"],
      what: "no binding names a capability the field opts into, so this battle is comparing nothing — if opt-in capabilities are gone from the contract, retire this rather than leave it green",
      detail: JSON.stringify(declared.map((binding) => binding.intent).filter((intent, at, all) => all.indexOf(intent) === at)),
    });

    // **A precondition, not a particular field.** `when` says which state the widget must be in;
    // `requires` says which capability the field must have declared. Either answers the question a
    // reader is asking — *will an ordinary control honour this key* — and the table was given
    // `requires` precisely because `when` could not express a field-level flag. A battle that insisted
    // on `when` would have refused the better answer.
    const unconditional = optIn.filter((binding) =>
      (binding.when === undefined || binding.when === null)
      && (binding.requires === undefined || binding.requires === null));
    expectEqual(unconditional.map((binding) => `${binding.kind} ${binding.key}`), [], {
      claimIds: ["A11Y-001"],
      what: "the table declares a key for a capability the field must opt into, with no precondition — so a consumer reading it cannot tell that key from one an ordinary control answers",
      detail: JSON.stringify(unconditional),
    });
  },
);
