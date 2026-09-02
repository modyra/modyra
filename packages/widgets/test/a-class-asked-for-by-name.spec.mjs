/**
 * The third door of the class contract answers by name, and refuses by name.
 *
 * A widget draws things that are not parts — a box, a decoration, a sizer — and the contract names
 * them so a renderer can ask instead of spelling. They were reachable only by index, which made
 * every entry a position rather than a thing: a renderer asking for one would have depended on the
 * order of a literal it did not write, and one insertion would have moved every answer.
 *
 * What is asserted here is the property that makes the door worth having: the same name answers the
 * same class whatever else the kind declares, and a name the kind does not have is refused rather
 * than answered with nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses, presentationClass } from "../dist/index.js";

test("a presentation element is answered by its name", () => {
  assert.equal(presentationClass("select", "box"), "mdy-select");
  assert.equal(presentationClass("datepicker", "navButton"), "mdy-datepicker__nav-btn");
  assert.equal(presentationClass("file", "remove"), "mdy-file-remove");
});

test("the answer does not depend on where the entry sits", () => {
  // The point of the door. Every declared name is asked for, and each answers a class that the kind
  // actually declares — a property an index cannot have, because an index answers whatever moved
  // into that position.
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = MDY_WIDGET_CONTRACTS[kind].presentationClasses;
    for (const name of Object.keys(declared)) {
      assert.equal(presentationClass(kind, name), declared[name],
        `${kind}.${name} answered something the contract does not declare for it`);
    }
  }
});

test("a name the kind does not have is refused, and the refusal says what it has", () => {
  // Not an empty string: a renderer asking for an element the contract has not agreed to would
  // otherwise put it on the page with no class and no complaint.
  assert.throws(
    () => presentationClass("select", "nope"),
    (error) => {
      assert.ok(error instanceof RangeError);
      assert.match(error.message, /presentation element "nope"/);
      assert.match(error.message, /box/, "the refusal did not say what the kind does have");
      return true;
    },
  );
});

test("a kind that is not a kind is refused before its classes are read", () => {
  assert.throws(() => presentationClass("nonesuch", "box"), /No widget "nonesuch"/);
});

test("presentation is not a part, and the two doors stay apart", () => {
  // A part carries a semantic — the contract refuses one with no opinion about the element it
  // admits. These carry none, which is why they are declared apart rather than promoted, and asking
  // the part door for one of them fails.
  assert.throws(() => partClasses("select", "box"));
  assert.equal(presentationClass("select", "box"), "mdy-select");
});
