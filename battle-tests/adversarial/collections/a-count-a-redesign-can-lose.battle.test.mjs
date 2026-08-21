/**
 * What a multiselect can already do, pinned before its anatomy is rebuilt.
 *
 * The control is being redesigned: the option list leaves the closed field, the chips strip becomes
 * what is chosen, `searchButton` retires and a `trigger` takes its place. That is the right shape and
 * it is also the moment a capability disappears without anybody deciding to remove it — the parts get
 * rebuilt around the new picture, and whatever the picture did not include is simply not there.
 *
 * The one most at risk is **quantities**. This multiselect does not only hold membership:
 *
 *     toggle a, increment ×2  →  ["a","a","a"]
 *     decrement               →  ["a","a"]
 *
 * The value carries repeats, and the contract has the parts to show them — `optionStep` and
 * `optionCount` — beside the intents that move them. A chips strip built as *one chip per chosen
 * value* answers the same for `["a"]` and `["a","a","a"]`, so a person who asked for three of something
 * would see one and nothing would report a defect.
 *
 * None of this is a new rule. It is what the control does today, written down while it still does it,
 * because a capability with no test is a capability the next redesign is entitled to drop.
 *
 * Green today. Its whole job is to go red on a day nobody expected it to.
 */

import { createForm, field } from "@modyra/core";
import { createMultiselectFieldController } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

function control(initial = []) {
  const form = createForm({ m: field(initial) }, { devWarnings: false });
  const controller = createMultiselectFieldController({ widgetId: "m", handle: form.f.m, options: OPTIONS });
  return { controller, value: () => form.f.m.value() };
}

battle(
  {
    claims: ["UI-011", "API-001"],
    title: "a multiselect keeps the counts and the clearing it already had",
    environments: ["node"],
  },
  async (ctx) => {
    // Quantities. The value repeats a key rather than carrying a number beside it, which is why a strip
    // showing distinct values loses this silently: `["a"]` and `["a","a","a"]` render identically.
    const counted = control();
    counted.controller.dispatch({ type: "toggle", optionKey: "a" });
    counted.controller.dispatch({ type: "increment", optionKey: "a" });
    counted.controller.dispatch({ type: "increment", optionKey: "a" });
    expectEqual(counted.value(), ["a", "a", "a"], {
      claimIds: ["UI-011"],
      what: "asking for three of one option no longer produces three, so a multiselect that could carry quantities now carries only membership",
    });

    counted.controller.dispatch({ type: "decrement", optionKey: "a" });
    expectEqual(counted.value(), ["a", "a"], {
      claimIds: ["UI-011"],
      what: "taking one back removed the option entirely rather than reducing the count",
    });

    // And down to nothing rather than to a stuck one, which is the boundary a `count > 0` guard gets
    // wrong — the same shape as the pointer-at-the-centre defect on the dial.
    counted.controller.dispatch({ type: "decrement", optionKey: "a" });
    counted.controller.dispatch({ type: "decrement", optionKey: "a" });
    expectEqual(counted.value(), [], {
      claimIds: ["UI-011"],
      what: "decrementing past the last one left something behind, so a count cannot be taken back to none",
    });

    ctx.log.note("what the control does today", {
      quantities: "the value repeats a key",
      intents: "toggle increment decrement search open close clear focus blur",
      partsForCounts: "optionStep, optionCount",
    });

    // Clearing, which a redesign around chips is also entitled to forget: an X on each chip is not the
    // same affordance as emptying the field.
    const many = control(["a", "b"]);
    many.controller.dispatch({ type: "clear" });
    expectEqual(many.value(), [], {
      claimIds: ["API-001"],
      what: "clearing a multiselect no longer empties it",
    });

    // Searching narrows what is offered and must not touch what was chosen — the two live in different
    // places and a strip that reads the filtered list would empty itself as somebody typed.
    const searching = control(["a"]);
    searching.controller.dispatch({ type: "open" });
    searching.controller.dispatch({ type: "search", query: "zzz" });
    expectEqual(searching.value(), ["a"], {
      claimIds: ["UI-011"],
      what: "typing a search that matches nothing changed what was already chosen",
    });
  },
);
