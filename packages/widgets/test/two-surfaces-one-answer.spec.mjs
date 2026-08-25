/**
 * The record and its accessor answer the same question the same way.
 *
 * Both are published. `MDY_WIDGET_CONTRACTS` is what a reader inside the library reaches for;
 * `partClasses` is what a consumer calls and what an audit runs against. When they disagree about a
 * part, nobody is misreading — the two answers are simply both available, and which one is right
 * depends on where you are standing. That is worse than an error, because a review of either side
 * alone finds nothing.
 *
 * It happened: `partClasses("text", "control")` returned the class of the control's **container**,
 * because the accessor fell back to the shell's whole vocabulary by name, and the shell uses the word
 * `control` for the box while a contract uses it for the control. Five parts, and a selector built
 * from the accessor reached an element the contract never named.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  partClasses,
} from "../dist/index.js";

test("every part reads the same from the record and from the accessor", () => {
  const differing = [];
  for (const kind of MDY_WIDGET_KINDS) {
    for (const part of Object.keys(MDY_WIDGET_CONTRACTS[kind].parts)) {
      const recorded = MDY_WIDGET_CONTRACTS[kind].parts[part].classes;
      const resolved = partClasses(kind, part);
      if (JSON.stringify(recorded) !== JSON.stringify(resolved)) {
        differing.push(`${kind}.${part}: record ${JSON.stringify(recorded)} vs accessor ${JSON.stringify(resolved)}`);
      }
    }
  }
  assert.deepEqual(differing, [], "two published surfaces disagreeing about one part is a defect no review of either side finds");
});

test("a part with no class of its own is given none", () => {
  // The five kinds whose control is a bare `<input>`: the element carries the state attributes and
  // the theme paints the box around it, so the control itself has no class — and an accessor that
  // invents one hands a caller a selector that finds the box instead.
  for (const kind of ["text", "email", "password", "textarea", "number"]) {
    assert.deepEqual(partClasses(kind, "control"), [], `${kind}.control should carry no class of its own`);
  }
});

test("a part with a class of its own still gets it", () => {
  // The guard against fixing the above by returning nothing for everything.
  assert.deepEqual(partClasses("checkbox", "control"), ["mdy-checkbox__control"]);
  assert.deepEqual(partClasses("text", "label"), ["mdy-label"]);
  assert.deepEqual(partClasses("text", "inputWrapper"), ["mdy-input-wrapper"]);
});
