/**
 * A reactivity the engine cannot use is refused at the door, by name.
 *
 * An adapter implements `MdyReactivity` and the compiler checks it — but one written in JavaScript,
 * handed across a bundle boundary, or assembled by spreading another, is checked by nothing. The
 * first missing member then arrived from inside the engine: `hasDraft.asReadonly is not a function`,
 * thrown in a file its author has never opened, naming a local variable that means nothing to them.
 *
 * The second half a type would not have caught anyway: `asReadonly` is declared on
 * `MdyWritableSignal`, a *different* interface from the one being implemented, so an adapter can
 * satisfy `MdyReactivity` completely and still hand back signals the engine cannot use.
 *
 * What is required was measured, not assumed. `effect` is absent from the list on purpose: a
 * reactivity that runs no reactions is supported — the engine degrades and reports it through the
 * diagnostics sink — and refusing one here would turn a documented fallback into a crash.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createForm, field, missingReactivityMembers, vanillaReactivity } from "../dist/index.js";

/** Vanilla, taken apart so one member at a time can be withheld. */
function parts() {
  const real = vanillaReactivity();
  return {
    id: real.id,
    kind: real.kind,
    capabilities: real.capabilities,
    signal: real.signal.bind(real),
    computed: real.computed.bind(real),
    untracked: real.untracked.bind(real),
    effect: real.effect.bind(real),
    createScope: real.createScope?.bind(real),
  };
}

const REQUIRED = ["signal", "computed", "untracked"];
/** Absent by design: the engine has a documented answer for each. */
const DEGRADABLE = ["effect", "capabilities", "id", "kind"];

test("a whole reactivity is missing nothing", () => {
  assert.deepEqual(missingReactivityMembers(vanillaReactivity()), []);
  assert.deepEqual(missingReactivityMembers(parts()), []);
});

test("each required member is missed on its own, and named with what it is for", () => {
  for (const member of REQUIRED) {
    const rx = parts();
    delete rx[member];
    const reported = missingReactivityMembers(rx);
    assert.equal(reported.length, 1, `withholding ${member} reported ${reported.length}`);
    assert.ok(reported[0].startsWith(`${member}()`), `${member} was not named first`);
    assert.match(reported[0], / — /, `${member} was reported without saying what it is for`);
  }
});

test("a member the engine can do without is not demanded", () => {
  for (const member of DEGRADABLE) {
    const rx = parts();
    delete rx[member];
    assert.deepEqual(
      missingReactivityMembers(rx),
      [],
      `${member} was demanded, which turns a documented fallback into a refusal`,
    );
  }
});

test("a signal that cannot be made read-only is reported, though the reactivity is whole", () => {
  const real = vanillaReactivity();
  const rx = {
    ...parts(),
    // Satisfies `MdyReactivity` in full; its signals do not satisfy `MdyWritableSignal`.
    signal: (initial, options) => {
      const made = real.signal(initial, options);
      const read = (...args) => made(...args);
      return Object.assign(read, { set: (value) => made.set(value), update: (fn) => made.update(fn) });
    },
  };

  const reported = missingReactivityMembers(rx);
  assert.equal(reported.length, 1);
  assert.match(reported[0], /^signal\(\)\.asReadonly\(\)/);
  assert.match(reported[0], /MdyWritableSignal/, "the reader is not told which interface owes it");
});

test("the engine refuses such a reactivity, naming the member rather than its own internals", () => {
  const real = vanillaReactivity();
  const rx = {
    ...parts(),
    signal: (initial, options) => {
      const made = real.signal(initial, options);
      const read = (...args) => made(...args);
      return Object.assign(read, { set: (value) => made.set(value), update: (fn) => made.update(fn) });
    },
  };

  assert.throws(
    () => createForm({ a: field("") }, { reactivity: rx }),
    (error) => {
      assert.ok(error instanceof TypeError);
      assert.match(error.message, /signal\(\)\.asReadonly\(\)/, "the refusal did not name the member");
      assert.doesNotMatch(error.message, /hasDraft/, "the engine leaked a local variable name");
      return true;
    },
  );
});

test("a reactivity that is not an object at all is told so plainly", () => {
  for (const value of [null, undefined, "vanilla", 7]) {
    const reported = missingReactivityMembers(value);
    assert.equal(reported.length, 1, `${String(value)} produced ${reported.length} findings`);
    assert.match(reported[0], /must be an object/);
  }
});
