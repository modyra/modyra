/**
 * The view a picker opens in, and whether it is still that view the second time.
 *
 * `viewMode` is an option on the controller and `MDY_TIMEPICKER_INITIAL_VIEW` is its default, so a
 * host can already say which view a picker starts on. What nothing outside the controller checks is
 * the part that makes it a *declaration* rather than a seed:
 *
 *     timepicker-field-controller.ts:242   viewMode.set(initialViewMode)
 *
 * Closing returns the picker to the view its host asked for, not to whichever one the person last
 * toggled. That is the whole difference between "opens on the dial the first time" and "opens on the
 * dial", and a renderer that cached the mode across a close would satisfy the first and fail the
 * second — silently, because the first open would look right.
 *
 * Written before the outward route exists, deliberately. The batch adding `viewMode` to a document and
 * to the three renderers can only be judged against what the controller already promises, and pinning
 * that promise first is what stops the promise moving to fit the implementation.
 *
 * Both directions, so a controller that always returns to the constant and one that never returns at
 * all are told apart: a picker declared onto the boxes must come back to the boxes, not to the dial.
 *
 * Green when a picker opens where it was told to, every time it opens.
 */

import { createForm, field } from "@modyra/core";
import { createTimepickerFieldController, MDY_TIMEPICKER_INITIAL_VIEW } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/** A picker over its own field, with whatever view its host declared. */
function picker(options = {}) {
  const form = createForm({ t: field("09:30") }, { devWarnings: false });
  const controller = createTimepickerFieldController({ widgetId: "w", handle: form.f.t, ...options });
  return controller;
}

const view = (controller) => controller.state().viewMode;

battle(
  {
    claims: ["UI-002", "API-001"],
    title: "a picker opens in the view its host declared, every time",
    environments: ["node"],
  },
  async (ctx) => {
    // What an undeclared picker does, which is the default this library ships and the thing a document
    // will be overriding.
    const byDefault = picker();
    byDefault.dispatch({ type: "open" });
    expectEqual(view(byDefault), MDY_TIMEPICKER_INITIAL_VIEW, {
      claimIds: ["UI-002"],
      what: "a picker with nothing declared does not open in the view the contract publishes as its default",
    });

    // Declared the other way. Read from the constant rather than written as "input", so this says
    // "the view that is not the default" and keeps saying it if the default is ever changed.
    const other = MDY_TIMEPICKER_INITIAL_VIEW === "dial" ? "input" : "dial";
    const declared = picker({ viewMode: other });
    declared.dispatch({ type: "open" });
    expectEqual(view(declared), other, {
      claimIds: ["UI-002", "API-001"],
      what: `a picker declared onto the ${other} view opened on the other one, so the option is accepted and ignored`,
    });

    ctx.log.note("what each picker opened on", {
      contractDefault: MDY_TIMEPICKER_INITIAL_VIEW,
      undeclared: view(byDefault),
      declared: view(declared),
    });

    // The person changes it, the way the mode toggle does.
    declared.dispatch({ type: "set-view-mode", mode: MDY_TIMEPICKER_INITIAL_VIEW });
    expectEqual(view(declared), MDY_TIMEPICKER_INITIAL_VIEW, {
      claimIds: ["UI-002"],
      what: "the mode toggle's own intent did not change the view, so the rest of this battle would prove nothing",
    });

    // And the property: closing puts it back to what the host asked for. A renderer that keeps the
    // mode across a close is showing the person a view nobody declared, and the first open — the only
    // one anybody usually checks — would have looked right.
    declared.dispatch({ type: "cancel" });
    declared.dispatch({ type: "open" });
    expectEqual(view(declared), other, {
      claimIds: ["UI-002", "API-001"],
      what: `reopening kept the view the person had toggled to instead of returning to the declared ${other}, so the declaration holds only until somebody touches it`,
    });

    // The same for an undeclared picker, so "always returns to the constant" and "returns to what was
    // declared" cannot both pass by being the same answer.
    byDefault.dispatch({ type: "set-view-mode", mode: other });
    byDefault.dispatch({ type: "cancel" });
    byDefault.dispatch({ type: "open" });
    expectEqual(view(byDefault), MDY_TIMEPICKER_INITIAL_VIEW, {
      claimIds: ["UI-002"],
      what: "an undeclared picker did not return to the contract's default after the person changed the view",
    });
  },
);
