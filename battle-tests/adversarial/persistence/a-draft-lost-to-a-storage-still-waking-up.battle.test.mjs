/**
 * What happens to the saved draft while an asynchronous storage is still hydrating.
 *
 * `createHydratedDraftStorage` caches a Promise-based store behind the synchronous `MdyDraftStorage`
 * a form needs. Its documented rule is that **a read before hydration finishes returns `null`** —
 * "no draft", never a stale one — and the guide's example awaits `storage.ready` before building the
 * form.
 *
 * A caller who does not await it loses more than the restore. Measured, with a backend whose read
 * takes 120 ms:
 *
 *     await storage.ready    restored "WORK THE PERSON DID"   storage holds { note: "a new thought" }
 *     no await               restored ""                      storage holds { note: "a new thought" }
 *
 * The second row is the whole finding. The form restored nothing, the person typed, the debounce
 * fired, and the write went through the cache to the backend — **over the draft that was still in
 * flight**. The saved work is gone from storage, and the person was never shown it.
 *
 * The guide names the read behaviour and stops there: *"A read before `ready` resolves returns
 * `null` — 'no draft', never a stale one."* Losing the restore is what it prepares a reader for.
 * Losing the stored draft is not.
 *
 * **The library has the signal and does not consult it.** `MdyAsyncDraftStorage` publishes `ready`,
 * and the draft manager already feature-detects a storage's shape — it takes `{read, write, remove}`
 * or the platform's `{getItem, setItem, removeItem}` and adapts. A storage that says it is not
 * hydrated yet is the same kind of question asked of the same object.
 *
 * Green when a form on a hydrating storage does not overwrite the draft that storage is about to
 * hand it. Two answers: the draft manager holding its first write until a storage that publishes
 * `ready` has settled, or the cache refusing to flush a write for a key whose hydration has not
 * landed — the second is the narrower and lives entirely in the file that already knows.
 */

import { createForm, field } from "@modyra/core";
import { createHydratedDraftStorage } from "@modyra/core/async-draft-storage";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY = "checkout-draft";
const SAVED_TEXT = "WORK THE PERSON DID";

/** A store whose reads take as long as a device's do. */
function slowBackend(saved, readDelayMs) {
  const held = new Map(saved ? [[KEY, saved]] : []);
  return {
    held,
    backend: {
      async getItem(key) { await wait(readDelayMs); return held.get(key) ?? null; },
      async setItem(key, value) { held.set(key, value); },
      async removeItem(key) { held.delete(key); },
    },
  };
}

const savedEnvelope = () => JSON.stringify({
  __mdyDraft: 1,
  savedAt: Date.now(),
  value: { note: SAVED_TEXT },
});

/** Open a form on a hydrating storage, type into it, and report what storage ends up holding. */
async function typeInto({ awaitReady }) {
  const { held, backend } = slowBackend(savedEnvelope(), 120);
  const storage = createHydratedDraftStorage({ backend, keys: [KEY], onError: () => {} });
  if (awaitReady) await storage.ready;

  const form = createForm({ note: field("") }, { devWarnings: false, draft: { key: KEY, storage, debounceMs: 0 } });
  await wait(60);
  const restored = form.getValue().note;

  form.cellHandle("note").set("a new thought");
  await wait(300);
  await storage.flushed();
  form.destroy();

  const stored = JSON.parse(held.get(KEY) ?? "null");
  return { restored, stored: stored?.value ?? null };
}

battle(
  {
    claims: ["PER-004", "PER-003"],
    title: "a draft is not overwritten by a form that never saw it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: awaiting `ready` restores the saved work, so the storage, the envelope and the
    // key are all right and what follows is the ordering rather than a draft that was never there.
    const awaited = await typeInto({ awaitReady: true });
    ctx.log.note("the guide's ordering", awaited);
    expectEqual(awaited.restored, SAVED_TEXT, {
      claimIds: ["PER-003"],
      what: "awaiting ready did not restore the saved draft, so this battle is measuring the wrong thing",
      detail: JSON.stringify(awaited),
    });

    const raced = await typeInto({ awaitReady: false });
    ctx.log.note("without awaiting ready", raced);

    // Restoring nothing is the documented behaviour and is not what is under attack.
    expectClaim(raced.restored === "", {
      claimIds: ["PER-003"],
      what: "a read before hydration returned something, which the storage documents it never does",
      detail: JSON.stringify(raced),
    });

    // What is under attack is the storage afterwards: the person's saved work must still be there,
    // whether or not this form managed to show it.
    expectEqual(raced.stored?.note, SAVED_TEXT, {
      claimIds: ["PER-004"],
      what: "a form that restored nothing wrote over the draft the storage was about to hand it",
      detail: JSON.stringify(raced),
    });
  },
);
