/**
 * The same form open twice, and the tab that finished first.
 *
 * A draft key identifies the form, not the window it is in — so two views of one form share a key by
 * design, which is what makes a draft survive a reload at all. Two tabs of one form is therefore the
 * ordinary arrangement rather than a misuse.
 *
 * A save does not read what it is about to replace. A tab that has been open a while writes over a
 * draft another view saved more recently, and the work in that one is gone with nothing said.
 *
 * What makes it more than last-write-wins is the envelope. Every save stamps `savedAt`, and after
 * this the stored stamp has gone **backwards** — the draft in storage claims to be older than the one
 * it replaced. So the one field that could tell a later reader something is wrong now tells them the
 * opposite, and nothing downstream can detect the loss either.
 *
 * The security guide already states the threat model in these words: a draft lives where every script
 * on the origin can write it. The engine owns this protocol — it defined the envelope, it writes the
 * stamp, and it is the only thing that reads one. A field written and never read promises a freshness
 * it does not check.
 *
 * Either repair closes it: read before writing and refuse or report a stamp newer than the last one
 * this form wrote, or say in the draft contract that a key must be unique per view. What this refuses
 * is the third thing — a silent replacement that also falsifies the record of when it happened.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Storage that remembers what was asked of it, so "did it read first" is observable. */
function watchedStorage() {
  const written = new Map();
  const reads = [];
  return {
    written,
    reads,
    read: (key) => {
      reads.push(key);
      return written.get(key) ?? null;
    },
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

/** The draft manager saves on its own debounce, which no clock here drives. */
const saved = () => new Promise((resolve) => setTimeout(resolve, 750));
const settled = () => new Promise((resolve) => setTimeout(resolve, 180));

const envelopeIn = (storage) => JSON.parse(storage.written.get("tab"));

battle(
  {
    claims: ["PER-004", "PER-001"],
    title: "a save does not replace a draft that was written after the one it knows about",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = watchedStorage();
    const open = () => createForm({ note: field("") }, { draft: { key: "tab", storage }, devWarnings: false });

    const tab = open();
    await settled();
    tab.f.note.set("this tab has been open a while");
    await saved();

    // The control: the draft protocol works. A save writes an envelope with a stamp, so what follows
    // is about a second writer rather than about drafts not being saved.
    const first = envelopeIn(storage);
    ctx.log.note("what one tab saved", { savedAt: first.savedAt, value: first.value });

    expectEqual(first.value.note, "this tab has been open a while", {
      claimIds: ["PER-001"],
      what: "the draft did not carry what was typed, so nothing below is about a second writer",
    });

    expectClaim(typeof first.savedAt === "number", {
      claimIds: ["PER-004"],
      what: "the envelope carries no stamp, so there is nothing a save could compare against",
      detail: JSON.stringify(first),
    });

    // Another view of the same form saves, more recently. Written through the same storage the
    // engine was given, which is the only thing another tab has either.
    const other = { ...first, value: { note: "the other tab finished first" }, savedAt: first.savedAt + 60_000 };
    storage.written.set("tab", JSON.stringify(other));
    storage.reads.length = 0;

    // And the first tab, still open, saves again.
    tab.f.note.set("this tab has been open a while and then some");
    await saved();
    const after = envelopeIn(storage);
    ctx.log.note("what is in storage after the older tab saved", {
      readFirst: [...storage.reads],
      savedAt: after.savedAt,
      replaced: other.savedAt,
      value: after.value,
    });
    tab.destroy();

    // Whatever is decided about who wins, the stamp cannot go backwards: the record of when the
    // stored draft was written is the only thing a later reader has.
    expectClaim(after.savedAt >= other.savedAt, {
      claimIds: ["PER-004"],
      what: "a save replaced a newer draft and stamped it with an earlier time, so the stored record of when it was written went backwards",
      detail: `stored ${after.savedAt}, replaced ${other.savedAt}, difference ${other.savedAt - after.savedAt}ms`,
    });

    // And the work itself. Either the newer draft survives, or the save reads it first and the
    // consumer is given the chance to decide.
    expectClaim(after.value.note === other.value.note || storage.reads.length > 0, {
      claimIds: ["PER-004"],
      what: "a draft saved more recently was replaced without being read",
      detail: JSON.stringify({ readFirst: storage.reads, stored: after.value }),
    });
  },
);
