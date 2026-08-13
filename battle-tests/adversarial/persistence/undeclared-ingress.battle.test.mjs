/**
 * A key the schema never declared, arriving as data.
 *
 * `patch()` takes a partial value from wherever a consumer got one — a server response, a save
 * handler, a restored draft. `getValue()` promises `MdyFormValue<S>`: the shape the schema declares.
 * Both cannot be true if a key outside the schema can enter through the first and leave through the
 * second, and `setValue()` — the sibling that takes a whole value — already refuses exactly that.
 *
 * The draft door is the one that matters: `docs/guides/security.md` states that the default storage
 * is plain text and readable, and writable, by every script on the origin.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({ name: Object.freeze({ kind: "text" }) }),
});

/** What a form answers, and whether answering threw. */
function readBoth(form) {
  const out = {};
  try {
    out.value = form.getValue();
  } catch (error) {
    out.valueError = error.message;
  }
  try {
    out.submitted = form.submitValue();
  } catch (error) {
    out.submittedError = error.message;
  }
  return out;
}

battle(
  {
    claims: ["SUB-001", "SEC-001"],
    title: "an undeclared key in a patch neither joins the value nor breaks the reads",
    environments: ["node"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { devWarnings: false });
    ctx.log.note("patch with an undeclared key", { key: "evil" });

    context.form.patch({ evil: 1 });

    const after = readBoth(context.form);
    ctx.attach("afterPatch", after);

    expectClaim(after.submittedError === undefined, {
      claimIds: ["SUB-001"],
      what: "reading the submitted value still works after a patch carrying an undeclared key",
      detail: after.submittedError ?? "",
    });
    expectClaim(!("evil" in (after.value ?? {})), {
      claimIds: ["SUB-001", "SEC-001"],
      what: "the value a consumer reads holds only what the schema declares",
      detail: JSON.stringify(after.value),
    });
    expectClaim(!context.form.fieldNames().includes("evil"), {
      claimIds: ["SEC-001"],
      what: "no field was registered for a key outside the schema",
      detail: context.form.fieldNames().join(", "),
    });
  },
);

battle(
  {
    claims: ["PER-001", "SEC-001", "SUB-001"],
    title: "a draft written by someone else cannot add fields to a form",
    environments: ["node"],
  },
  async (ctx) => {
    // A draft as an attacker with write access to the origin's storage would leave it: valid JSON,
    // correct envelope, one key the schema never declared.
    const payload = JSON.stringify({
      __mdyDraft: 1,
      savedAt: Date.now(),
      value: { name: "restored", evil: 1 },
    });
    const stored = new Map([["hostile", payload]]);
    const storage = {
      read: (key) => stored.get(key) ?? null,
      write: (key, value) => stored.set(key, value),
      remove: (key) => stored.delete(key),
    };
    ctx.log.note("restoring a hostile draft", { payload });

    const form = createForm({ name: field("") }, { draft: { key: "hostile", storage }, devWarnings: false });

    try {
      const after = readBoth(form);
      ctx.attach("afterRestore", after);

      expectClaim(after.submittedError === undefined, {
        claimIds: ["PER-001", "SUB-001"],
        what: "a restored draft leaves the form readable",
        detail: after.submittedError ?? "",
      });
      expectClaim(!("evil" in (after.value ?? {})), {
        claimIds: ["PER-001", "SEC-001"],
        what: "a draft restores what the schema declares and nothing else",
        detail: JSON.stringify(after.value),
      });
      expectClaim(after.value?.name === "restored", {
        claimIds: ["PER-001"],
        what: "and it does restore what the schema does declare",
        detail: JSON.stringify(after.value),
      });
    } finally {
      form.destroy();
    }
  },
);
