/**
 * Two adapters wrap one controller, and the surface they forward is the same surface.
 *
 * `@modyra/lit`, `@modyra/angular` and `@modyra/react` each hold a wall in front of one
 * `MdySelectFieldController` and forward to it: six setters, a dispatch and a destroy, each passing
 * its argument straight through. The bodies around them are not duplicates — one binds to a reactive
 * controller, one to signals, one to a hook's callbacks — so there is nothing to merge, and merging
 * would couple three packages to save no decision.
 *
 * They do not spell forwarding the same way. Two declare methods on a class; the third builds
 * callbacks and returns a record. That difference is why this file declares a reader per wall
 * instead of one regex: a guard that knew only the class spelling read two walls out of three and
 * reported the two it looked at as agreeing.
 *
 * What can go wrong is drift. The controller gains a setter, one adapter learns it, the other does
 * not, and the second is a select that never hears the thing the first hears. Nothing fails: the
 * adapter still compiles, still forwards everything it knew about, and the gap is a behaviour
 * missing from one framework and present in the other — the hardest kind to see, because each file
 * is complete on its own terms.
 *
 * So the duplication is left alone and the agreement is asserted. Read from source rather than by
 * importing: a widget package must not reach for its adapters, and a node test cannot mount Angular.
 *
 * Where a wall does not forward a name on purpose, the excuse is read from the record that argues
 * it, never restated here.
 *
 * @source-inspection — whether a wall *declares* a forwarded name is a fact about its sources, and
 * the drift being hunted is invisible from outside: every wall compiles, ships and answers for
 * everything it knows about. A build cannot be asked which name one of them never learned.
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

/**
 * The keys of the object a function returns, at the top level of that object.
 *
 * A hook does not forward with methods: it builds callbacks and hands back a record, so the class
 * reader above sees nothing in it and reports a wall that forwards none of the controller as
 * agreeing with two that forward all of it. The shape is declared per wall below rather than
 * guessed at here — a reader that tried both spellings on every file would find an interface's
 * members in one file and a returned record in another and call them the same evidence.
 *
 * The returned record is read, never the exported interface. An interface is a claim about the
 * record; the record is what a consumer is handed, and where the two disagree it is the interface
 * that is wrong.
 */
const returnedKeys = (source) => {
  const at = source.lastIndexOf("\n  return {");
  assert.ok(at !== -1, "no returned record was found, so this reader is measuring nothing");
  const start = source.indexOf("{", at);
  let depth = 0;
  let end = start;
  for (let i = start; i < source.length; i += 1) {
    if ("{([".includes(source[i])) depth += 1;
    else if ("})]".includes(source[i])) {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  const keys = new Set();
  let level = 0;
  let current = "";
  const flush = () => {
    const part = current.trim();
    current = "";
    if (part === "") return;
    const key = part.split(":")[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.add(key);
  };
  for (const ch of source.slice(start + 1, end)) {
    if ("{([".includes(ch)) level += 1;
    else if ("})]".includes(ch)) level -= 1;
    if (ch === "," && level === 0) { flush(); continue; }
    current += ch;
  }
  flush();
  return keys;
};

/**
 * The walls, each with the way its own file spells a forwarded name.
 *
 * Three, not two. React holds the same twenty-seven lines of pass-through under another spelling,
 * and a guard that reads two of three walls reports agreement between the two it looked at — which
 * is the exact defect it exists to catch, one level up. Plain is deliberately absent: it calls the
 * controller directly from a closure and has no wall to drift.
 */
const WALLS = [
  { path: "packages/lit/src/widget-runtime/select-adapter.ts", names: methodsOf },
  { path: "packages/angular/src/lib/widget-runtime/select-adapter.ts", names: methodsOf },
  { path: "packages/react/src/widgets/select-field.ts", names: returnedKeys },
];

/**
 * A name a wall deliberately does not forward, and the record that argues it.
 *
 * Read from the record rather than restated here: a copy of a decision inside a test is a second
 * declaration that stops agreeing with the first in silence, and the whole point of an exemption is
 * that a reader can find out *why*. If the record stops being Accepted, or stops naming this wall
 * and this call, the exemption is gone and the missing name is a defect again — which is what
 * retiring a decision should do to the checks that lean on it.
 */
const DECLARED_ABSENCES = [
  {
    path: "packages/react/src/widgets/select-field.ts",
    name: "setOptions",
    record: "docs/architecture/0195-a-list-that-arrives-after-the-control-is-on-screen.md",
  },
];

const exempt = (path, name) =>
  DECLARED_ABSENCES.some((absence) => {
    if (absence.path !== path || absence.name !== name) return false;
    const record = read(absence.record);
    return /^Status:\s*Accepted\s*$/m.test(record)
      && record.includes(absence.name)
      && /React/.test(record);
  });


test("both adapters forward every name the controller offers", () => {
  const offered = forwardable(read("packages/widgets/src/field/select-field-controller.ts"));
  assert.ok(offered.size >= 6, `only ${offered.size} forwardable names found — the reader, not the code`);

  for (const wall of WALLS) {
    const declared = wall.names(read(wall.path));
    assert.ok(declared.size > 0, `${wall.path}: the reader declared for this wall found nothing in it`);
    const missing = [...offered].filter((name) => !declared.has(name) && !exempt(wall.path, name)).sort();
    assert.deepEqual(missing, [], `${wall.path} does not forward ${missing.join(", ")}`);
  }
});

test("neither adapter forwards a name the other does not", () => {
  // An adapter may hold methods of its own — Angular registers its parts and looks its items up, and
  // Lit has no such registry. Those are not forwarding, and the check would be wrong to demand them
  // of both. What must agree is the part that is forwarding: the controller's own names.
  const offered = forwardable(read("packages/widgets/src/field/select-field-controller.ts"));

  // A wall may hold methods of its own — Angular registers its parts and looks its items up, and Lit
  // has no such registry. Those are not forwarding. What must agree is the controller's own names,
  // plus whatever each wall is excused from by a record.
  const forwardedBy = (wall) =>
    [...wall.names(read(wall.path))]
      .filter((name) => offered.has(name))
      .concat([...offered].filter((name) => exempt(wall.path, name)))
      .sort();

  const [first, ...rest] = WALLS;
  for (const wall of rest) {
    assert.deepEqual(forwardedBy(wall), forwardedBy(first),
      `${wall.path} and ${first.path} forward different halves of one controller, so a select behaves `
      + "differently in one framework than the other for a reason no file states");
  }
});
