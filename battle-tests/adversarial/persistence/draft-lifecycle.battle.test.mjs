/**
 * When a draft goes away, and when it must not.
 *
 * A draft exists so that a person who closes a tab half-way through a long form finds their work
 * where they left it. Everything about it is therefore about *not* losing something, and the
 * decisions are all in the negative: `clearDraft` throws it away on purpose, an error-free submit
 * throws it away because the work has landed somewhere better, and every other ending keeps it.
 *
 * `hasDraft`, `clearDraft` and the submit rule had no battle. The one that matters most is the one
 * that is easiest to get wrong in a refactor: a submit that *failed* must leave the draft alone. A
 * server that rejected the payload, or a network that was not there, leaves the user holding work
 * they have not saved anywhere — and discarding it there is the one bug in this area a user would
 * describe as "it deleted everything".
 *
 * `hasDraft` is asserted for what it is documented to mean — a draft was restored — rather than for
 * "a draft is stored", which is what its name suggests and what a consumer might otherwise read
 * into a false answer.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text", required: true }) }),
    }),
  }),
});

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 60));

/** A form that has written a draft, with one cell edited after its row was declared. */
async function withADraft(ctx, storage) {
  const context = ctx.open(SPEC, { draft: { key: "d", storage, debounceMs: 15 } });
  await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
  await context.execute({ type: "field.set", path: "rows.a.code", value: "edited" });
  await saved();
  return context;
}

battle(
  {
    claims: ["PER-001"],
    title: "a draft survives every ending except the two that mean it is no longer needed",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // Discarded on purpose.
    {
      const storage = memoryStorage();
      const context = await withADraft(ctx, storage);
      const before = storage.written.has("d");
      context.form.clearDraft();
      ctx.log.note("clearDraft", { before, after: storage.written.has("d") });

      expectEqual([before, storage.written.has("d")], [true, false], {
        claimIds: ["PER-001"],
        what: "clearDraft did not remove the stored draft, or there was none to remove",
      });
    }

    // Discarded because the work landed somewhere better.
    {
      const storage = memoryStorage();
      const context = await withADraft(ctx, storage);
      await context.form.submit(async () => []);
      await saved();
      ctx.log.note("a submit that returned no errors", { stored: storage.written.has("d") });

      expectEqual(storage.written.has("d"), false, {
        claimIds: ["PER-001"],
        what: "a form that submitted cleanly kept a draft that will be restored over fresh data",
      });
    }

    // Kept, because the work has not landed anywhere. Both shapes of failure: a server that said no
    // and a network that was not there.
    for (const [ending, action] of [
      ["the server returned errors", async () => [{ path: "rows.a.code", message: "server said no" }]],
      ["the action threw", async () => { throw new Error("network down"); }],
    ]) {
      const storage = memoryStorage();
      const context = await withADraft(ctx, storage);
      await context.form.submit(action);
      await saved();
      ctx.log.note("a submit that failed", { ending, stored: storage.written.has("d") });

      expectEqual(storage.written.has("d"), true, {
        claimIds: ["PER-001"],
        what: `a submit where ${ending} threw away the draft, so the work exists nowhere`,
      });
    }
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "a draft discarded while a write was pending stays discarded",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const context = ctx.open(SPEC, { draft: { key: "d", storage, debounceMs: 15 } });

    // Discarded inside the window a write is waiting in. A debounce that fires afterwards would put
    // back exactly what the user asked to be rid of, and nothing would say so.
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    context.form.clearDraft();
    const atOnce = storage.written.has("d");
    await saved();
    const afterTheWindow = storage.written.has("d");
    ctx.log.note("discarded inside the debounce window", { atOnce, afterTheWindow });

    expectEqual([atOnce, afterTheWindow], [false, false], {
      claimIds: ["PER-001"],
      what: "a draft discarded while a write was pending came back when the write fired",
    });

    // The control: the form still saves after that, so what is asserted above is the discarding
    // rather than a draft mechanism that stopped working.
    await context.execute({ type: "field.set", path: "rows.a.code", value: "typed again" });
    await saved();

    expectEqual(storage.written.has("d"), true, {
      claimIds: ["PER-001"],
      what: "editing after a discard did not start a new draft",
    });
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "hasDraft answers about restoring, not about storing",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const storage = memoryStorage();

    // A form that wrote a draft did not restore one, and says so. Reading this as "a draft exists"
    // is the mistake the name invites, which is why the two are asserted apart.
    const writing = await withADraft(ctx, storage);
    ctx.log.note("the form that wrote the draft", {
      hasDraft: writing.form.hasDraft(),
      stored: storage.written.has("d"),
    });

    expectClaim(storage.written.has("d") === true && writing.form.hasDraft() === false, {
      claimIds: ["PER-001"],
      what: "a form that wrote a draft without restoring one answered hasDraft wrongly",
      detail: JSON.stringify({ stored: storage.written.has("d"), hasDraft: writing.form.hasDraft() }),
    });
    writing.form.destroy();

    // And the form that opens onto it did restore one.
    const restoring = ctx.open(SPEC, { draft: { key: "d", storage, debounceMs: 15 } });
    await saved();
    ctx.log.note("the form that opened onto the draft", {
      hasDraft: restoring.form.hasDraft(),
      value: restoring.form.getValue().rows,
    });

    expectEqual(restoring.form.hasDraft(), true, {
      claimIds: ["PER-001"],
      what: "a form that restored a draft did not say so",
    });

    expectEqual(restoring.form.getValue().rows?.a?.code, "edited", {
      claimIds: ["PER-001"],
      what: "the restored form does not hold what was typed",
    });
  },
);
