/**
 * Two spellings of a bound, one markup, one enforcement.
 *
 * The published schema lets a document say a number's limits in two places: `min` and `max` beside
 * the field, and `min` and `max` inside its `validators`. Both are legitimate, both are in
 * `spec/dynamic-form-v3.schema.json`, and an author choosing between them has nothing to choose on —
 * they produce the same control.
 *
 * They do not produce the same form. The `validators` spelling is a rule: the engine holds the value
 * to it and `constraints()` reports it. The field-level spelling reaches the rendered input's `min`
 * and `max` attributes and stops there, so the browser refuses what a person types and every other
 * way in accepts it.
 *
 * The rendered control is identical either way — measured in the browser tier, both produce
 * `min="0" max="10"` on the input. What differs is `constraints()`, and the second battle here is
 * green on exactly that: it is the one surface a consumer can read to tell which spelling they wrote.
 * Green because it works, and worth holding because it is the only thing standing between an author
 * and the belief that their bound is enforced.
 *
 * Every other way in is the point. The security module states the threat model in its own words:
 * values are attacker-controlled more often than not — pasted text, restored drafts, AI-generated
 * payloads, API prefills. A draft is writable by any script on the origin. Under the field-level
 * spelling a draft carrying `-999` restores into a form that reports itself valid and submittable;
 * under the other one it does not, and nothing about the two documents looks different.
 *
 * Either resolution closes this: the field-level spelling holds the value to the bound too, or the
 * contract says plainly that it is a control hint and not a rule. What cannot stand is two spellings
 * of one sentence that mean different things and render identically.
 */

import { applyFlatValidators, buildFlatFormSchema, createForm, parseDynamicFields } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A form built from one flat field, with its document validators applied. */
function formFor(field) {
  const parsed = parseDynamicFields([field]);
  const form = createForm(buildFlatFormSchema(parsed), { devWarnings: false });
  applyFlatValidators(form, parsed);
  return form;
}

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BESIDE = Object.freeze({ name: "n", kind: "number", label: "N", min: 0, max: 10 });
const INSIDE = Object.freeze({ name: "n", kind: "number", label: "N", validators: { min: 0, max: 10 } });

battle(
  {
    claims: ["DYN-001", "VAL-004"],
    title: "a bound a document declares is one the form holds a value to",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: one of the two spellings does enforce. Without it this reads as "documents cannot
    // express a bound", which is a different and larger claim.
    const inside = formFor(INSIDE);
    try {
      inside.f.n.set(-999);
      expectClaim(!inside.state.valid(), {
        claimIds: ["VAL-004"],
        what: "neither spelling enforces a bound, so this battle is about something larger than the two disagreeing",
      });
    } finally {
      inside.destroy();
    }

    const beside = formFor(BESIDE);
    try {
      const doors = [];
      for (const [door, act] of [
        ["set", (form) => form.f.n.set(-999)],
        ["setValue", (form) => form.setValue({ n: -999 })],
        ["patch", (form) => form.patch({ n: -999 })],
      ]) {
        act(beside);
        doors.push({ door, held: beside.getValue().n, valid: beside.state.valid() });
      }
      ctx.log.note("a value far outside a declared bound, by each door", { doors });

      expectEqual(doors.filter((entry) => entry.valid), [], {
        claimIds: ["DYN-001", "VAL-004"],
        what: "a document declared a number's bounds and the form reports a value far outside them as valid",
        detail: JSON.stringify(doors),
      });
    } finally {
      beside.destroy();
    }
  },
);

battle(
  {
    claims: ["DYN-001", "VAL-004"],
    title: "the constraint a field reports is what tells the two spellings apart",
    environments: ["node"],
  },
  async (ctx) => {
    // Green, and the reason the finding above is bounded: something does tell them apart. The
    // rendered control does not — both put `min="0" max="10"` on the input — but this does.
    const beside = formFor(BESIDE);
    const inside = formFor(INSIDE);
    try {
      const projected = {
        beside: beside.f.n.constraints(),
        inside: inside.f.n.constraints(),
      };
      ctx.log.note("what each spelling reports as its constraint", projected);

      // The spelling that enforces says so.
      expectEqual([projected.inside.min, projected.inside.max], [0, 10], {
        claimIds: ["DYN-001"],
        what: "the spelling that does enforce does not report the bound it enforces",
        detail: JSON.stringify(projected),
      });

      // And the one that does not, does not — so a consumer reading this surface can tell which
      // document they were handed, before a value ever arrives to prove it the hard way.
      expectEqual([projected.beside.min, projected.beside.max], [null, null], {
        claimIds: ["DYN-001"],
        what: "the two spellings report the same constraint, so nothing in the engine distinguishes a bound that holds from one that does not",
        detail: JSON.stringify(projected),
      });
    } finally {
      beside.destroy();
      inside.destroy();
    }
  },
);

battle(
  {
    claims: ["SEC-001", "PER-001", "VAL-004"],
    title: "a draft carrying a value outside a declared bound is refused by the form that reads it",
    environments: ["node"],
  },
  async (ctx) => {
    // The threat model the security module states: a draft is writable by any script on the origin,
    // so what comes back is not something this form produced.
    const outcomes = [];
    for (const [spelling, field] of [["beside the field", BESIDE], ["inside validators", INSIDE]]) {
      const storage = memoryStorage();
      const parsed = parseDynamicFields([field]);
      const open = () => {
        const form = createForm(buildFlatFormSchema(parsed), { devWarnings: false, draft: { key: "k", storage } });
        applyFlatValidators(form, parsed);
        return form;
      };

      const writer = open();
      writer.f.n.set(5);
      await settled(700);
      const envelope = JSON.parse(storage.written.get("k"));
      envelope.value.n = -999;
      storage.written.set("k", JSON.stringify(envelope));
      writer.destroy();

      const reader = open();
      await settled(90);
      outcomes.push({ spelling, restored: reader.getValue().n, valid: reader.state.valid(), canSubmit: reader.state.canSubmit() });
      reader.destroy();
    }
    ctx.log.note("a tampered draft, by spelling", { outcomes });

    // The control: the draft really did carry the value, both times.
    expectClaim(outcomes.every((entry) => entry.restored === -999), {
      claimIds: ["PER-001"],
      what: "the tampered value did not survive the restore, so neither spelling was tested",
      detail: JSON.stringify(outcomes),
    });

    expectEqual(outcomes.filter((entry) => entry.canSubmit), [], {
      claimIds: ["SEC-001", "VAL-004"],
      what: "a draft carrying a value far outside a declared bound restored into a form that reports itself submittable",
      detail: JSON.stringify(outcomes),
    });
  },
);
