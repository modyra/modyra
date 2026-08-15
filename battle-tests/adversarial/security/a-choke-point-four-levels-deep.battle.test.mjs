/**
 * The single write choke point, tested where a form is deepest.
 *
 * The security module states how it is wired: "the form engine wires it at the single write choke
 * point (the field value signal) so every entry path — user input, `patch`/`setValue`, draft restore,
 * array operations — is covered by construction." *By construction* is the interesting phrase, because
 * it is a claim about a shape of code, and the way such a claim fails is that some path turns out not
 * to go through the point after all.
 *
 * A collection is where that is most likely: declaring a row writes a whole subtree at once, and a
 * nested row writes one inside another. `spec/fixtures/dynamic-form/v3/nested-collections.json` is the
 * deepest shape the project publishes — a keyed map of orders, each holding a keyed map of lines, each
 * holding a list of allocations — so every door is opened against that rather than against a flat
 * field.
 *
 * The last case is the one the module's own threat model names: a draft is written by a form with no
 * policy and read back by a form that has one. localStorage is writable by any script on the origin,
 * so the value arriving is not one this form ever produced, and the only thing standing between it and
 * the value is the point being where it is claimed to be.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { applyValueSecurity, buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const FIXTURE = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form", "v3", "nested-collections.json");

/** A string that must never survive a strict policy intact. */
const PAYLOAD = '<script>alert(1)</script>hello';

const document = () => JSON.parse(readFileSync(FIXTURE, "utf8"));

const opened = (options = {}) =>
  createForm(buildDynamicFormSchema(document().schema), {
    devWarnings: false,
    security: { sanitize: "strict" },
    ...options,
  });

/** Whether anything the form holds still reads as markup. */
const survives = (form) => JSON.stringify(form.getValue()).includes("<script>");

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

battle(
  {
    claims: ["SEC-002", "COL-003"],
    title: "every way into a nested collection goes through the write choke point",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the pure unit does strip this, and it does so at depth. A payload it left alone
    // would make every assertion below true without the engine doing anything.
    const unit = applyValueSecurity({ a: { b: [{ c: PAYLOAD }] } }, { sanitizer: "strict" });
    expectClaim(!JSON.stringify(unit.value).includes("<script>"), {
      claimIds: ["SEC-002"],
      what: "the sanitizer leaves a payload nested three deep untouched, so nothing below is measurable",
      detail: JSON.stringify(unit),
    });

    // And the other control: with no policy the payload does survive, so each door below is being
    // closed by the policy rather than by something else in the engine.
    const unguarded = createForm(buildDynamicFormSchema(document().schema), { devWarnings: false });
    unguarded.f.orders.upsert("A", { customer: PAYLOAD, lines: {} });
    expectClaim(survives(unguarded), {
      claimIds: ["SEC-002"],
      what: "a form with no policy already refuses the payload, so the policy is not what the doors below are testing",
    });
    unguarded.destroy();

    const doors = {
      "a cell set four levels down": (form) => {
        form.f.orders.upsert("A");
        form.f.orders.row("A").lines.upsert("L");
        form.f.orders.row("A").lines.row("L").allocations.push();
        form.f.orders.row("A").lines.row("L").allocations.at(0).warehouse.set(PAYLOAD);
      },
      "a row declared with a whole value": (form) => form.f.orders.upsert("A", { customer: PAYLOAD, lines: {} }),
      "a nested row declared with a value": (form) => {
        form.f.orders.upsert("A");
        form.f.orders.row("A").lines.upsert("L", { sku: PAYLOAD, allocations: [] });
      },
      "record.patch": (form) => form.f.orders.patch({ A: { customer: PAYLOAD, lines: {} } }),
      "record.setAll": (form) => form.f.orders.setAll({ A: { customer: PAYLOAD, lines: {} } }),
      "a list written whole, three levels in": (form) => {
        form.f.orders.upsert("A");
        form.f.orders.row("A").lines.upsert("L");
        form.f.orders.row("A").lines.row("L").allocations.setAll([{ warehouse: PAYLOAD, qty: 1 }]);
      },
      "setValue over the whole form": (form) =>
        form.setValue({ orders: { A: { customer: PAYLOAD, lines: {} } }, shipments: [] }),
    };

    const leaked = [];
    for (const [what, open] of Object.entries(doors)) {
      const form = opened();
      try {
        open(form);
        if (survives(form)) leaked.push({ what, value: JSON.stringify(form.getValue()).slice(0, 120) });
      } finally {
        form.destroy();
      }
    }
    ctx.log.note("doors opened against the deepest published shape", { tried: Object.keys(doors).length, leaked });

    expectEqual(leaked, [], {
      claimIds: ["SEC-002", "COL-003"],
      what: "a way into a nested collection reaches the value without passing the choke point",
    });
  },
);

battle(
  {
    claims: ["SEC-002", "PER-001"],
    title: "a draft written without a policy is sanitized by the form that reads it",
    environments: ["node"],
  },
  async (ctx) => {
    // The module's own threat model: localStorage is writable by any script on the origin, so what
    // comes back is not something this form ever produced. The draft is written by a form with no
    // policy rather than hand-built, so what is restored is an envelope the engine itself made.
    const storage = memoryStorage();
    const draft = { key: "nested", storage };

    const writer = createForm(buildDynamicFormSchema(document().schema), { devWarnings: false, draft });
    writer.f.orders.upsert("A", { customer: PAYLOAD, lines: {} });
    await settled(700);
    const envelope = storage.written.get("nested");
    writer.destroy();

    // The control: the payload really is in the draft. A draft that never held it would make the
    // restore below clean for the wrong reason.
    expectClaim(typeof envelope === "string" && envelope.includes("<script>"), {
      claimIds: ["PER-001"],
      what: "the draft does not carry the payload, so the restore below proves nothing",
      detail: String(envelope).slice(0, 160),
    });

    const reader = opened({ draft });
    await settled(80);
    ctx.log.note("what a policy-carrying form restored", { value: JSON.stringify(reader.getValue()).slice(0, 140) });

    try {
      expectClaim(!survives(reader), {
        claimIds: ["SEC-002", "PER-001"],
        what: "a draft carrying markup was restored into a form whose policy forbids it",
        detail: JSON.stringify(reader.getValue()),
      });

      // And what came back is the same row rather than nothing: sanitizing is not dropping.
      expectClaim(reader.f.orders.keys().includes("A"), {
        claimIds: ["PER-001"],
        what: "the restored row was discarded rather than sanitized",
        detail: JSON.stringify(reader.getValue()),
      });
    } finally {
      reader.destroy();
    }
  },
);
