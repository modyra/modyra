/**
 * Every door external data comes through, fed a path that is not one.
 *
 * A record key arrives from a server. A document arrives from a CMS or a model. A patch arrives from
 * a save handler. A draft arrives from `localStorage`, which every script on the origin can write.
 * Each of those is a place where `__proto__` can be spelled, and the promise is that none of them
 * registers a field, mutates a prototype, or half-declares something.
 */

import { assertSafeDynamicFieldNames, isSafeFieldPath, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** Spellings that mean something to JavaScript, and things that only look dangerous. */
const HOSTILE = Object.freeze([
  "__proto__",
  "prototype",
  "constructor",
  "x.__proto__.y",
  "",
  "a.b",
]);

const CONFUSABLE = Object.freeze([
  "０", // fullwidth digit zero
  "аdmin", // Cyrillic а
  "  ",
  "x".repeat(512),
]);

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

battle(
  {
    claims: ["SEC-001", "COL-001"],
    title: "unsafe segments register nothing, wherever they arrive from",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { devWarnings: false });

    // ── Ingress 1: a record key ───────────────────────────────────────────────
    for (const key of HOSTILE) {
      await context.execute({ type: "record.upsert", path: "rows", key, value: { code: "x" } });
    }
    const afterKeys = context.observe("hostile keys through upsert");

    expectClaim(afterKeys.collections[0].keys.every((key) => isSafeFieldPath(`rows.${key}`)), {
      claimIds: ["SEC-001"],
      what: "no declared key produces an unsafe path",
      detail: afterKeys.collections[0].keys.join(" | "),
    });
    expectClaim(afterKeys.fieldNames.every((name) => isSafeFieldPath(name)), {
      claimIds: ["SEC-001"],
      what: "no unsafe field was registered",
      detail: afterKeys.fieldNames.join(", "),
    });
    expectClaim({}.polluted === undefined && Object.prototype.code === undefined, {
      claimIds: ["SEC-001"],
      what: "no prototype was mutated by a hostile key",
    });

    // ── Ingress 2: a flat patch ───────────────────────────────────────────────
    context.form.patch({ rows: { __proto__: { code: "polluted" }, "x.y": { code: "nested" } } });
    const afterPatch = context.observe("hostile keys through patch");
    expectClaim(afterPatch.fieldNames.every((name) => isSafeFieldPath(name)), {
      claimIds: ["SEC-001"],
      what: "a patch cannot register an unsafe path",
      detail: afterPatch.fieldNames.join(", "),
    });
    expectClaim(Object.prototype.code === undefined, {
      claimIds: ["SEC-001"],
      what: "Object.prototype was not given a member by a patch",
    });

    // ── Ingress 3: a document ─────────────────────────────────────────────────
    for (const name of HOSTILE) {
      const parsed = parseDynamicForm({
        version: 2,
        id: "hostile",
        fields: [{ kind: "text", name, label: "Hostile" }],
      });
      const accepted = parsed.fields.some((field) => field.name === name);
      expectClaim(!accepted || isSafeFieldPath(name), {
        claimIds: ["SEC-001"],
        what: `a document naming ${JSON.stringify(name)} must be refused, not accepted`,
        detail: JSON.stringify(parsed.diagnostics),
      });
      expectClaim(accepted || parsed.diagnostics.length > 0, {
        claimIds: ["SEC-001"],
        what: `refusing ${JSON.stringify(name)} says why`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

    // The author-time guard is the same answer at a different moment.
    for (const name of HOSTILE.filter((each) => !isSafeFieldPath(each))) {
      let refused = false;
      try {
        assertSafeDynamicFieldNames([{ kind: "text", name, label: "Hostile" }]);
      } catch {
        refused = true;
      }
      expectClaim(refused, {
        claimIds: ["SEC-001"],
        what: `the author-time check refuses ${JSON.stringify(name)} too`,
      });
    }

    // ── Ingress 4: a restored draft ───────────────────────────────────────────
    const stored = new Map();
    stored.set(
      "hostile-draft",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        value: { rows: { ok: { code: "fine" } }, polluted: true, __proto__: { code: "polluted" } },
      }),
    );
    const storage = {
      read: (key) => stored.get(key) ?? null,
      write: (key, value) => stored.set(key, value),
      remove: (key) => stored.delete(key),
    };

    const restored = ctx.open(SPEC, { draft: { key: "hostile-draft", storage }, devWarnings: false });
    const draftState = restored.observe("hostile draft restored");

    expectClaim(draftState.fieldNames.every((name) => isSafeFieldPath(name)), {
      claimIds: ["SEC-001"],
      what: "a draft cannot register an unsafe path",
      detail: draftState.fieldNames.join(", "),
    });
    expectClaim({}.polluted === undefined && Object.prototype.code === undefined, {
      claimIds: ["SEC-001"],
      what: "a restored draft did not reach a prototype",
    });

    // ── Confusables and long segments: legal, and treated as data ─────────────
    for (const key of CONFUSABLE) {
      await context.execute({ type: "record.upsert", path: "rows", key, value: { code: "x" } });
    }
    const afterConfusable = context.observe("confusable keys");
    expectClaim(afterConfusable.fieldNames.every((name) => isSafeFieldPath(name)), {
      claimIds: ["SEC-001"],
      what: "a legal but unusual key stays a key",
      detail: afterConfusable.collections[0].keys.join(" | "),
    });
  },
);
