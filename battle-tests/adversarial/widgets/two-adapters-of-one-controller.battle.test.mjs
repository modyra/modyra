/**
 * Two adapters wrap one controller, and the surface they forward is the same surface.
 *
 * `@modyra/lit` and `@modyra/angular` each hold a `select-adapter` that owns a
 * `MdySelectFieldController` and forwards to it. The two files share twenty-seven lines with no
 * logic in them: six setters, a dispatch and a destroy, each passing its argument straight through.
 * The bodies around them are not duplicates — one binds to a reactive controller and the other to
 * signals — so there is nothing to merge, and merging would couple two packages to save no decision.
 *
 * What can go wrong is drift. The controller gains a setter, one adapter learns it, the other does
 * not, and the second is a select that never hears the thing the first hears. Nothing fails: the
 * adapter still compiles, still forwards everything it knew about, and the gap is a behaviour
 * missing from one framework and present in the other — the hardest kind to see, because each file
 * is complete on its own terms.
 *
 * So the duplication is left alone and the agreement is asserted. Read from source rather than by
 * importing: a widget package must not reach for its adapters, and a node test cannot mount Angular.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

/** Method names a class declares at its own indentation, without the modifiers in front of them. */
const methodsOf = (source) =>
  new Set(
    [...source.matchAll(/^ {2}(?:public |private |protected )*(?:async )?([a-zA-Z][A-Za-z0-9_]*)\s*\(/gm)]
      .map((m) => m[1])
      .filter((name) => name !== "constructor"),
  );

/**
 * What the controller's own interface offers to be forwarded: its setters.
 *
 * `dispatch` and `destroy` come from the widget controller it extends rather than from here, so they
 * are not in this set. Both adapters declare them; what this reads is the half that moves when a
 * select gains a way to be told something.
 *
 * The name is matched with its type parameter, because `MdySelectFieldControllerOptions` is declared
 * first and the shorter name is a prefix of it — matched loosely, this reads the options bag, finds
 * no setters, and reports agreement between two adapters it never looked at.
 */
const forwardable = (source) => {
  const block = /interface MdySelectFieldController</.test(source)
    ? /interface MdySelectFieldController<[\s\S]*?\n\}/.exec(source)
    : null;
  assert.ok(block, "the controller interface was not found, so this test is measuring nothing");
  return new Set(
    [...block[0].matchAll(/^\s{2}(?:readonly\s+)?(set[A-Z][A-Za-z0-9_]*|dispatch|destroy)\s*(?:\(|:)/gm)]
      .map((m) => m[1]),
  );
};

const LIT = "packages/lit/src/widget-runtime/select-adapter.ts";
const ANGULAR = "packages/angular/src/lib/widget-runtime/select-adapter.ts";

test("both adapters forward every name the controller offers", () => {
  const offered = forwardable(read("packages/widgets/src/field/select-field-controller.ts"));
  assert.ok(offered.size >= 6, `only ${offered.size} forwardable names found — the reader, not the code`);

  for (const path of [LIT, ANGULAR]) {
    const declared = methodsOf(read(path));
    const missing = [...offered].filter((name) => !declared.has(name)).sort();
    assert.deepEqual(missing, [], `${path} does not forward ${missing.join(", ")}`);
  }
});

test("neither adapter forwards a name the other does not", () => {
  // An adapter may hold methods of its own — Angular registers its parts and looks its items up, and
  // Lit has no such registry. Those are not forwarding, and the check would be wrong to demand them
  // of both. What must agree is the part that is forwarding: the controller's own names.
  const offered = forwardable(read("packages/widgets/src/field/select-field-controller.ts"));
  const lit = methodsOf(read(LIT));
  const angular = methodsOf(read(ANGULAR));

  const forwardedBy = (declared) => [...declared].filter((name) => offered.has(name)).sort();
  assert.deepEqual(forwardedBy(lit), forwardedBy(angular),
    "the two adapters forward different halves of one controller, so a select behaves differently "
    + "in one framework than the other for a reason no file states");
});
