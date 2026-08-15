/**
 * Handing a form the storage the guide says it already uses.
 *
 * `docs/guides/typed-forms.md` says it plainly: *the default storage is `localStorage`*. A consumer
 * reading that and then naming it — because they want a different key prefix, a session instead of a
 * local, a wrapper that counts writes — passes `window.localStorage`, which is the object the
 * sentence names.
 *
 * The option does not take that shape. `MdyDraftStorage` is `{read, write, remove}`; Web Storage is
 * `{getItem, setItem, removeItem}`. Nothing published converts between them, and the mismatch is not
 * refused: the first read throws `this._storage.read is not a function` — a message naming a private
 * field, from a stack inside the engine, about an argument the caller passed.
 *
 * This battle is red on the last assertion. It goes green when the platform's own storage either
 * works or is refused with a message that names the shape expected. Which of the two is a decision;
 * the current answer is neither.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Web Storage, as a browser hands it over. */
function webStorage() {
  const held = new Map();
  return {
    getItem: (key) => (held.has(key) ? held.get(key) : null),
    setItem: (key, value) => held.set(key, String(value)),
    removeItem: (key) => held.delete(key),
    key: (index) => [...held.keys()][index] ?? null,
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    held,
  };
}

/** The shape the option actually takes. */
function draftStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));

battle(
  {
    claims: ["PER-001", "API-001"],
    title: "the storage a browser already has is taken, or refused for a reason",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the shape the option does take works, so what happens below is the shape rather
    // than drafts being broken.
    const proper = draftStorage();
    const working = createForm({ who: field("") }, { draft: { key: "k", storage: proper }, devWarnings: false });
    working.f.who.set("typed");
    await saved();
    working.destroy();

    expectClaim(proper.written.get("k")?.includes("typed") === true, {
      claimIds: ["PER-001"],
      what: "a storage of the documented shape did not receive the draft, so nothing here is measurable",
      detail: JSON.stringify([...proper.written]),
    });

    // And the one a browser hands over, which the guide names as the default.
    const platform = webStorage();
    let outcome = "took it";
    let form = null;
    try {
      form = createForm({ who: field("") }, { draft: { key: "k", storage: platform }, devWarnings: false });
      form.f.who.set("typed");
      await saved();
    } catch (error) {
      outcome = String(error?.message ?? error);
    } finally {
      form?.destroy();
    }

    ctx.log.note("a form handed the platform's own storage", {
      outcome,
      stored: [...platform.held],
    });

    expectClaim(!outcome.includes("_storage"), {
      claimIds: ["API-001"],
      what: "the failure names a private field of the engine, in a stack the caller cannot act on",
      detail: outcome,
    });

    expectEqual(outcome, "took it", {
      claimIds: ["PER-001", "API-001"],
      what: "the storage the guide names as the default is neither taken nor refused with a reason",
      detail: JSON.stringify({ outcome, expectedShape: "read/write/remove", given: "getItem/setItem/removeItem" }),
    });
  },
);
