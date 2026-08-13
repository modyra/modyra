/**
 * A key that looks like an index is still a key.
 *
 * `"0"`, `"01"` and `"4294967295"` are the keys a real system produces — entity ids, line numbers,
 * a provisional `tmp:1` beside them. Every boundary that serialises a form is a place where such a
 * collection can come back as an array, and where `"01"` can come back as `"1"`: a flat patch, a
 * draft, an undo, a document parsed from JSON.
 */

import { buildDynamicFormSchema, createForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";
import { encodeValue } from "../../models/observations.mjs";

const KEYS = Object.freeze(["0", "1", "01", "12", "4294967295", "tmp:1"]);

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

const rowsOf = (keys) => Object.fromEntries(keys.map((key) => [key, { code: `code-${key}` }]));

/**
 * The order a JavaScript object actually hands over.
 *
 * Integer-like keys come first, ascending, whatever order the literal was written in — so
 * `{"0":…, "01":…}` iterates `0, 01` but `{"1":…, "01":…}` iterates `1, 01`. That is the language,
 * not the form: an expectation written against the literal's order would report a break Modyra did
 * not cause. What is Modyra's to keep is that the order it was given is the order it declares.
 */
const givenOrder = (keys) => Object.keys(rowsOf(keys));

/** A record encodes as a tagged object; an array encodes as a JS array. The two cannot be confused. */
function shapeOf(encoded) {
  if (Array.isArray(encoded)) return "array";
  if (encoded && encoded.$mdy === "object") return "object";
  return typeof encoded;
}

battle(
  {
    claims: ["COL-004", "DYN-002", "PER-001", "PER-002"],
    title: "numeric record keys stay object keys across every boundary",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    // ── The typed schema ──────────────────────────────────────────────────────
    const typed = ctx.open(SPEC);
    await typed.execute({ type: "record.setAll", path: "rows", value: rowsOf(KEYS) });

    const declared = typed.observe("typed setAll");
    expectClaim(shapeOf(declared.value.of.rows) === "object", {
      claimIds: ["COL-004"],
      what: "a keyed collection is an object, not an array",
      detail: shapeOf(declared.value.of.rows),
    });
    expectClaim(declared.collections[0].keys.join("|") === givenOrder(KEYS).join("|"), {
      claimIds: ["COL-002", "COL-004"],
      what: "the collection declares the keys it was given, in that order and unrewritten",
      detail: `${declared.collections[0].keys.join("|")} vs ${givenOrder(KEYS).join("|")}`,
    });
    expectClaim(declared.fieldNames.includes("rows.01.code") && declared.fieldNames.includes("rows.0.code"), {
      claimIds: ["COL-004"],
      what: '"0" and "01" are two different rows',
      detail: declared.fieldNames.join(", "),
    });

    // ── A flat patch ─────────────────────────────────────────────────────────
    typed.form.patch({ rows: { "007": { code: "code-007" } } });
    const patched = typed.observe("flat patch");
    expectClaim(shapeOf(patched.value.of.rows) === "object", {
      claimIds: ["COL-004"],
      what: "a flat patch does not turn the collection into an array",
      detail: shapeOf(patched.value.of.rows),
    });
    expectClaim(patched.collections[0].keys.includes("007"), {
      claimIds: ["COL-004"],
      what: 'a patched key keeps its leading zero ("007" is not 7)',
      detail: patched.collections[0].keys.join("|"),
    });

    // ── The document contract ────────────────────────────────────────────────
    const document = {
      version: 3,
      id: "numeric-keys",
      schema: {
        node: "group",
        children: {
          rows: {
            node: "record",
            item: { node: "group", children: { code: { node: "field", field: { kind: "text", label: "Code" } } } },
            initialValue: rowsOf(KEYS),
          },
        },
      },
    };

    const parsed = parseDynamicForm(document);
    ctx.log.note("parsed dynamic document", { ok: parsed.ok, collections: parsed.collections });

    expectClaim(parsed.ok, {
      claimIds: ["DYN-002"],
      what: "a document declaring numeric record keys parses",
      detail: JSON.stringify(parsed.diagnostics),
    });
    expectClaim(parsed.collections?.some((each) => each.path === "rows" && each.kind === "record"), {
      claimIds: ["DYN-002"],
      what: "the parse result says the collection is keyed, which its flat paths cannot",
      detail: JSON.stringify(parsed.collections),
    });

    const dynamicForm = createForm(buildDynamicFormSchema(document.schema));
    try {
      const dynamicValue = encodeValue(dynamicForm.getValue(), "value");
      expectClaim(shapeOf(dynamicValue.of.rows) === "object", {
        claimIds: ["DYN-002", "COL-004"],
        what: "a document-built collection is an object",
        detail: shapeOf(dynamicValue.of.rows),
      });
      expectClaim(dynamicValue.of.rows.keys.join("|") === givenOrder(KEYS).join("|"), {
        claimIds: ["DYN-002"],
        what: "the document's declaration order survives the build",
        detail: `${dynamicValue.of.rows.keys.join("|")} vs ${givenOrder(KEYS).join("|")}`,
      });
    } finally {
      dynamicForm.destroy();
    }

    // ── A draft written and restored ─────────────────────────────────────────
    const stored = new Map();
    const storage = {
      read: (key) => stored.get(key) ?? null,
      write: (key, value) => stored.set(key, value),
      remove: (key) => stored.delete(key),
    };

    ctx.scheduler.install();
    const saving = ctx.open(SPEC, { draft: { key: "numeric", storage, debounceMs: 10 } });
    await saving.execute({ type: "record.setAll", path: "rows", value: rowsOf(KEYS) });
    await ctx.scheduler.advance(50);

    expectClaim(stored.has("numeric"), {
      claimIds: ["PER-001"],
      what: "the draft was written",
      detail: [...stored.keys()].join(","),
    });

    const restored = ctx.open(SPEC, { draft: { key: "numeric", storage, debounceMs: 10 } });
    const restoredState = restored.observe("draft restored");
    ctx.scheduler.restore();

    expectClaim(shapeOf(restoredState.value.of.rows) === "object", {
      claimIds: ["PER-001", "COL-004"],
      what: "a restored draft rebuilds a keyed collection, not an array",
      detail: shapeOf(restoredState.value.of.rows),
    });
    expectClaim(restoredState.collections[0].keys.join("|") === givenOrder(KEYS).join("|"), {
      claimIds: ["PER-001"],
      what: "every declared key comes back, unrewritten and in order",
      detail: `${restoredState.collections[0].keys.join("|")} vs ${givenOrder(KEYS).join("|")}`,
    });

    // ── Undo across a structural change ──────────────────────────────────────
    const history = ctx.open(SPEC, { history: true });
    await history.execute({ type: "record.setAll", path: "rows", value: rowsOf(["0", "01"]) });
    await history.scheduler.flush();
    await history.execute({ type: "record.remove", path: "rows", key: "01" });
    await history.scheduler.flush();
    await history.execute({ type: "undo" });
    await history.scheduler.flush();

    const undone = history.observe("undo across a removal");
    expectClaim(shapeOf(undone.value.of.rows) === "object", {
      claimIds: ["PER-002", "COL-004"],
      what: "undo restores a keyed collection as an object",
      detail: shapeOf(undone.value.of.rows),
    });
    expectClaim(undone.collections[0].keys.includes("01"), {
      claimIds: ["PER-002"],
      what: "undo restores the removed row under its own key",
      detail: undone.collections[0].keys.join("|"),
    });
  },
);
