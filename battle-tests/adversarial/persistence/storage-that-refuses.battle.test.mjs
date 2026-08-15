/**
 * A draft that could not be read, and the form that never opened.
 *
 * `localStorage` is not a function that always works. Safari in private browsing throws on access;
 * an enterprise policy or a blocked third-party context throws; a full quota throws on write. A
 * consumer hands the engine that object and the engine calls it while the form is being built.
 *
 * Two of the three failures are already handled, which is what makes the third a gap rather than an
 * unconsidered case. A `write` that throws — the quota one, the most talked about — is swallowed and
 * the form carries on holding what the user typed. A `read` that returns something that is not a
 * draft is ignored the same way.
 *
 * A `read` that *throws* takes `createForm` with it. The form is not built, and a draft is an
 * optional convenience: failing to read one should mean there is no draft, not that there is no
 * form. On the browser where this happens, that is a page that renders nothing.
 *
 * `clearDraft()` has the smaller version of it: a `remove` that throws comes out of the call.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({ version: 1, fields: Object.freeze({ a: Object.freeze({ kind: "text" }) }) });

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** A storage that works, to be broken one method at a time. */
function workingStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const attempt = (fn) => {
  try {
    return { answered: true, value: fn() };
  } catch (error) {
    return { answered: false, threw: error?.constructor?.name ?? typeof error };
  }
};

/**
 * What an attempt is worth saying in a report.
 *
 * Never the value: when the attempt succeeded it is a live form, and a form holds its own scheduler
 * — `JSON.stringify` of one throws on the circular structure and takes the battle down before the
 * assertion it was attached to has been checked. A detail that can fail is a detail that decides
 * whether a claim is reported, which is the wrong way round.
 */
const outcomeOf = (attempted) =>
  JSON.stringify({ answered: attempted.answered, threw: attempted.threw ?? null });

const openWith = (storage) =>
  attempt(() => createForm(buildSchema(SPEC).schema, {
    reactivity: vanillaReactivity(),
    devWarnings: false,
    draft: { key: "d", storage, debounceMs: 10 },
  }));

battle(
  {
    claims: ["PER-001", "LIF-001"],
    title: "a storage that refuses leaves a form without a draft, not a page without a form",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with a storage that works, the form builds and the draft round-trips.
    const working = workingStorage();
    const control = openWith(working);
    expectClaim(control.answered, {
      claimIds: ["PER-001"],
      what: "a form could not be built with a storage that works, so nothing below is about the failures",
      detail: outcomeOf(control),
    });
    control.value.f.a.set("typed");
    await settled();
    expectClaim(working.written.has("d"), {
      claimIds: ["PER-001"],
      what: "a working storage was not written to",
    });
    control.value.destroy();

    // The failure that is already handled, and the reason the one below is a gap: a quota that is
    // full throws on write, and the form carries on holding what the user typed.
    const quota = { ...workingStorage(), write: () => { throw new Error("QuotaExceededError"); } };
    const full = openWith(quota);
    expectClaim(full.answered, {
      claimIds: ["PER-001"],
      what: "a storage whose write throws stopped the form being built",
      detail: outcomeOf(full),
    });
    full.value.f.a.set("typed");
    await settled();
    expectEqual(full.value.getValue().a, "typed", {
      claimIds: ["PER-001", "LIF-001"],
      what: "a storage whose write throws lost what the user typed",
    });
    full.value.destroy();

    // And the one that is not. This is Safari in private browsing, and a blocked third-party
    // context, and an enterprise policy — the access itself throws.
    for (const [what, storage] of [
      ["read throws", { ...workingStorage(), read: () => { throw new Error("SecurityError"); } }],
      ["every method throws", {
        read: () => { throw new Error("SecurityError"); },
        write: () => { throw new Error("SecurityError"); },
        remove: () => { throw new Error("SecurityError"); },
      }],
    ]) {
      const built = openWith(storage);
      ctx.log.note("a storage that refuses", { what, built });

      expectClaim(built.answered, {
        claimIds: ["PER-001", "LIF-001"],
        what: `a storage where ${what} stopped the form being built at all`,
        detail: outcomeOf(built),
      });

      if (built.answered) {
        // And having been built, it is a form: it holds what is typed into it, with no draft.
        built.value.f.a.set("typed");
        await settled();
        expectEqual(built.value.getValue().a, "typed", {
          claimIds: ["PER-001"],
          what: `a form built over a storage where ${what} did not hold what was typed`,
        });
        built.value.destroy();
      }
    }
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "discarding a draft a storage will not remove is not the caller's problem to catch",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = { ...workingStorage(), remove: () => { throw new Error("SecurityError"); } };
    const built = openWith(storage);
    expectClaim(built.answered, {
      claimIds: ["PER-001"],
      what: "a storage whose remove throws stopped the form being built",
    });

    const form = built.value;
    form.f.a.set("typed");
    await settled();

    const cleared = attempt(() => form.clearDraft());
    ctx.log.note("discarding a draft the storage will not remove", { cleared });

    // The write path swallows its failure; the remove path does not, and a consumer wiring a
    // "discard" button has no reason to expect one and not the other.
    expectClaim(cleared.answered, {
      claimIds: ["PER-001"],
      what: "clearDraft threw because the storage would not remove the entry",
      detail: outcomeOf(cleared),
    });

    form.destroy();
  },
);
