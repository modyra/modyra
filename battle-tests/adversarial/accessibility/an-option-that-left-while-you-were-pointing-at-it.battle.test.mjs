/**
 * The list changed under the reading position.
 *
 * `setOptions` is the published route for changing what a select offers, and it is the same route in
 * all five adapters — none of them syncs a new list any other way. The reason to call it is almost
 * always the same one: the options arrived from somewhere, after the widget was on the page.
 *
 * The controller records the new list. Nobody is told. `subscribeController` is what every adapter
 * re-renders on, and `dispatch` and `setValue` both fire it; `setOptions` alone does not. So the
 * screen keeps the old list until the user does something else, and `view()` keeps describing it.
 *
 * The accessible consequence is the sharper half of that. Open the list, move to the last option,
 * and let a shorter list arrive: `aria-activedescendant` still names the option that left. A screen
 * reader is being pointed at an element that is not in the document — A11Y-001's case exactly, and
 * it does not resolve on settling, because settling is what never happens.
 *
 * Measurement note kept because it changes what the numbers mean: each measurement builds its own
 * controller. Sharing one lets a notification from an earlier `dispatch` land inside a later window
 * and be counted as that call's — which is what a first pass here measured, and it read as
 * `setOptions` notifying sometimes. It never does.
 */

import { createSelectController, subscribeController } from "@modyra/widgets";
import { vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A list of `size` options, each naming itself. */
const list = (size) =>
  Array.from({ length: size }, (_, index) => ({ value: `v${index}`, label: `L${index}` }));

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));

/**
 * Do one thing to a fresh controller and report what its subscribers heard.
 *
 * Fresh per measurement: a controller carried between them lets an earlier notification arrive
 * inside this window and be read as this call's.
 */
async function whatSubscribersHeard(act) {
  const reactivity = vanillaReactivity();
  const controller = createSelectController({ widgetId: "s", options: list(3) }, reactivity);
  let heard = 0;
  subscribeController(controller, reactivity, () => { heard += 1; });
  await settled();

  const before = heard;
  act(controller);
  await settled();
  return {
    notifications: heard - before,
    activeDescendant: controller.view().root.attributes["aria-activedescendant"] ?? null,
    options: controller.state().options?.length ?? null,
  };
}

battle(
  {
    claims: ["API-001"],
    title: "changing what a select offers reaches whoever is drawing it",
    environments: ["node"],
  },
  async (ctx) => {
    // The controls: the two other published mutators do tell their subscribers, so a silent one
    // below is that call rather than a subscription that was never live.
    const opened = await whatSubscribersHeard((controller) =>
      controller.dispatch({ type: "open", source: "keyboard" }));
    const valued = await whatSubscribersHeard((controller) => controller.setValue("v1"));
    ctx.log.note("what the other mutators do", { opened, valued });

    expectClaim(opened.notifications > 0, {
      claimIds: ["API-001"],
      what: "opening the list told nobody, so this battle's subscription is not live",
      detail: JSON.stringify(opened),
    });

    expectClaim(valued.notifications > 0, {
      claimIds: ["API-001"],
      what: "setting the value told nobody, so this battle's subscription is not live",
      detail: JSON.stringify(valued),
    });

    // And the one that is the only way to change the list at all.
    for (const size of [1, 0, 5]) {
      const changed = await whatSubscribersHeard((controller) => controller.setOptions(list(size)));
      ctx.log.note("a new list of options arrived", { size, ...changed });

      // The premise: the controller did take the list. What is at issue is who was told.
      expectEqual(changed.options, size, {
        claimIds: ["API-001"],
        what: `setOptions did not record a list of ${size}, so there was nothing to announce`,
      });

      expectClaim(changed.notifications > 0, {
        claimIds: ["API-001"],
        what: `a new list of ${size} option(s) reached the controller and no subscriber was told, so nothing redraws`,
        detail: JSON.stringify(changed),
      });
    }
  },
);

battle(
  {
    claims: ["A11Y-001"],
    title: "the option being pointed at is one the list still has",
    environments: ["node"],
  },
  async (ctx) => {
    const reactivity = vanillaReactivity();
    const controller = createSelectController({ widgetId: "s", options: list(3) }, reactivity);
    const active = () => controller.view().root.attributes["aria-activedescendant"] ?? null;
    const held = () => (controller.state().options ?? []).map((option) => `s__option__${option.value}`);

    controller.dispatch({ type: "open", source: "keyboard" });
    controller.dispatch({ type: "move", target: "last" });
    await settled();
    ctx.log.note("open, at the last option", { active: active(), held: held() });

    // The control: while nothing has changed, the pointer names an option that is there. So a
    // dangling one below is the change rather than an id that never matched.
    expectClaim(active() !== null && held().includes(active()), {
      claimIds: ["A11Y-001"],
      what: "the active option was not one of the offered ones before anything changed",
      detail: JSON.stringify({ active: active(), held: held() }),
    });

    // A shorter list arrives, without the option being pointed at.
    controller.setOptions(list(1));
    await settled();
    ctx.log.note("a shorter list arrived", { active: active(), held: held() });

    // Either it points at something the list still has, or it points at nothing. Naming an element
    // that is not in the document is what a screen reader cannot recover from.
    expectClaim(active() === null || held().includes(active()), {
      claimIds: ["A11Y-001"],
      what: "the active option is one the list no longer offers, so aria-activedescendant names an element that is not there",
      detail: JSON.stringify({ active: active(), held: held() }),
    });
  },
);
