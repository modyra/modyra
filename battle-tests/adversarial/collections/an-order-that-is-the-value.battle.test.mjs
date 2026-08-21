/**
 * The order a multiselect holds its choices in, and whether anything can change it.
 *
 * The decision on this control was taken directly: **the order is the value.** A list of chosen things
 * is not a set — a person putting three ingredients in a recipe, three stops on a route or three
 * columns in a report means the order they put them in, and a control that quietly sorts them by the
 * option list has thrown away half of what they said.
 *
 * Half of that is already true and **nothing says so**:
 *
 *     choose c, a, b        → ["c","a","b"]
 *     remove a, add it back → ["c","b","a"]
 *
 * The controller keeps arrival order and moves a re-added value to the end. That is the right
 * behaviour, it is undeclared, and no test holds it — so the next person tidying this code has every
 * reason to sort the array and nothing to tell them not to. This battle's first half exists to be that
 * something: what works today and is asserted nowhere is what stops working quietly.
 *
 * The other half is missing. **There is no way to move a chosen thing except to remove it and add it
 * again**, which only ever puts it last, and doing it through the option list means finding the option
 * among all the others rather than touching the chip that is already in front of you. `reorderable` and
 * an intent that moves one selection are what the decision needs to become usable.
 *
 * Stated as *by intent* rather than as a drag: a keyboard has to be able to do it, and a control whose
 * only way to reorder is a pointer has the shape this batch spent the night removing from the dial.
 *
 * Green when a person can say which order they meant, and the control keeps it.
 */

import { createForm, field } from "@modyra/core";
import { createMultiselectFieldController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

/** A multiselect over its own field, with nothing chosen. */
function control() {
  const form = createForm({ m: field([]) }, { devWarnings: false });
  const controller = createMultiselectFieldController({ widgetId: "m", handle: form.f.m, options: OPTIONS });
  return { controller, value: () => form.f.m.value() };
}

battle(
  {
    claims: ["UI-011", "API-001"],
    title: "the order a person chose in is the order the form holds",
    environments: ["node"],
  },
  async (ctx) => {
    // The half that already works, pinned. Chosen out of the option list's own order on purpose: a
    // control that sorted by the options would answer ["a","b","c"] and look tidy doing it.
    const arrival = control();
    for (const key of ["c", "a", "b"]) arrival.controller.dispatch({ type: "toggle", optionKey: key });
    expectEqual(arrival.value(), ["c", "a", "b"], {
      claimIds: ["UI-011"],
      what: "the form holds the choices in the option list's order rather than the order they were chosen in, so half of what the person said is gone",
    });

    // And a re-added value goes last rather than back where it was, which is the same rule read from
    // the other end: arrival order, not membership.
    arrival.controller.dispatch({ type: "toggle", optionKey: "a" });
    arrival.controller.dispatch({ type: "toggle", optionKey: "a" });
    expectEqual(arrival.value(), ["c", "b", "a"], {
      claimIds: ["UI-011"],
      what: "a choice taken back and made again did not return to the end, so the order is membership rather than arrival",
    });

    ctx.log.note("what the control holds", {
      afterChoosingCAB: ["c", "a", "b"],
      afterRemovingAndReAddingA: arrival.value(),
      intents: "toggle increment decrement search open close toggleOpen clear focus blur",
    });

    // The half that is missing. Asked of the dispatcher rather than of a type, so any name for the
    // intent satisfies it as long as one exists and moves a selection.
    const moving = control();
    for (const key of ["a", "b", "c"]) moving.controller.dispatch({ type: "toggle", optionKey: key });

    let moved = false;
    for (const intent of [
      { type: "move-selected", optionKey: "c", to: 0 },
      { type: "move", optionKey: "c", to: 0 },
      { type: "reorder", optionKey: "c", to: 0 },
    ]) {
      try {
        moving.controller.dispatch(intent);
      } catch {
        continue;
      }
      if (JSON.stringify(moving.value()) === JSON.stringify(["c", "a", "b"])) { moved = true; break; }
    }

    expectClaim(moved, {
      claimIds: ["UI-011", "API-001"],
      what: "nothing moves a chosen thing without removing it, so the only way to reorder is to take a value back and add it again — which can only ever put it last, and only from the option list rather than from the chip already in front of the person",
      detail: `after choosing a, b, c the value is ${JSON.stringify(moving.value())} and no move intent was accepted`,
    });
  },
);
