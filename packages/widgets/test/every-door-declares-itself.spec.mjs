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
import { MDY_CLASS_DOORS, answerDoor, partClasses, presentationClass } from "../dist/index.js";

/** A question each door can answer, so a door shown empty is empty for a reason. */
const SAMPLE = {
  partClasses: ["select", "trigger"],
  presentationClass: ["select", "box"],
  popupPlacementClass: ["select", "above"],
  popupAlignmentClass: ["select", "right"],
  multiselectChipClasses: { role: "value" },
  contractParts: ["select", "trigger"],
  stateClass: [],
  partStateClass: [],
};

test("every door either answers or says why it cannot", () => {
  for (const door of MDY_CLASS_DOORS) {
    const answers = typeof door.resolve === "function"
      || typeof door.resolveObject === "function"
      || typeof door.resolvePath === "function";
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

test("a door read as a path declares both of its ends and the way to answer them", () => {
  // Half of this pair is worse than neither: a path with no resolver is a door a reader recognises
  // and cannot answer, and a resolver with no path is a function nothing ever reaches. Both fail
  // silently, by producing no classes, which is indistinguishable from a renderer that draws nothing.
  for (const door of MDY_CLASS_DOORS) {
    if (door.readPath === undefined && door.resolvePath === undefined) continue;
    assert.ok(door.readPath, `${door.name} resolves a path and declares none`);
    assert.ok(typeof door.resolvePath === "function", `${door.name} declares a path and cannot answer it`);
    assert.ok(door.readPath.root && door.readPath.leaf, `${door.name} declares a path missing an end`);
  }
});

test("every door can be asked through one reader, whatever its shape", () => {
  // The failure this closes: a caller that switched on which resolver a door carries threw on the
  // first door of a shape it had not learnt, and took a whole page down with it. A reader that
  // cannot be taught a new shape must at least survive one.
  for (const door of MDY_CLASS_DOORS) {
    const answer = answerDoor(door, SAMPLE[door.name]);
    assert.ok(Array.isArray(answer.classes), `${door.name} answered with no classes array`);
    assert.ok(
      answer.classes.length > 0 || typeof answer.unresolvable === "string",
      `${door.name} produced no classes and no reason, which is the silence the manifest exists to end`,
    );
  }
});

test("a door of a shape the reader has not been taught says so instead of throwing", () => {
  const answer = answerDoor({ name: "invented" }, ["select", "trigger"]);
  assert.deepEqual(answer.classes, []);
  assert.match(answer.unresolvable ?? "", /shape/);
});

test("a door asked the wrong question adds nothing and does not throw", () => {
  for (const door of MDY_CLASS_DOORS) {
    const answer = answerDoor(door, ["nonsense", "nonsense"]);
    assert.ok(Array.isArray(answer.classes), `${door.name} threw on a question it cannot answer`);
  }
});

test("a door asked with nothing says so, rather than answering with nothing", () => {
  // The distinction belongs to the contract, not to whoever is displaying it: a caller that has no
  // question for a door yet must not be handed an answer that reads as "this door puts no class on
  // any element". A caller that does want the door's own defaults asks with the empty shape.
  for (const door of MDY_CLASS_DOORS) {
    if (door.unresolvable) continue;
    const answer = answerDoor(door);
    assert.deepEqual(answer.classes, [], `${door.name} answered a question nobody asked`);
    assert.match(answer.unresolvable ?? "", /asked with nothing/,
      `${door.name} was silent about not having been asked`);
  }
});
