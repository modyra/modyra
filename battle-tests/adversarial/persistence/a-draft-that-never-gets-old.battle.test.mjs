/**
 * A draft with no age, in storage that survives logout.
 *
 * `ttlMs` is documented as "discard drafts older than a day", and the reason it exists is on the same
 * page: the default storage is plain text, readable by every script on the origin, and it survives
 * logout. An expiry is how a consumer bounds how long a half-filled form sits there.
 *
 * The age comes from `savedAt` in the envelope, and the check believes it. Three envelopes never
 * expire: one whose `savedAt` is in the future, one with no `savedAt` at all, and one where it is not
 * a number.
 *
 * The first needs no attacker — a device whose clock was ahead when the draft was written produces
 * it, and the draft then outlives every expiry the consumer sets. The second is what a partially
 * written envelope, or one from a version that did not carry the field, looks like.
 *
 * The controls are the two cases that work, and they are asserted first: an honest recent draft is
 * restored, and an honest old one is discarded. Without both, "expired" and "never restored anything"
 * are the same measurement.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 140));

const document = {
  node: "group",
  children: { who: { node: "field", field: { kind: "text", label: "W" } } },
};

const HOUR = 3_600_000;

/** Write a draft, optionally rewrite its envelope, and give back what a new form restored. */
async function afterRoundTrip(ttlMs, rewrite) {
  const storage = memoryStorage();
  const open = () => createForm(buildDynamicFormSchema(document), {
    draft: { key: "k", storage, ttlMs },
    devWarnings: false,
  });

  const first = open();
  first.f.who.set("lorenzo");
  await saved();
  first.destroy();

  if (rewrite !== undefined) {
    const envelope = JSON.parse(storage.written.get("k"));
    rewrite(envelope);
    storage.written.set("k", JSON.stringify(envelope));
  }

  const second = open();
  await restored();
  const value = second.getValue().who;
  second.destroy();
  return value;
}

battle(
  {
    claims: ["PER-001", "SEC-006"],
    severity: "S2",
    title: "a draft with no usable age is treated as expired",
    environments: ["node"],
  },
  async (ctx) => {
    // The two controls, first: an expiry that expires and one that does not.
    const recent = await afterRoundTrip(HOUR);
    const old = await afterRoundTrip(HOUR, (envelope) => { envelope.savedAt = Date.now() - 2 * HOUR; });
    ctx.log.note("the two honest cases", { recent, old });

    expectEqual(recent, "lorenzo", {
      claimIds: ["PER-001"],
      what: "an honest recent draft was not restored, so nothing below distinguishes expiry from silence",
    });

    expectEqual(old, "", {
      claimIds: ["PER-001"],
      what: "an honest old draft was restored, so the expiry does not work at all and this battle is about something else",
    });

    // And the three envelopes whose age cannot be believed.
    const unbelievable = [
      ["an age in the future", (envelope) => { envelope.savedAt = Date.now() + 24 * HOUR; }],
      ["no age at all", (envelope) => { delete envelope.savedAt; }],
      ["an age that is not a number", (envelope) => { envelope.savedAt = "soon"; }],
    ];

    const survived = [];
    for (const [what, rewrite] of unbelievable) {
      const value = await afterRoundTrip(HOUR, rewrite);
      ctx.log.note("a draft whose age cannot be believed", { what, value });
      if (value !== "") survived.push(what);
    }

    expectEqual(survived, [], {
      claimIds: ["PER-001", "SEC-006"],
      what: `${survived.length} of ${unbelievable.length} drafts outlived an expiry because their age could not be believed: ${JSON.stringify(survived)}`,
    });
  },
);
