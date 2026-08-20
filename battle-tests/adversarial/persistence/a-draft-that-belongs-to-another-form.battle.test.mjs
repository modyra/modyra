/**
 * The shape a draft records, and the one side that reads it.
 *
 * A draft envelope carries `shape` — a short stable name for the form that wrote it — and it exists to
 * tell one form's work from another's under a shared key. Two live forms on one key is not exotic: a
 * component rendered twice, a route mounting a form beside another, a key copied along with the
 * options it sits in.
 *
 * The **write** side reads it. `_foreignPaths` compares the stored shape with this form's and refuses
 * to overwrite work that is not this form's, saying so with `MDY_DRAFT_KEY_IN_USE`.
 *
 * The **read** side does not. `_parse` checks the envelope version and the age, and hands back the
 * value; `shape` is never consulted. So the draft the writer refused to replace is one the reader
 * restores:
 *
 *     form B writes  {"shape":"1xxig97","value":{"email":"victim@example.test"}}
 *     form A opens   → { email: "victim@example.test", password: "", note: "" }
 *
 *     form A writes  {"shape":"1gqrgtk","value":{"email":"a@…","note":"a private note"}}
 *     form B opens   → { email: "a@…" }
 *
 * Both directions, with a shape recorded, differing, and available. What a person typed into one form
 * appears filled into another and is submitted from there — the value crosses a boundary the library
 * already knows how to see.
 *
 * It is not a tampering finding: no storage was edited, both drafts are ones this library wrote. It is
 * the guard being installed on one door of two.
 *
 * Green when a draft whose recorded shape is not this form's is not restored into it. Two answers:
 * `_parse` refusing an envelope whose `shape` differs from `formShape()`, or the restore filter
 * dropping every path when it does — the first is the one the write side already took.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY = "one-key-two-forms";

/** Everything one form writes, kept where the next one will look. */
function sharedStorage() {
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

/** B's paths are a strict subset of A's, which is the arrangement the write guard cannot see either. */
const FORM_A = () => ({ email: field(""), password: field(""), note: field("") });
const FORM_B = () => ({ email: field("") });

battle(
  {
    claims: ["PER-004", "PER-001"],
    title: "a draft another form wrote is not restored into this one",
    environments: ["node"],
  },
  async (ctx) => {
    const { held, storage } = sharedStorage();
    const open = (schema) => createForm(schema(), { devWarnings: false, draft: { key: KEY, storage, debounceMs: 0 } });

    const writer = open(FORM_B);
    await wait(80);
    writer.cellHandle("email").set("victim@example.test");
    await wait(300);
    const written = held.get(KEY);
    writer.destroy();

    // The control on the measurement: a draft was written, and it recorded a shape. Without both,
    // what follows would be true of a form that simply restored nothing.
    expectClaim(typeof written === "string" && written.includes("victim@example.test"), {
      claimIds: ["PER-004"],
      what: "the first form wrote no draft, so nothing was there to be restored across",
      detail: String(written).slice(0, 200),
    });
    const writtenShape = JSON.parse(written).shape;
    expectClaim(typeof writtenShape === "string" && writtenShape.length > 0, {
      claimIds: ["PER-004"],
      what: "the envelope records no shape, so nothing could tell the two forms apart",
      detail: String(written).slice(0, 200),
    });

    const reader = open(FORM_A);
    await wait(250);
    const restored = reader.getValue();
    const sawDraft = reader.hasDraft();
    ctx.log.note("what the second form opened holding", { restored, sawDraft, writtenShape });
    reader.destroy();

    expectEqual(restored.email, "", {
      claimIds: ["PER-004", "PER-001"],
      what: "a value typed into one form was restored into another form sharing the key",
      detail: JSON.stringify({ written, restored }),
    });

    // And the other direction, because a subset in one order is a superset in the other: A's draft
    // carries a path B has never heard of, and B still takes the one it recognises.
    const second = sharedStorage();
    const openSecond = (schema) => createForm(schema(), { devWarnings: false, draft: { key: KEY, storage: second.storage, debounceMs: 0 } });

    const wide = openSecond(FORM_A);
    await wait(80);
    wide.cellHandle("email").set("a@example.test");
    wide.cellHandle("note").set("a private note");
    await wait(300);
    wide.destroy();

    const narrow = openSecond(FORM_B);
    await wait(250);
    const narrowValue = narrow.getValue();
    ctx.log.note("the wider form's draft, opened by the narrower one", narrowValue);
    narrow.destroy();

    expectEqual(narrowValue.email, "", {
      claimIds: ["PER-004", "PER-001"],
      what: "a wider form's draft was restored into a narrower form sharing the key",
      detail: JSON.stringify(narrowValue),
    });
  },
);
