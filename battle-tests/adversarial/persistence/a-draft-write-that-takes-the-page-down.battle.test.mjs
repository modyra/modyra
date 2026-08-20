/**
 * A value the form was given, and the timer that carries its exception out of everyone's reach.
 *
 * The draft manager's own rule is that a draft is an optional convenience and its failure never
 * becomes the form's. Reads are wrapped — *"a storage that refuses to be read is a draft that is not
 * there"* — and a failed flush is documented as never thrown into the form.
 *
 * The write path has one step outside that: `containsFile` walks the value to decide whether it can
 * be persisted, and it walks with `Object.values`, which **invokes getters**. A value whose getter
 * throws takes the exception with it:
 *
 *     setValue({ v: { get boom() { throw … } } })   returns normally
 *     the debounce fires                            Error: getter exploded
 *       at containsFile → _serialize → _write → Timeout._onTimeout
 *
 * On a timer the library owns, so no `try` a consumer writes can catch it. In a browser it is an
 * uncaught error at the window; in node it ends the process.
 *
 * **The same function already survived this once, from the other direction.** Its own comment records
 * it: a recursive walk *"ran one frame per level until the stack ended — the guard failing on exactly
 * the input it exists to check. The throw escaped `createForm`, so an application got no form at all,
 * on every load, until someone cleared the key."* The depth was fixed by making the walk iterative.
 * The reading of each property was not.
 *
 * A throwing getter is not exotic: a proxied model, a lazily computed property whose source is gone,
 * an ORM entity that validates on read. The form holds whatever an application puts in it.
 *
 * Green when a value that cannot be read leaves the draft unwritten and the form alive. The narrow
 * repair is the one the read side already has — the walk in a `try`, the draft skipped, the form
 * untouched.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Storage that records what it was handed, so a skipped write is distinguishable from a bad one. */
function recordingStorage() {
  const held = new Map();
  return {
    held,
    storage: {
      read: (key) => held.get(key) ?? null,
      write: (key, value) => { held.set(key, value); },
      remove: (key) => { held.delete(key); },
    },
  };
}

/**
 * Runs `write` with every uncaught exception collected instead of ending the process.
 *
 * The exception this battle is about arrives on a timer, so it reaches no caller: catching it needs
 * the process-level handler, and the handlers are removed on the way out either way.
 */
async function uncaughtWhile(write) {
  const seen = [];
  const onUncaught = (error) => { seen.push(String(error && error.message)); };
  process.on("uncaughtException", onUncaught);
  try {
    await write();
  } finally {
    process.off("uncaughtException", onUncaught);
  }
  return seen;
}

battle(
  {
    claims: ["PER-003"],
    title: "a value the draft cannot read does not take the form down",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary value writes a draft, so the key, the debounce and the storage are all
    // live and what follows is the value rather than a draft that was never being written.
    const ordinary = recordingStorage();
    const plain = createForm({ v: field("") }, { devWarnings: false, draft: { key: "d", storage: ordinary.storage, debounceMs: 0 } });
    await wait(40);
    plain.cellHandle("v").set("something typed");
    await wait(300);
    plain.destroy();
    expectClaim(String(ordinary.held.get("d") ?? "").includes("something typed"), {
      claimIds: ["PER-003"],
      what: "an ordinary value wrote no draft, so this battle is measuring a draft that never happens",
      detail: String(ordinary.held.get("d") ?? "(nothing written)"),
    });

    // And the value whose property cannot be read.
    const hostile = recordingStorage();
    let alive = false;
    const uncaught = await uncaughtWhile(async () => {
      const form = createForm({ v: field(null) }, { devWarnings: false, draft: { key: "d", storage: hostile.storage, debounceMs: 0 } });
      await wait(40);
      form.setValue({ v: { get boom() { throw new Error("getter exploded"); } } });
      await wait(300);
      // The form has to still answer: that is the half a crash takes away.
      alive = form.getValue() !== undefined && form.state.valid() !== undefined;
      form.destroy();
    });

    ctx.log.note("what the debounce did with a value it could not read", {
      uncaught,
      wrote: hostile.held.get("d") ?? null,
      alive,
    });

    expectEqual(uncaught, [], {
      claimIds: ["PER-003"],
      what: "writing a draft threw on a timer, where no caller can catch it",
    });

    expectClaim(alive, {
      claimIds: ["PER-003"],
      what: "the form stopped answering after the draft write failed",
    });
  },
);
