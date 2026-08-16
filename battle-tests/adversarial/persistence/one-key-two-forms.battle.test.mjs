/**
 * Two forms, one draft key, and the work that goes missing without a word.
 *
 * A draft key is an identifier a consumer writes. Two live forms holding the same one is not exotic:
 * a component rendered twice, a route that mounts a form beside another, a key copied along with the
 * options it sits in. Nothing about the API makes it look wrong — `draft: { key, storage }` is the
 * whole surface.
 *
 * What happens is that the last save wins the whole envelope. Not a merge and not a refusal: the
 * second form's value replaces the first's, so one person's typing is gone from the only place it was
 * being kept. Reopening the first form restores nothing, because the draft under its key describes
 * fields it does not have — which is the shape gate doing its job on a draft that should never have
 * been there.
 *
 * The engine has everything it needs to notice: it holds the key, the storage, and a diagnostics
 * channel it uses elsewhere for exactly this kind of thing. Measured with `devWarnings` at its
 * default, nothing is said at any level.
 *
 * The control is one form with a key of its own, through the same storage: it saves and restores.
 * Without it, an empty restore below would be a draft that never worked.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Storage a battle owns, with the writes it received in the order they arrived. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 800));
const restored = () => new Promise((resolve) => setTimeout(resolve, 150));

battle(
  {
    claims: ["PER-004"],
    title: "a draft is not replaced by one belonging to another form",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();

    // The control: a form with a key of its own saves what was typed and restores it. Everything
    // below is about a second form arriving, not about drafts working.
    const alone = createForm({ alpha: field("") }, { draft: { key: "alone", storage } });
    alone.f.alpha.set("typed by the only form");
    await saved();
    alone.destroy();

    const aloneAgain = createForm({ alpha: field("") }, { draft: { key: "alone", storage } });
    await restored();
    expectEqual(aloneAgain.getValue().alpha, "typed by the only form", {
      claimIds: ["PER-004"],
      what: "a form with a key of its own did not get its work back, so the draft is not working at all",
    });
    aloneAgain.destroy();

    // Two live forms holding the same key. Diagnostics are captured at their default rather than
    // switched off, because the question is what a consumer is told.
    const said = [];
    const realWarn = console.warn;
    const realError = console.error;
    console.warn = (...parts) => said.push(parts.join(" "));
    console.error = (...parts) => said.push(parts.join(" "));

    let first;
    let second;
    try {
      first = createForm({ alpha: field("") }, { draft: { key: "shared", storage } });
      second = createForm({ beta: field("") }, { draft: { key: "shared", storage } });
      first.f.alpha.set("the first person's answer");
      second.f.beta.set("the second person's answer");
      await saved();
    } finally {
      console.warn = realWarn;
      console.error = realError;
    }

    const envelope = String(storage.written.get("shared") ?? "");
    ctx.log.note("what one key holds after two forms wrote to it", {
      envelope: envelope.slice(0, 120),
      said,
    });

    // Either the collision is reported, or both answers survive. Silence plus one answer is the
    // combination that loses somebody's work without telling anyone.
    expectClaim(said.length > 0 || envelope.includes("the first person's answer"), {
      claimIds: ["PER-004"],
      what: "one form's draft replaced another's, and nothing was said about it",
      detail: () => JSON.stringify({ envelope: envelope.slice(0, 160), said }),
    });

    first.destroy();
    second.destroy();

    // And what the first form gets back when it is opened again.
    const reopened = createForm({ alpha: field("") }, { draft: { key: "shared", storage } });
    await restored();
    ctx.log.note("the first form, reopened", { value: reopened.getValue() });

    expectEqual(reopened.getValue().alpha, "the first person's answer", {
      claimIds: ["PER-004"],
      what: "the first form was reopened and its work was not there",
    });

    reopened.destroy();
  },
);
