/**
 * Two published ways to move through a list, and the difference that has to survive.
 *
 * `MDY_WIDGET_KEYBOARD` says the same thing for both families: ArrowUp, ArrowDown, Home and End
 * `move`. What moving means is not the same, and the widgets publish two functions rather than one.
 *
 * A listbox does **not** wrap: ArrowDown on the last option stays on the last option. A radio or
 * segmented group **does**: ArrowRight on the last lands on the first. That is not a preference —
 * it is what the two ARIA patterns require, and getting it backwards is the kind of thing that
 * passes every screenshot. A radio group that stops at the end makes the last option unreachable
 * from the first without going back; a listbox that wraps takes the user somewhere they did not ask
 * to go, on a key they pressed to go the other way.
 *
 * Neither function was named by anything in this suite, and the keyboard table cannot state the
 * difference — it has one intent for both. So it is pinned here, from the functions themselves.
 */

import { listboxNextIndex, optionNavigationIndex } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Three options, which is enough for a first, a middle and a last. */
const COUNT = 3;

battle(
  {
    claims: ["UI-002", "A11Y-002"],
    title: "a listbox stops at its ends and an option group comes round",
    environments: ["node"],
  },
  async (ctx) => {
    // A listbox: the end is the end.
    const listbox = Object.fromEntries(["ArrowDown", "ArrowUp", "Home", "End"].map((key) => [
      key,
      [0, 1, 2].map((from) => listboxNextIndex(key, from, COUNT)),
    ]));
    ctx.log.note("moving through a listbox", listbox);

    expectEqual(listbox, {
      ArrowDown: [1, 2, 2],
      ArrowUp: [0, 0, 1],
      Home: [0, 0, 0],
      End: [2, 2, 2],
    }, {
      claimIds: ["UI-002"],
      what: "a listbox no longer stops at its ends, so ArrowDown on the last option takes the user elsewhere",
    });

    // And the one case where a listbox does move to the far end: nothing is active yet, and the
    // user asks for the previous option.
    expectEqual(listboxNextIndex("ArrowUp", -1, COUNT), COUNT - 1, {
      claimIds: ["UI-002"],
      what: "ArrowUp with nothing active did not open at the last option",
    });

    // An option group: past the end is the beginning.
    const group = Object.fromEntries(["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].map((key) => [
      key,
      [0, 1, 2].map((from) => optionNavigationIndex(key, from, COUNT)),
    ]));
    ctx.log.note("moving through an option group", group);

    expectEqual(group, {
      ArrowDown: [1, 2, 0],
      ArrowRight: [1, 2, 0],
      ArrowUp: [2, 0, 1],
      ArrowLeft: [2, 0, 1],
      Home: [0, 0, 0],
      End: [2, 2, 2],
    }, {
      claimIds: ["UI-002"],
      what: "an option group no longer comes round, so its last option is a dead end",
    });

    // The difference itself, stated once: the same key on the same option answers differently, and
    // a renderer reaching for the wrong helper is what this exists to catch.
    expectClaim(listboxNextIndex("ArrowDown", COUNT - 1, COUNT) !== optionNavigationIndex("ArrowDown", COUNT - 1, COUNT), {
      claimIds: ["UI-002", "A11Y-002"],
      what: "the two families now move alike, so one of the two ARIA patterns is not being followed",
      detail: JSON.stringify({
        listbox: listboxNextIndex("ArrowDown", COUNT - 1, COUNT),
        group: optionNavigationIndex("ArrowDown", COUNT - 1, COUNT),
      }),
    });
  },
);

battle(
  {
    claims: ["UI-002"],
    title: "a key neither family moves on, and a list with nothing in it",
    environments: ["node"],
  },
  async (ctx) => {
    // A key that is not a movement is answered as one rather than guessed at. Returning an index
    // here would move the active option on Enter.
    for (const key of ["Enter", " ", "PageDown", "Escape", "a"]) {
      expectEqual([listboxNextIndex(key, 0, COUNT), optionNavigationIndex(key, 0, COUNT)], [null, null], {
        claimIds: ["UI-002"],
        what: `${JSON.stringify(key)} was read as a movement key by one of the two families`,
      });
    }

    // An empty list has no option to move to, in either family — the case a filtered listbox reaches
    // when nothing matches what was typed.
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expectEqual([listboxNextIndex(key, 0, 0), optionNavigationIndex(key, 0, 0)], [null, null], {
        claimIds: ["UI-002"],
        what: `${key} on an empty list answered with an index`,
      });
    }

    // A list of one: every movement stays on it, in both families.
    ctx.log.note("a list with one option", {
      listbox: ["ArrowDown", "ArrowUp"].map((key) => listboxNextIndex(key, 0, 1)),
      group: ["ArrowDown", "ArrowUp"].map((key) => optionNavigationIndex(key, 0, 1)),
    });

    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expectEqual([listboxNextIndex(key, 0, 1), optionNavigationIndex(key, 0, 1)], [0, 0], {
        claimIds: ["UI-002"],
        what: `${key} moved off the only option there is`,
      });
    }
  },
);
