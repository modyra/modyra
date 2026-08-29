/**
 * A root's state classes are the ones the contract names for that root, and no others.
 *
 * Six kinds publish a classifier that turns a field's state into the classes its root wears, and
 * `partStates` publishes which states that root carries. A stylesheet is written against the second
 * list; a renderer draws the first. A class in one and not the other is a rule nobody wrote or a rule
 * that stopped applying, and neither shows up as a failure anywhere — the page simply loses a state.
 *
 * Both directions, because they fail differently:
 *
 *   emitted, undeclared   a class a stylesheet has no rule for. The state is on the page and invisible.
 *   declared, unemitted   a rule that can never match. The stylesheet keeps it forever and nobody
 *                         can tell it apart from one that matches rarely.
 *
 * The state a classifier is handed carries every flag at once, so a classifier that reads a flag this
 * check does not know about still has it set — an unemitted class then means the classifier cannot
 * emit it, not that the input failed to ask for it.
 *
 * Claims under attack: UI-009.
 */
import {
  applyOverlayProperties, booleanFieldRootClasses, chipDropIndex, datepickerFieldRootClasses,
  multiselectFieldRootClasses, optionFieldRootClasses, partStates, textFieldRootClasses,
  timepickerFieldRootClasses,
} from "@modyra/widgets";
import { MDY_ADAPTER_CONTRACT_VIOLATION, MDY_UNSUPPORTED_ADAPTER_OPTION } from "@modyra/core";

import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { battle } from "../../harness/battle.mjs";

/** The classifier each kind publishes, and the kind whose root vocabulary it answers for. */
const CLASSIFIERS = [
  { kind: "text", of: textFieldRootClasses },
  { kind: "checkbox", of: booleanFieldRootClasses },
  { kind: "select", of: optionFieldRootClasses },
  { kind: "datepicker", of: datepickerFieldRootClasses },
  { kind: "timepicker", of: timepickerFieldRootClasses },
  { kind: "multiselect", of: multiselectFieldRootClasses },
];

/** Every flag a field state can carry, all true at once, so nothing is unemitted for want of asking. */
const EVERYTHING = {
  value: "x", draft: "x", touched: true, dirty: true, disabled: true, readonly: true, required: true,
  invalid: true, pending: true, loading: true, open: true, focused: true, expanded: true,
  errors: [{ message: "no" }], selected: ["a"], options: [{ value: "a", label: "A" }],
};

const NOTHING = Object.fromEntries(Object.entries(EVERYTHING).map(([key, value]) =>
  [key, Array.isArray(value) ? [] : typeof value === "boolean" ? false : ""]));

battle(
  {
    claims: ["UI-009"],
    title: "a class outside the vocabulary",
    environments: ["node"],
  },
  async (ctx) => {
    const undeclared = [];
    const unemitted = [];

    for (const { kind, of } of CLASSIFIERS) {
      const declared = partStates(kind, "root");
      const allowed = new Set(["mdy-renderer", ...declared.map((state) => `mdy-renderer--${state}`)]);

      const everything = [...of(EVERYTHING)];
      const nothing = [...of(NOTHING)];
      ctx.log.note(`what ${kind}'s root wears with every flag set`, { emitted: everything, declared });

      for (const one of everything) {
        if (!allowed.has(one)) undeclared.push(`${kind} emits ${one}, and the root declares ${declared.join(" ")}`);
      }
      for (const state of declared) {
        if (!everything.includes(`mdy-renderer--${state}`)) {
          unemitted.push(`${kind} declares ${state} on its root and no state produces mdy-renderer--${state}`);
        }
      }
      // The base class is what every rule hangs off: a classifier that drops it in a state leaves the
      // root outside its own stylesheet rather than merely unstyled for that state.
      expectClaim(nothing.includes("mdy-renderer"), {
        claimIds: ["UI-009"],
        what: `${kind}'s classifier answers a resting field without the class every rule is written against`,
      });
    }

    expectEqual(undeclared, [], {
      claimIds: ["UI-009"],
      what: `${undeclared.length} class(es) reach a root that its own vocabulary does not name:\n${undeclared.join("\n")}`,
    });
    expectEqual(unemitted, [], {
      claimIds: ["UI-009"],
      what: `${unemitted.length} state(s) are declared on a root and no classifier can produce them:\n${unemitted.join("\n")}`,
    });

    // A door that acts rather than answers, and its promise is the half that writes nothing: writing
    // a custom property that is already there invalidates style on the element and everything
    // inheriting from it, which for a popup holding a calendar is its whole subtree, every pass.
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!doctype html><div id=panel></div>", { url: "http://localhost/" });
    const panel = dom.window.document.getElementById("panel");
    const writes = [];
    const setProperty = panel.style.setProperty.bind(panel.style);
    panel.style.setProperty = (name, value) => { writes.push(`${name}=${value}`); setProperty(name, value); };

    applyOverlayProperties(panel, { "--mdy-anchor-width": "120px" });
    expectEqual(writes, ["--mdy-anchor-width=120px"], {
      claimIds: ["UI-009"],
      what: "applying an overlay property wrote something other than the property it was handed",
    });

    applyOverlayProperties(panel, { "--mdy-anchor-width": "120px" });
    expectEqual(writes, ["--mdy-anchor-width=120px"], {
      claimIds: ["UI-009"],
      what: "the same property written twice reached the element twice, so a repaint pays for a value that did not change",
    });

    ctx.log.note("a custom property written, written again unchanged, then changed", { writes });
    applyOverlayProperties(panel, { "--mdy-anchor-width": "140px" });
    expectEqual(writes, ["--mdy-anchor-width=120px", "--mdy-anchor-width=140px"], {
      claimIds: ["UI-009"],
      what: "a property whose value changed did not reach the element, so the panel keeps the width it had",
    });

    // A drop follows what the eye does: past the midpoint of the second chip is the third position.
    const past = chipDropIndex([10, 30, 50], 35, 0);
    const before = chipDropIndex([10, 30, 50], 5, 2);
    expectClaim(past > before, {
      claimIds: ["UI-009"],
      what: `a pointer past two midpoints answered ${past} and one past none answered ${before}, so the drop does not follow the pointer`,
    });

    // A diagnostic code is a string a consumer branches on, so it is worth exactly its spelling.
    expectEqual([MDY_ADAPTER_CONTRACT_VIOLATION, MDY_UNSUPPORTED_ADAPTER_OPTION],
      ["MDY_ADAPTER_CONTRACT_VIOLATION", "MDY_UNSUPPORTED_ADAPTER_OPTION"], {
        claimIds: ["UI-009"],
        what: "a diagnostic code is spelled differently from its own name, so a consumer branching on either misses it",
      });
  },
);
