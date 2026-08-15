/**
 * A draft thrown away, and a change set that still remembers it.
 *
 * `clearDraft()` is documented as two things at once: it removes the stored draft, **and it
 * re-baselines against the current value**. The second half is what makes it usable in the place it
 * is meant for — a consumer who has just saved, or who has decided the draft is stale, and wants the
 * form to stop calling the current values "changes".
 *
 * The first half holds; the second does not. After `clearDraft()`, `getChanges()` still reports
 * every field the user edited, so a `PATCH` built from it sends what the consumer just decided to
 * discard.
 *
 * The engine already has the mechanism: `setInitialValue` moves the baseline and `getChanges()`
 * empties, which is the control here. This is not "there is no way to re-baseline" — it is one
 * documented caller not doing it.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    a: Object.freeze({ kind: "text", initial: "one" }),
    b: Object.freeze({ kind: "text", initial: "two" }),
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
const open = (options) => createForm(buildSchema(SPEC).schema, { reactivity: vanillaReactivity(), devWarnings: false, ...options });

battle(
  {
    claims: ["PER-001", "SUB-001"],
    title: "discarding a draft stops the form calling those values changes",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const form = open({ draft: { key: "d", storage, debounceMs: 10 } });
    form.f.a.set("edited");
    await saved();

    // The control: before the discard, the edit is a change, which is what makes the assertion
    // below about the discard rather than about a change set that is always empty.
    expectEqual(form.getChanges(), { a: "edited" }, {
      claimIds: ["SUB-001"],
      what: "an edited field was not reported as a change before anything was discarded",
    });

    form.clearDraft();
    const afterDiscard = form.getChanges();
    ctx.log.note("the change set after discarding the draft", {
      stored: storage.written.has("d"),
      afterDiscard,
    });

    // The half that holds.
    expectEqual(storage.written.has("d"), false, {
      claimIds: ["PER-001"],
      what: "clearDraft left the stored draft where it was",
    });

    // And the half that is documented in the same sentence: a PATCH built from this sends what the
    // consumer has just decided to discard.
    expectEqual(afterDiscard, {}, {
      claimIds: ["PER-001", "SUB-001"],
      what: "clearDraft did not re-baseline, so the discarded values are still reported as changes",
      detail: JSON.stringify(afterDiscard),
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["SUB-001"],
    title: "moving the baseline empties the change set",
    environments: ["node"],
  },
  async (ctx) => {
    // The mechanism exists and works through its other caller, which is what makes the battle above
    // about `clearDraft` rather than about re-baselining being unimplemented.
    const form = open({});
    form.f.a.set("edited");
    expectEqual(form.getChanges(), { a: "edited" }, {
      claimIds: ["SUB-001"],
      what: "an edited field was not reported as a change",
    });

    form.setInitialValue("a", "edited");
    ctx.log.note("the baseline moved to the current value", { changes: form.getChanges() });

    expectEqual(form.getChanges(), {}, {
      claimIds: ["SUB-001"],
      what: "moving the baseline onto the current value left the field reported as changed",
    });

    // And the new baseline is where a reset lands, so it is the baseline rather than a suppressed
    // comparison.
    form.f.a.set("edited again");
    form.reset();
    expectEqual(form.getValue().a, "edited", {
      claimIds: ["SUB-001"],
      what: "reset did not return to the baseline that was moved",
    });

    form.destroy();
  },
);
