/**
 * An intent a controller does not handle, passed to the runtime the way the guide says to pass it.
 *
 * `docs/guides/headless-recipes.md` teaches the wrapper-less path in two lines, and the second is
 * this one, verbatim:
 *
 *   runtime.execute(controller.dispatch({ type: "open" }), lookup, handlers);
 *
 * The result of `dispatch` goes straight into `execute`. That is the whole recipe — the guide says
 * these are *"the only two a wrapper does for you"*.
 *
 * A controller handles the intents its kind has. A text field has no popup, a checkbox has no step,
 * a select has no cancel. Handed one it does not know, `dispatch` returns `undefined` rather than an
 * empty list, and `createCommandRuntime().execute(undefined, …)` raises `commands is not iterable`.
 *
 * Every pairing measured below does it, across three controllers and five intents. So a host that
 * follows the recipe and drives its widgets from one generic event handler — the reason to be
 * headless in the first place — crashes on the first intent that does not apply to the widget under
 * the cursor.
 *
 * This is the one direction the rest of the framework refuses. An operator nobody declared decides
 * `false`; a pattern that will not compile *"decides nothing instead"*, because raising went through
 * *"whatever read the form last — the submit button included"*. An intent nobody declared is the
 * same shape of input and gets the opposite treatment.
 *
 * The battle takes no side on where the repair goes: `dispatch` returning an empty list, or `execute`
 * accepting what `dispatch` returns, both satisfy it. What it will not accept is the pair as it
 * stands, because the guide joins them.
 */

import { createForm, field, observerFor } from "@modyra/core";
import {
  createBooleanFieldController,
  createCommandRuntime,
  createOptionFieldController,
  createTextFieldController,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The intents the transition vocabulary names, none of which every kind has. */
const INTENTS = Object.freeze([
  { type: "open" },
  { type: "toggle" },
  { type: "commit" },
  { type: "cancel" },
  { type: "step", delta: 1 },
]);

battle(
  {
    claims: ["API-001", "SEC-004"],
    title: "an intent a controller does not know does not take the host down",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ t: field(""), s: field(null), b: field(false) }, { devWarnings: false });
    const runtime = createCommandRuntime({ announcerId: "a", defer: (run) => run() });
    const controllers = [
      ["a text field", createTextFieldController({ widgetId: "t", handle: form.f.t }, observerFor(form.f.t))],
      ["a checkbox", createBooleanFieldController({ widgetId: "b", handle: form.f.b }, observerFor(form.f.b))],
      [
        "a select",
        createOptionFieldController(
          { widgetId: "s", handle: form.f.s, options: [{ value: "a", label: "A" }] },
          observerFor(form.f.s),
        ),
      ],
    ];

    try {
      // The control, and it is the recipe's own happy path: an intent the controller does handle
      // produces a list, and the runtime executes it. Without this, "everything raises" could
      // describe a runtime that raises on everything.
      const [, text] = controllers[0];
      const handled = text.dispatch({ type: "input", value: "typed" });
      let handledExecuted = "raised";
      try {
        runtime.execute(handled, () => null, {});
        handledExecuted = "executed";
      } catch {
        handledExecuted = "raised";
      }
      expectClaim(Array.isArray(handled) && handledExecuted === "executed", {
        claimIds: ["API-001"],
        what: "the recipe's own happy path does not work, so the probe is wrong before the product is",
        detail: JSON.stringify({ handled, handledExecuted }),
      });

      // And the recipe, run as written, for every intent that does not apply.
      const raised = [];
      for (const [what, controller] of controllers) {
        for (const intent of INTENTS) {
          let dispatched;
          try {
            dispatched = controller.dispatch(intent);
          } catch (error) {
            raised.push({ what, intent: intent.type, at: "dispatch", message: String(error).slice(0, 60) });
            continue;
          }
          try {
            runtime.execute(dispatched, () => null, {});
          } catch (error) {
            raised.push({ what, intent: intent.type, at: "execute", message: String(error).slice(0, 60) });
          }
        }
      }
      ctx.log.note("the recipe, run as written, for every intent a kind does not have", { raised });

      expectEqual(raised, [], {
        claimIds: ["API-001", "SEC-004"],
        what: "an intent a controller does not know raised out of the two lines the guide teaches, so a headless host driving widgets from one handler crashes on the first widget that does not have that intent",
      });
    } finally {
      for (const [, controller] of controllers) controller.destroy?.();
      form.destroy();
    }
  },
);
