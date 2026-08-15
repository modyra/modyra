/**
 * A security policy changes a value. Everything that remembers values has to remember that one.
 *
 * Sanitising and truncating are transformations: the value the user typed is not the value the form
 * keeps. Three things in the engine remember values for later — history, drafts, and the change set —
 * and each is a separate answer to the question *which* value it remembers.
 *
 * Getting it wrong is quiet and it undoes the policy. History that recorded the typed value hands the
 * markup back on the next undo. A draft that saved it restores it on the next visit. A change set
 * that compared against it reports a change nobody made, or hides one they did.
 *
 * None of them is wrong, and none of them is asserted anywhere. Each is a composition of two features
 * that are correct on their own, which is where this campaign's sharper findings have come from — so
 * the value of holding it is that it stays true while both halves keep moving.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
const saved = () => new Promise((resolve) => setTimeout(resolve, 760));

/** Markup that is inert once its angle brackets are gone. */
const MARKUP = '<img src=x onerror="alert(1)">';
const carriesMarkup = (value) => /[<>]/.test(String(value));

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

battle(
  {
    claims: ["SEC-003", "PER-002"],
    title: "undo brings back the value the form kept, not the one the policy refused",
    environments: ["node"],
  },
  async (ctx) => {
    const sanitising = createForm(
      { a: field("clean") },
      { history: true, security: { sanitize: "strict" }, devWarnings: false },
    );
    sanitising.f.a.set(MARKUP);
    await settled();
    const kept = sanitising.getValue().a;

    // The control: the policy did something, so the undo below is about which value was remembered
    // rather than about a policy that never ran.
    expectClaim(!carriesMarkup(kept) && kept !== MARKUP, {
      claimIds: ["SEC-003"],
      what: "the sanitiser did not change the value, so nothing below is about what was remembered",
      detail: JSON.stringify(kept),
    });

    sanitising.f.a.set("after");
    await settled();
    sanitising.undo();
    await settled();
    const afterUndo = sanitising.getValue().a;
    ctx.log.note("what one undo brought back", { kept, afterUndo });
    sanitising.destroy();

    expectEqual(afterUndo, kept, {
      claimIds: ["SEC-003", "PER-002"],
      what: "undo brought back a value the sanitiser had already refused",
    });

    // The same for a length the policy cut. A history that recorded the typed value would hand back
    // fifty characters where the policy keeps ten.
    const truncating = createForm(
      { a: field("short") },
      { history: true, security: { maxValueLength: 10 }, devWarnings: false },
    );
    truncating.f.a.set("x".repeat(40));
    await settled();
    const cut = truncating.getValue().a;
    truncating.f.a.set("after");
    await settled();
    truncating.undo();
    await settled();
    const cutAfterUndo = truncating.getValue().a;
    truncating.destroy();
    ctx.log.note("a length the policy cut, through history", { cut, cutAfterUndo });

    expectEqual([cut.length, cutAfterUndo], [10, cut], {
      claimIds: ["SEC-003", "PER-002"],
      what: "undo brought back a value longer than the policy allows",
    });
  },
);

battle(
  {
    claims: ["SEC-003", "PER-001", "SUB-001"],
    title: "a draft and a change set remember the value the policy left",
    environments: ["node"],
  },
  async (ctx) => {
    // A draft is the other time machine, and it crosses a process rather than a step.
    const storage = memoryStorage();
    const options = { security: { sanitize: "strict" }, draft: { key: "d", storage }, devWarnings: false };

    const writing = createForm({ a: field("") }, options);
    writing.f.a.set(MARKUP);
    await settled();
    const held = writing.getValue().a;
    await saved();
    const envelope = String(storage.written.get("d"));
    writing.destroy();
    ctx.log.note("what the draft was given", { held, envelope: envelope.slice(0, 90) });

    expectClaim(!carriesMarkup(envelope), {
      claimIds: ["SEC-003", "PER-001"],
      what: "the draft on disk carries the markup the form refused to hold",
      detail: envelope.slice(0, 160),
    });

    const reopened = createForm({ a: field("") }, options);
    await settled(200);
    const restored = reopened.getValue().a;
    reopened.destroy();

    expectEqual(restored, held, {
      claimIds: ["SEC-003", "PER-001"],
      what: "reopening a draft brought back something other than what the form had kept",
    });

    // And the change set, at the edge where the policy turns a write back into the initial. What the
    // user typed is not the question a change set answers; what the form holds is.
    const unchanged = createForm({ a: field("xxxxxxxxxx") }, { security: { maxValueLength: 10 }, devWarnings: false });
    unchanged.f.a.set("x".repeat(40));
    await settled();
    ctx.log.note("a write the policy cut back to the initial", {
      value: unchanged.getValue().a,
      changes: unchanged.getChanges(),
      dirty: unchanged.f.a.dirty(),
    });

    expectEqual([unchanged.getChanges(), unchanged.f.a.dirty()], [{}, false], {
      claimIds: ["SUB-001"],
      what: "a write the policy cut back to the initial value was reported as a change",
    });

    unchanged.destroy();

    // The control for it: a write the policy leaves different *is* a change, so the empty answer
    // above is the edge rather than a change set that reports nothing.
    const changed = createForm({ a: field("abc") }, { security: { maxValueLength: 10 }, devWarnings: false });
    changed.f.a.set("x".repeat(40));
    await settled();
    expectEqual(changed.getChanges(), { a: "xxxxxxxxxx" }, {
      claimIds: ["SUB-001"],
      what: "a write the policy cut to something new was not reported as a change",
    });
    changed.destroy();
  },
);
