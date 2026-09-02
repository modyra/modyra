/**
 * A checker reads one call shape and asks the manifest, instead of knowing every door by name.
 *
 * Each source-reading gate had learned the doors one at a time, and a door added later cost an edit
 * in every gate that had not learned it — until then the gate reported a renderer that asks the
 * contract as one that stopped drawing the part. Three gates, three spellings, and the fourth door
 * cost three more edits: the doors and the gates both grow, so the work is their product.
 *
 * What is asserted here is the property that makes the manifest worth having — every door either
 * answers from literal arguments, or says why it cannot — and the second half is the one that keeps
 * a gate honest, because a door with no resolver and no reason is a silence a gate would report as
 * an absence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MDY_CLASS_DOORS, partClasses, presentationClass } from "../dist/index.js";

test("every door either answers or says why it cannot", () => {
  for (const door of MDY_CLASS_DOORS) {
    const answers = typeof door.resolve === "function" || typeof door.resolveObject === "function";
    const explains = typeof door.unresolvable === "string" && door.unresolvable.length > 0;
    assert.ok(answers !== explains, `${door.name} must do exactly one of answering and explaining`);
  }
});

test("a door that takes an object declares a domain for every key it reads", () => {
  // A key with no declared domain cannot be expanded, so a reader has two choices and both are
  // wrong: guess a value the call site may never pass, or drop the call silently. Declaring the
  // domain beside the door is what leaves it neither.
  for (const door of MDY_CLASS_DOORS) {
    if (typeof door.resolveObject !== "function") continue;
    assert.ok(door.domains, `${door.name} takes an object and declares no domains`);
    for (const [key, values] of Object.entries(door.domains)) {
      assert.ok(Array.isArray(values) && values.length > 0, `${door.name}.${key} has an empty domain`);
    }
  }
});

test("an object door answers a call that fixes some keys with only what that call can emit", () => {
  // The rule the expansion turns on: a key the call omits keeps the signature's default, so a class
  // reachable only by passing that key must not appear. Expanding every key instead would claim a
  // class the element never carries, which is the same defect as missing one it does.
  const chip = MDY_CLASS_DOORS.find((d) => d.name === "multiselectChipClasses");
  const fixedRole = new Set([
    ...chip.resolveObject({ role: "value", mode: "single" }),
    ...chip.resolveObject({ role: "value", mode: "multi" }),
  ]);
  assert.ok(fixedRole.has("mdy-chip--value"), "a call naming the value role must produce its class");
  assert.ok(!fixedRole.has("mdy-chip--removable"), "a call that omits removable must not claim its class");
  assert.ok(!fixedRole.has("mdy-chip--selected"), "a call that omits selected must not claim its class");
});

test("a resolver answers what the contract itself answers", () => {
  // The manifest must not become a second copy of the catalogue: it routes to the same accessor a
  // renderer calls, so a class that moves moves in both at once.
  const part = MDY_CLASS_DOORS.find((d) => d.name === "partClasses");
  assert.deepEqual(part.resolve(["select", "trigger"]), partClasses("select", "trigger"));

  const pres = MDY_CLASS_DOORS.find((d) => d.name === "presentationClass");
  assert.deepEqual(pres.resolve(["select", "box"]), [presentationClass("select", "box")]);
});

test("arguments the contract cannot answer add no class, and do not throw", () => {
  // A gate reads whatever a source file contains, including a call that is wrong. It must come back
  // with nothing rather than an exception, or one bad call site would stop the whole audit.
  const part = MDY_CLASS_DOORS.find((d) => d.name === "partClasses");
  for (const args of [["nonesuch", "trigger"], ["select", "nonesuch"], [], ["select"]]) {
    assert.deepEqual(part.resolve(args), [], `${JSON.stringify(args)} produced something`);
  }
});

test("the doors a renderer actually calls are all declared", () => {
  // The list is the point of failure: a door that exists and is not here is invisible to every gate
  // at once, which is worse than the per-gate blindness it replaces.
  for (const name of ["partClasses", "presentationClass", "stateClass", "multiselectChipClasses"]) {
    assert.ok(MDY_CLASS_DOORS.some((d) => d.name === name), `${name} is not declared as a door`);
  }
});
