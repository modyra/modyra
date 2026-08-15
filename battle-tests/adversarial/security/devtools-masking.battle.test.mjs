/**
 * A panel that hides a value and prints it in the next column.
 *
 * `docs/guides/devtools.md` states it plainly: values of fields whose path looks sensitive are
 * replaced with `•••`, in both the table and the JSON view. `mdyFormSnapshot` is what produces both,
 * and it is exported for programmatic use — a consumer logs it, ships it to a session recorder, or
 * renders it themselves.
 *
 * It masks the value and carries the field's errors verbatim. An error message is written by whoever
 * wrote the validator or by whatever the server sent back, and the most ordinary way to write one is
 * to quote what was rejected: `"hunter2" is not long enough`, `token tok_live_… was revoked`. So the
 * value is bulleted in one column and readable in the next, on the same row, in the same panel.
 *
 * Masking a value while printing something that contains it does not mask the value. That is the
 * whole claim, and it is why the check is "is the secret anywhere in this snapshot" rather than "is
 * the value field a string of bullets".
 */

import { createForm, field } from "@modyra/core";
import { isSensitivePath, mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SECRET = "hunter2-the-actual-password";
const TOKEN = "tok_live_9f3a2b";

battle(
  {
    claims: ["SEC-002"],
    title: "a masked value is not readable through the error printed beside it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the path is one the heuristic recognises, so what follows is about the error
    // rather than about a field the panel was never going to mask.
    expectClaim(isSensitivePath("password") && isSensitivePath("token"), {
      claimIds: ["SEC-002"],
      what: "the paths this battle uses are not the ones the heuristic masks",
    });

    // A validator that quotes what it rejected. Nothing unusual about it — it is how a message that
    // helps the user is written.
    const quoting = (value) => (value && value.length < 40 ? [`"${value}" is not long enough`] : []);
    const form = createForm({ password: field(SECRET, [quoting]) }, { devWarnings: false });

    try {
      const snapshot = mdyFormSnapshot(form);
      const row = snapshot.fields.find((each) => each.path === "password");
      ctx.log.note("a sensitive field whose validator quotes it", { value: row?.value });

      expectEqual(row.value, "•••", {
        claimIds: ["SEC-002"],
        what: "the sensitive value was not replaced at all",
      });

      // The control for the leak: the error has to be there, or the assertion below passes because
      // nothing was reported rather than because nothing leaked.
      expectClaim(row.errors.length > 0, {
        claimIds: ["SEC-002"],
        what: "the field reported no error, so there is nothing to leak through",
      });

      expectClaim(!JSON.stringify(snapshot).includes(SECRET), {
        claimIds: ["SEC-002"],
        what: "the masked value is readable in the same snapshot, through its own error",
        detail: JSON.stringify(row.errors),
      });
    } finally {
      form.destroy();
    }

    // The same door from the other side: a server that names what it rejected. A consumer does not
    // write this message and cannot redact it before the panel reads it.
    const fromServer = createForm({ token: field(TOKEN) }, {
      validators: [() => [{ path: "token", kind: "schema", message: `token ${TOKEN} was revoked` }]],
      devWarnings: false,
    });

    try {
      const snapshot = mdyFormSnapshot(fromServer);
      const row = snapshot.fields.find((each) => each.path === "token");
      ctx.log.note("a sensitive field whose server error names it", { value: row?.value });

      expectEqual(row.value, "•••", {
        claimIds: ["SEC-002"],
        what: "the sensitive value was not replaced at all",
      });

      expectClaim(!JSON.stringify(snapshot).includes(TOKEN), {
        claimIds: ["SEC-002"],
        what: "a server error carried the masked value into the panel",
        detail: JSON.stringify(row.errors),
      });
    } finally {
      fromServer.destroy();
    }
  },
);

battle(
  {
    claims: ["SEC-002"],
    title: "a file in a snapshot says which file it is",
    environments: ["node"],
  },
  async (ctx) => {
    // The guide promises file *metadata* in both views: `[File: name (size)]`, never contents. The
    // panel renders that itself; this asks what the exported snapshot hands a consumer who renders
    // it their own way, which the same section documents as a supported use.
    const form = createForm({ docs: field([new File(["THE-CONTENTS"], "cv.pdf")]) }, { devWarnings: false });

    try {
      const snapshot = mdyFormSnapshot(form);
      const row = snapshot.fields.find((each) => each.path === "docs");
      const asJson = JSON.stringify(snapshot);
      ctx.log.note("a file in a snapshot", { rendered: asJson.length });

      // The half that holds, and the reason the promise exists: the bytes are not in it.
      expectClaim(!asJson.includes("THE-CONTENTS"), {
        claimIds: ["SEC-002"],
        what: "a file's contents reached the snapshot",
      });

      // And the half the guide also promises: the JSON view says which file it was. A live `File`
      // stringifies to `{}`, which is indistinguishable from a field nobody filled.
      expectClaim(asJson.includes("cv.pdf"), {
        claimIds: ["SEC-002"],
        what: "a file in the JSON view is an empty object rather than its name and size",
        detail: JSON.stringify(row.value),
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["SEC-002"],
    title: "a declaration decides what the panel masks, and the guess only fills the silence",
    environments: ["node"],
  },
  async (ctx) => {
    // The name heuristic is stated as a guess, in its own contract's words: *it is wrong in both
    // directions — `notes` can hold a recovery phrase and `cardStyle` is masked for containing
    // "card". So a declaration wins wherever there is one.*
    //
    // That sentence is what makes the guess acceptable, and it is the part worth holding: the guess
    // may be widened or narrowed at any time and nobody would notice, but a declaration that stopped
    // winning would leave a consumer with no way to correct either kind of error.
    const cases = [
      ["a field the guess would not mask, declared sensitive", "notes", true, true],
      ["the same field declared not sensitive", "notes", false, false],
      ["the same field with nothing declared", "notes", undefined, false],
      ["a field the guess masks, declared not sensitive", "password", false, false],
      ["the same field declared sensitive", "password", true, true],
      ["the same field with nothing declared", "password", undefined, true],
      ["the guess's own stated false positive", "cardStyle", undefined, true],
      ["and that false positive, corrected", "cardStyle", false, false],
    ];

    for (const [what, path, declared, masked] of cases) {
      const answer = isSensitivePath(path, declared);
      ctx.log.note("what the panel would do", { what, path, declared, masked: answer });
      expectClaim(answer === masked, {
        claimIds: ["SEC-002"],
        what: `${what}: the panel would ${answer ? "mask" : "show"} it`,
        detail: JSON.stringify({ path, declared, expected: masked }),
      });
    }
  },
);
