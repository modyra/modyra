/**
 * A combobox nobody is allowed to get stuck in.
 *
 * `selectKeyboardAction` is the whole keyboard behaviour of a select, as a pure function: the
 * renderers hand it a key and their state and do what it says. Nothing had ever run it, and it is
 * the surface where a mistake stops being cosmetic — a control that swallows `Tab` is a keyboard
 * trap, and a person who cannot leave it cannot use the rest of the page.
 *
 * The cases here are the ones where an implementation drifts:
 *
 *   - **`Tab` while open** closes the list and lets focus go where it was headed. Restoring focus
 *     instead would drag the user back to the control they just left; capturing it would trap them.
 *   - **an arrow on a closed list** opens it rather than moving an active option nobody can see.
 *   - **`Home` and `End` while the search has focus** do nothing, so the caret still jumps to the
 *     ends of what the user is typing. Taking them would make the text box unusable.
 *   - **a space while the search has focus** is a space, not a selection.
 *   - **an ordinary letter** is never claimed, in any state.
 *
 * One cell is measured and deliberately not asserted: with a new option on offer, `Enter` on a
 * *closed* list creates rather than opening, because the create branch is tested before the open
 * one. Whether a caller can report a new option while the list is shut is a question about the
 * callers rather than about this function, and asserting either answer here would be asserting a
 * guess.
 */

import { selectKeyboardAction } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const shut = Object.freeze({ open: false, searchFocused: false, activeKey: null, createAvailable: false });
const open = Object.freeze({ open: true, searchFocused: false, activeKey: "k1", createAvailable: false });
const typing = Object.freeze({ open: true, searchFocused: true, activeKey: "k1", createAvailable: false });

battle(
  {
    claims: ["A11Y-002", "UI-001"],
    title: "a select never keeps the key that would take a user out of it",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [where, state] of [["with the list open", open], ["while typing in the search", typing]]) {
      const action = selectKeyboardAction({ key: "Tab", ...state });
      ctx.log.note("Tab", { where, action });

      // Closing is right and restoring focus is not: the user pressed Tab to leave.
      expectEqual(action, { type: "close", restoreFocus: false }, {
        claimIds: ["A11Y-002"],
        what: `Tab ${where} did not close the list and let focus move on`,
      });
    }

    // And with the list shut there is nothing to do, so Tab is not claimed at all.
    expectEqual(selectKeyboardAction({ key: "Tab", ...shut }), null, {
      claimIds: ["A11Y-002"],
      what: "Tab was claimed by a select whose list is not even open",
    });

    // Escape closes and brings focus back, which is the opposite of Tab and the reason they are two
    // cases rather than one.
    expectEqual(selectKeyboardAction({ key: "Escape", ...open }), { type: "close", restoreFocus: true }, {
      claimIds: ["A11Y-002"],
      what: "Escape did not close the list and return focus to the control",
    });

    expectEqual(selectKeyboardAction({ key: "Escape", ...shut }), null, {
      claimIds: ["A11Y-002"],
      what: "Escape was claimed by a select with nothing open to close",
    });
  },
);

battle(
  {
    claims: ["A11Y-002", "UI-001"],
    title: "the keys that belong to the text a user is typing stay with it",
    environments: ["node"],
  },
  async (ctx) => {
    // Home and End move a caret. Taking them for the list would leave a search box a user cannot
    // move around in — and they are only taken when the search does not have focus.
    for (const key of ["Home", "End"]) {
      expectEqual(selectKeyboardAction({ key, ...typing }), null, {
        claimIds: ["A11Y-002"],
        what: `${key} was taken from the search box the user is typing in`,
      });

      const claimed = selectKeyboardAction({ key, ...open });
      ctx.log.note("a jump key with the list focused", { key, claimed });
      expectClaim(claimed?.type === "move", {
        claimIds: ["UI-001"],
        what: `${key} does nothing when the list itself has focus, so the ends are unreachable`,
        detail: JSON.stringify(claimed),
      });
    }

    // A space is a space while typing, and a selection when the list has focus.
    expectEqual(selectKeyboardAction({ key: " ", ...typing }), null, {
      claimIds: ["A11Y-002"],
      what: "a space typed into the search selected an option instead of being typed",
    });

    expectEqual(selectKeyboardAction({ key: " ", ...open }), { type: "select", optionKey: "k1" }, {
      claimIds: ["UI-001"],
      what: "a space with the list focused did not choose the active option",
    });

    // Ordinary letters are never claimed: they belong to the search, or to whatever the host does
    // with typeahead.
    for (const key of ["a", "Z", "1", "PageDown", "F1"]) {
      for (const [where, state] of [["closed", shut], ["open", open], ["typing", typing]]) {
        expectEqual(selectKeyboardAction({ key, ...state }), null, {
          claimIds: ["A11Y-002"],
          what: `${JSON.stringify(key)} was claimed by the select while ${where}`,
        });
      }
    }
  },
);

battle(
  {
    claims: ["UI-001", "A11Y-002"],
    title: "an arrow on a closed list opens it instead of moving what nobody can see",
    environments: ["node"],
  },
  async (ctx) => {
    for (const key of ["ArrowDown", "ArrowUp"]) {
      const opened = selectKeyboardAction({ key, ...shut });
      ctx.log.note("an arrow on a closed list", { key, opened });

      expectEqual(opened, { type: "open" }, {
        claimIds: ["UI-001"],
        what: `${key} on a closed list did something other than open it`,
      });

      // Opening does not also move: the list opens with nothing active and the next press lands
      // where the direction says.
      expectEqual(selectKeyboardAction({ key, ...open }), { type: "move", target: key === "ArrowDown" ? "next" : "previous" }, {
        claimIds: ["UI-001"],
        what: `${key} on an open list did not move the active option`,
      });

      // Arrows keep working while the search has focus, which is what makes a combobox one control
      // rather than two.
      expectClaim(selectKeyboardAction({ key, ...typing })?.type === "move", {
        claimIds: ["A11Y-002"],
        what: `${key} stopped moving through the list while the user was typing`,
      });
    }

    // Enter opens a closed list and chooses from an open one.
    expectEqual(selectKeyboardAction({ key: "Enter", ...shut }), { type: "open" }, {
      claimIds: ["UI-001"],
      what: "Enter on a closed list did not open it",
    });

    expectEqual(selectKeyboardAction({ key: "Enter", ...open }), { type: "select", optionKey: "k1" }, {
      claimIds: ["UI-001"],
      what: "Enter on an open list did not choose the active option",
    });

    // With nothing active there is nothing to choose, and inventing one would select whatever the
    // list happened to render first.
    expectEqual(selectKeyboardAction({ key: "Enter", open: true, searchFocused: false, activeKey: null, createAvailable: false }), null, {
      claimIds: ["UI-001"],
      what: "Enter chose an option when none was active",
    });
  },
);
