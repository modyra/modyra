/**
 * A key that works on one widget and does nothing on the one beside it.
 *
 * `widgetKeyIntent` is the canonical keyboard mapping, and its own contract says framework adapters
 * must not reinterpret it — so whatever it answers is what every adapter does, and a disagreement
 * here is a disagreement in every renderer at once. Its docblock records the defect it was written
 * to fix: one table for all seventeen kinds, so a text field claimed ArrowDown and a slider was told
 * to move through options it does not have.
 *
 * Per-kind bindings fixed that, and introduce the opposite risk. Six kinds open an overlay from a
 * trigger the user has focused. Four of them open on Space; two do not:
 *
 *     select, multiselect   Enter, Space, ArrowDown, ArrowUp
 *     daterange, colors     Enter, Space
 *     datepicker            Enter
 *     timepicker            Enter
 *
 * The arrow split is coherent — arrows navigate a list of options, and a calendar dialog has none to
 * navigate from a closed trigger. The Space split is not: `daterange` and `datepicker` are the same
 * control opening the same calendar, and a trigger that behaves as a button is expected to activate
 * on Space as well as Enter. A user who learned the gesture on one field finds it dead on the next,
 * with nothing on screen to explain why.
 *
 * The rest of the mapping agrees exactly, which is what makes this a gap rather than an area nobody
 * finished: all six cancel on Escape restoring focus, and all six cancel on Tab without restoring it
 * — focus is leaving on purpose, and pulling it back is the bug that would be.
 */

import { widgetKeyIntent } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Every kind whose trigger opens an overlay the user then operates. */
const OVERLAY_KINDS = Object.freeze(["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"]);

/** Which keys open `kind` from a closed, focused trigger. */
function opensOn(kind) {
  return ["Enter", " ", "ArrowDown", "ArrowUp"].filter(
    (key) => widgetKeyIntent(kind, key, false)?.type === "open",
  );
}

battle(
  {
    claims: ["UI-002"],
    title: "every trigger that opens on Enter also opens on Space",
    environments: ["node"],
  },
  async (ctx) => {
    for (const kind of OVERLAY_KINDS) {
      const keys = opensOn(kind);
      ctx.log.note("what opens a widget from its trigger", { kind, keys });

      // The control: the kind opens at all, so a failure below is the missing key rather than a
      // kind that has no overlay to open.
      expectClaim(keys.includes("Enter"), {
        claimIds: ["UI-002"],
        what: `${kind} owns an overlay and does not open on Enter`,
        detail: JSON.stringify(keys),
      });

      expectClaim(keys.includes(" "), {
        claimIds: ["UI-002"],
        what: `${kind} opens on Enter and does nothing on Space, which its neighbours accept`,
        detail: JSON.stringify(keys),
      });
    }
  },
);

battle(
  {
    claims: ["UI-002"],
    title: "leaving an overlay means the same thing everywhere",
    environments: ["node"],
  },
  async (ctx) => {
    // The half that agrees, pinned because it is what makes the disagreement above a gap rather
    // than an unfinished area — and because a fix in the wrong direction would be to make these
    // diverge too.
    for (const kind of OVERLAY_KINDS) {
      const escape = widgetKeyIntent(kind, "Escape", true);
      const tab = widgetKeyIntent(kind, "Tab", true);
      ctx.log.note("how a widget is left", { kind, escape, tab });

      // Escape is a refusal: the value goes back and focus returns to where the user was.
      expectEqual(escape, { type: "cancel", restoreFocus: true }, {
        claimIds: ["UI-002"],
        what: `${kind} does not cancel and restore focus on Escape`,
      });

      // Tab is a departure: the overlay closes and focus is left where the browser is taking it.
      // Pulling it back is the defect this pins against.
      expectEqual(tab, { type: "cancel", restoreFocus: false }, {
        claimIds: ["UI-002"],
        what: `${kind} does not release focus on Tab, which pulls the user back where they left`,
      });
    }

    // And the arrow split, which is coherent and pinned so it is not "fixed" into agreement: arrows
    // move through a list of options, and only two of these kinds have one at the trigger.
    const arrowOpeners = OVERLAY_KINDS.filter((kind) => opensOn(kind).includes("ArrowDown"));
    expectEqual(arrowOpeners, ["select", "multiselect"], {
      claimIds: ["UI-002"],
      what: "the kinds that open on an arrow are not the ones with a list of options behind the trigger",
      detail: JSON.stringify(arrowOpeners),
    });
  },
);

battle(
  {
    claims: ["UI-002"],
    title: "a kind is told to do only what it can do",
    environments: ["node"],
  },
  async (ctx) => {
    // The defect the per-kind table was written to fix, pinned so a return to one shared mapping
    // fails here rather than in a renderer.
    const cases = [
      { kind: "textarea", key: "Enter", why: "Enter inserts a newline in a textarea" },
      { kind: "text", key: "ArrowDown", why: "a text field has no list to move through" },
      { kind: "text", key: "ArrowUp", why: "a text field has no list to move through" },
      { kind: "file", key: "ArrowDown", why: "a file input has no list to move through" },
    ];

    for (const { kind, key, why } of cases) {
      ctx.log.note("a key a kind must not claim", {
        kind,
        key,
        closed: widgetKeyIntent(kind, key, false),
        open: widgetKeyIntent(kind, key, true),
      });
      for (const open of [false, true]) {
        expectEqual(widgetKeyIntent(kind, key, open), null, {
          claimIds: ["UI-002"],
          what: `${kind} claimed ${JSON.stringify(key)} — ${why}`,
        });
      }
    }

    // And the kinds whose arrows change a value rather than a position, which is the other half of
    // the same fix.
    for (const kind of ["number", "slider"]) {
      ctx.log.note("arrows on a kind whose value is a number", {
        kind,
        up: widgetKeyIntent(kind, "ArrowUp", false),
        down: widgetKeyIntent(kind, "ArrowDown", false),
      });
      expectEqual(
        [widgetKeyIntent(kind, "ArrowUp", false)?.type, widgetKeyIntent(kind, "ArrowDown", false)?.type],
        ["increment", "decrement"],
        {
          claimIds: ["UI-002"],
          what: `${kind} does not step its value with the arrow keys`,
        },
      );
    }

    // The control: Space toggles the kinds that are one binary control, so `null` above is a kind
    // declining a key rather than the mapping answering nothing for everything.
    for (const kind of ["checkbox", "toggle", "radio", "segmented"]) {
      ctx.log.note("Space on a kind that is one binary control", {
        kind,
        space: widgetKeyIntent(kind, " ", false),
      });
      expectEqual(widgetKeyIntent(kind, " ", false)?.type, "toggle", {
        claimIds: ["UI-002"],
        what: `${kind} does not toggle on Space`,
      });
    }
  },
);
