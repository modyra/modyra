/**
 * One keystroke on a form the user has not touched yet, and the draft is gone.
 *
 * Two behaviours meet here and each is right on its own. A draft follows the model, so whatever the
 * form holds is what is saved. History starts at the value the form was built with, so the first undo
 * returns there.
 *
 * Together they make the restore itself undoable. A form opened on a draft reports `canUndo` true
 * before the user has done anything, and the one thing that undo can reach is the restore — so a
 * single undo empties the form, the draft follows the model down, and what the user typed in the last
 * session is overwritten with nothing.
 *
 * `redo` brings it back, and that is the whole of the recovery: it lives in memory. Close the tab
 * after the undo and the draft is what the undo left.
 *
 * The control is a form with no draft, which reports `canUndo` false when it opens. So this is the
 * restore being recorded as an edit rather than history being wrong about a fresh form.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 780));
const settled = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

const document = {
  node: "group",
  children: { who: { node: "field", field: { kind: "text", label: "W" } } },
};

const TYPED = "a long answer the user typed";

battle(
  {
    claims: ["PER-002", "PER-001"],
    severity: "S2",
    title: "a restored draft is not something the user can undo having done",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const open = () => createForm(buildDynamicFormSchema(document), {
      draft: { key: "k", storage },
      history: true,
      devWarnings: false,
    });

    // The control: a form with no draft has nothing to undo when it opens.
    const fresh = createForm(buildDynamicFormSchema(document), { history: true, devWarnings: false });
    await settled();
    ctx.log.note("a form with no draft, just opened", { canUndo: fresh.canUndo() });

    expectEqual(fresh.canUndo(), false, {
      claimIds: ["PER-002"],
      what: "a form with no draft reports something to undo before anybody touched it, so nothing below is about the restore",
    });
    fresh.destroy();

    // A session that typed something and left.
    const first = open();
    first.f.who.set(TYPED);
    await saved();
    first.destroy();

    expectClaim(String(storage.written.get("k")).includes(TYPED), {
      claimIds: ["PER-001"],
      what: "the draft does not hold what was typed, so nothing below is about losing it",
    });

    // The next session opens it.
    const second = open();
    await settled();
    ctx.log.note("the form as the user finds it", {
      value: second.getValue(),
      canUndo: second.canUndo(),
    });

    expectEqual(second.getValue().who, TYPED, {
      claimIds: ["PER-001"],
      what: "the draft did not come back",
    });

    expectEqual(second.canUndo(), false, {
      claimIds: ["PER-002"],
      what: "a form opened on a draft offers to undo the restore, which is not something the user did",
    });

    // And what that offer costs if it is taken.
    second.undo();
    await saved();
    const afterUndo = {
      model: second.getValue().who,
      draft: String(storage.written.get("k")),
      canRedo: second.canRedo(),
    };
    ctx.log.note("after one undo", afterUndo);

    expectClaim(afterUndo.draft.includes(TYPED), {
      claimIds: ["PER-001", "PER-002"],
      what: "one undo on a freshly opened form overwrote the saved draft with the value it undid to",
      detail: JSON.stringify(afterUndo),
    });

    second.destroy();
  },
);
