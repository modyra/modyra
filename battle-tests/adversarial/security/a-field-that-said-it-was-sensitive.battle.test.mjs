/**
 * A field a document declared sensitive, shown in the panel.
 *
 * The masking rule states why the declaration exists, in its own words:
 *
 *   The name heuristic is a guess, and it is wrong in both directions — `notes` can hold a recovery
 *   phrase and `cardStyle` is masked for containing "card". So a declaration wins wherever there is
 *   one, and the guess only fills the silence.
 *
 * Every part of that works. `sensitive` is a published field property in
 * `spec/dynamic-form-v3.schema.json`, the parser keeps it, the Studio writes it, and
 * `isSensitivePath(path, declared)` honours it. What is missing is the wire between them: nothing
 * turns a document's `sensitive: true` into the `declared` argument, so a snapshot taken the
 * documented way falls back to the guess.
 *
 * `notes` holding a recovery phrase is the example the comment chose, and it is the case that fails:
 * the document says it is sensitive, the name does not look it, and the panel prints it.
 *
 * The mounted panel is the sharper half. `mountMdyDevtools(form, host, intervalMs)` takes no
 * `MdySnapshotOptions` at all, so a consumer who knows about the flag and derives the callback
 * themselves still has nowhere to hand it. Only `mdyFormSnapshot` accepts one.
 */

import { applyFlatValidators, buildFlatFormSchema, createForm, parseDynamicFields } from "@modyra/core";
import { isSensitivePath, mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A phrase nobody should read off a screen they did not have to unlock. */
const SECRET = "correct horse battery staple";

const DOCUMENT = Object.freeze([
  { name: "notes", kind: "text", label: "Notes", sensitive: true },
  { name: "password", kind: "password", label: "Password" },
  { name: "cardStyle", kind: "text", label: "Card style" },
]);

function filledForm() {
  const parsed = parseDynamicFields([...DOCUMENT]);
  const form = createForm(buildFlatFormSchema(parsed), { devWarnings: false });
  applyFlatValidators(form, parsed);
  form.f.notes.set(SECRET);
  form.f.password.set("hunter2");
  form.f.cardStyle.set("blue");
  return { form, parsed };
}

const valueAt = (snapshot, path) => snapshot.fields.find((field) => field.path === path)?.value;

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "the declaration wins where the name says nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // The predicate itself, which is the part that works — asserted so the finding below is the wire
    // and not the rule.
    ctx.log.note("the masking rule on its own", {
      guessedNotes: isSensitivePath("notes"),
      declaredNotes: isSensitivePath("notes", true),
      guessedPassword: isSensitivePath("password"),
      overriddenCardStyle: isSensitivePath("cardStyle", false),
    });

    expectEqual(
      [isSensitivePath("notes"), isSensitivePath("notes", true), isSensitivePath("password"), isSensitivePath("cardStyle", false)],
      [false, true, true, false],
      {
        claimIds: ["SEC-001"],
        what: "the masking rule does not honour a declaration, so the wiring below is not what is missing",
      },
    );

    // And the parser keeps the flag, so a consumer has something to wire.
    const { form, parsed } = filledForm();
    try {
      expectEqual(parsed.find((field) => field.name === "notes")?.sensitive, true, {
        claimIds: ["DYN-001"],
        what: "the parser dropped a field's sensitive flag, which would make this a different finding",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "a field a document called sensitive is not printed in the panel",
    environments: ["node"],
  },
  async (ctx) => {
    const { form, parsed } = filledForm();
    try {
      // The snapshot as it is documented to be taken.
      const snapshot = mdyFormSnapshot(form);
      ctx.log.note("what the panel shows", {
        notes: valueAt(snapshot, "notes"),
        password: valueAt(snapshot, "password"),
        cardStyle: valueAt(snapshot, "cardStyle"),
      });

      // The control: the guess still works for the name that looks like a secret, so a failure below
      // is the declaration being ignored rather than masking being off entirely.
      expectClaim(valueAt(snapshot, "password") !== "hunter2", {
        claimIds: ["SEC-001"],
        what: "the panel prints a field the name heuristic alone should have masked",
      });

      expectClaim(valueAt(snapshot, "notes") !== SECRET, {
        claimIds: ["SEC-001", "DYN-001"],
        what: "a field the document declared sensitive is printed in the panel in full, because nothing carries the declaration to the snapshot",
        detail: JSON.stringify(valueAt(snapshot, "notes")),
      });

      // And the wire a consumer would have to write themselves does work, which is what makes this a
      // missing connection rather than a missing capability.
      const wired = mdyFormSnapshot(form, {
        sensitive: (path) => parsed.find((field) => field.name === path)?.sensitive,
      });
      expectClaim(valueAt(wired, "notes") !== SECRET, {
        claimIds: ["SEC-001"],
        what: "handing the document's own flag to the snapshot does not mask the field either, which is a larger failure",
        detail: JSON.stringify(valueAt(wired, "notes")),
      });
    } finally {
      form.destroy();
    }
  },
);
