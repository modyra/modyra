/**
 * A popup left on screen over a field that has stopped taking input.
 *
 * A widget controller guards every intent behind its disabled state: a disabled control does not
 * open, does not move focus, does not act. That is right for the intents that *start* something.
 * `close` is not one of those — it ends something already happening — and guarding it the same way
 * left a widget disabled mid-overlay unable to emit the command that closes it.
 *
 * The rule that replaced it is one sentence rather than two exceptions: *a disabled widget is not
 * operable and does not hold an overlay*. So the state this battle names is unreachable by two
 * independent routes — disabling closes what is open, and `close` passes the guard whatever left it
 * open — and asserting either mechanism would pin one of them and let the other rot. What is
 * asserted instead is the outcome: after any sequence, a disabled widget is not sitting behind an
 * open popup.
 *
 * The sequence is ordinary. A form disables a field because a dependent value changed, an async
 * check came back, or a section became irrelevant — and the user has the picker open at that moment,
 * because that is what they were doing when the value they had just entered triggered the change.
 * From then on Escape produces no command, clicking away produces no command, and nothing else can:
 * every route out of an overlay goes through `close`.
 *
 * Disabling does not close it either. So the end state is an overlay sitting over a control that no
 * longer responds, with the state object reporting `open: true, disabled: true` — which is a state
 * the widget can reach and cannot leave until something re-enables it.
 *
 * The second battle is the same shape one layer along: a destroyed controller keeps dispatching.
 * `destroy` is an explicit no-op, so this is known rather than hidden, but it means a controller can
 * hand a renderer `close-overlay` for a widget the renderer has already torn down. The engine's own
 * rule for this — a destroyed thing answers and does not act — is the comparison.
 */

import { createCatalogWidgetController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["LIF-002"],
    title: "a disabled field is never left holding an open overlay",
    environments: ["node"],
  },
  async (ctx) => {
    const controller = createCatalogWidgetController("select");

    // The user opens the picker. The control: it opens, so what follows is about the disabling
    // rather than about a controller that never opened anything.
    const opened = controller.dispatch({ type: "open" });
    ctx.log.note("the user opens a picker", { state: controller.state(), commands: opened });

    expectClaim(controller.state().open === true && opened.length > 0, {
      claimIds: ["LIF-002"],
      what: "the picker did not open, so nothing below is about an open overlay",
      detail: JSON.stringify({ state: controller.state(), opened }),
    });

    // The form disables the field while they are in it.
    const disabled = controller.dispatch({ type: "disable", disabled: true });
    ctx.log.note("the form disables the field with the picker open", {
      state: controller.state(),
      commands: disabled,
    });

    expectEqual(controller.state().disabled, true, {
      claimIds: ["LIF-002"],
      what: "the field did not take the disabled state",
    });

    // The outcome, whichever route reached it: nothing is open over a control that no longer
    // responds. Disabling may have closed it, or the close below may have — both are fixes and the
    // user cannot tell them apart.
    const closed = controller.dispatch({ type: "close", restoreFocus: true });
    ctx.log.note("the user presses Escape after the field was disabled", {
      state: controller.state(),
      commands: closed,
    });

    expectEqual(controller.state().open, false, {
      claimIds: ["LIF-002"],
      what: "an overlay is still open over a field that no longer takes input",
      detail: JSON.stringify({ state: controller.state(), closed }),
    });

    // And the same widget re-enabled and driven again: a controller that reached the right state by
    // losing track of its own would pass the assertion above and fail here.
    controller.dispatch({ type: "disable", disabled: false });
    const reopened = controller.dispatch({ type: "open" });
    ctx.log.note("the field is enabled again and the user reopens it", {
      state: controller.state(),
      commands: reopened,
    });

    expectClaim(controller.state().open === true && reopened.length > 0, {
      claimIds: ["LIF-002"],
      what: "a widget that was disabled while open cannot be opened again after it is enabled",
      detail: JSON.stringify({ state: controller.state(), reopened }),
    });
  },
);

battle(
  {
    claims: ["LIF-002"],
    title: "disabling a field does not leave its overlay behind",
    environments: ["node"],
  },
  async (ctx) => {
    // The other way the same end state could be avoided, and the one that needs no new intent: if
    // disabling closed the overlay itself, the guard on `close` would cost nothing. Asserted
    // separately so a fix can take either route and only one battle has to change.
    const controller = createCatalogWidgetController("select");
    controller.dispatch({ type: "open" });
    const commands = controller.dispatch({ type: "disable", disabled: true });
    ctx.log.note("what disabling emits while the overlay is open", {
      state: controller.state(),
      commands,
    });

    expectClaim(controller.state().open === false || commands.some((each) => each.type === "close-overlay"), {
      claimIds: ["LIF-002"],
      what: "disabling a field with its overlay open neither closed it nor asked the renderer to",
      detail: JSON.stringify({ state: controller.state(), commands }),
    });

    // The control: disabling a closed widget is quiet, so the assertion above is about the open
    // case rather than demanding a command on every disable.
    const quiet = createCatalogWidgetController("select");
    expectEqual(quiet.dispatch({ type: "disable", disabled: true }), [], {
      claimIds: ["LIF-002"],
      what: "disabling a widget that has nothing open emitted a command anyway",
    });
  },
);

battle(
  {
    claims: ["LIF-001"],
    title: "a destroyed controller does not tell a renderer to touch what it tore down",
    environments: ["node"],
  },
  async (ctx) => {
    const controller = createCatalogWidgetController("select");
    controller.dispatch({ type: "open" });
    controller.destroy();

    // Reading is allowed after destroy — that is the engine's rule and it is what lets a renderer
    // finish its own teardown. Acting is not: a command handed out here names parts of a widget
    // that may no longer be in the document.
    const after = controller.dispatch({ type: "close", restoreFocus: true });
    ctx.log.note("what a destroyed controller does when dispatched", {
      state: controller.state(),
      commands: after,
    });

    expectEqual(after, [], {
      claimIds: ["LIF-001"],
      what: "a destroyed controller emitted commands naming parts a renderer may already have removed",
      detail: JSON.stringify(after),
    });
  },
);
