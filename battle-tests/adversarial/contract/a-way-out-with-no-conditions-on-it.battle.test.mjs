/**
 * Every panel a person can be inside declares a dismissal that no modifier can block.
 *
 * A binding that adds is refused while an accelerator is held — `Cmd+Enter` is submit in half the
 * products a person uses, `Cmd+ArrowDown` is end-of-document — and a binding that removes is honoured
 * whatever is held. The asymmetry is what the two mistakes cost: dismissing wrongly costs a reopen,
 * refusing to dismiss leaves somebody inside a panel with the way out shut, under a modifier nobody
 * thinks to test.
 *
 * The behaviour is checked in a page, per renderer. **This checks the declaration**, which is the
 * half a behavioural check cannot reach: a renderer that closes correctly by comparing the key itself
 * passes every press and keeps passing it when the catalogue changes underneath. Worse, a check that
 * asks the catalogue which kinds to exercise stops asking about a kind the moment its line is
 * deleted — the deletion makes the check smaller instead of red.
 *
 * `Tab` is deliberately not held to this. It is declared as a cancel because focus leaving a panel
 * ends it, not because it is a way out somebody reaches for, and `Shift+Tab` is navigation: demanding
 * it answer under any modifier would be demanding it swallow the gesture that moves backwards.
 */
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { battle } from "../../harness/battle.mjs";

/** The gesture a person reaches for to leave, as opposed to the one that leaves by accident. */
const WAY_OUT = "Escape";

battle(
  {
    claims: ["UI-002", "A11Y-002"],
    title: "a way out with no conditions on it",
    environments: ["node"],
  },
  async (ctx) => {
    const dismissals = [];
    for (const [kind, bindings] of Object.entries(MDY_WIDGET_KEYBOARD)) {
      for (const binding of bindings) {
        if (binding.key === WAY_OUT && binding.when === "open" && binding.intent === "cancel") {
          dismissals.push({ kind, modifier: binding.modifier ?? "none declared" });
        }
      }
    }

    ctx.log.note("the kinds whose open panel declares a way out", {
      kinds: dismissals.map(({ kind }) => kind),
    });

    // A catalogue that declared no dismissal at all satisfies the comparison below by having nothing
    // in it, and that is the shape a deletion takes.
    expectClaim(dismissals.length >= 5, {
      claimIds: ["UI-002"],
      what: `only ${dismissals.length} kind(s) declare a way out of an open panel, so this compared `
        + "almost nothing — a kind that loses its declaration leaves this check smaller rather than red",
      detail: JSON.stringify(dismissals),
    });

    expectEqual(
      dismissals.filter(({ modifier }) => modifier !== "any").map(({ kind }) => kind),
      [],
      {
        claimIds: ["UI-002", "A11Y-002"],
        what: "a kind declares a way out that a held modifier may block",
        detail: "Escape is what a person reaches for to leave, and a way out with conditions is not "
          + "one. Refusing it under an accelerator leaves somebody inside a panel with no way back to "
          + "the page, in the one case nobody tests.",
      },
    );
  },
);
