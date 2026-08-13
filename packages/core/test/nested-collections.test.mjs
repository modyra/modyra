/**
 * What a collection does about another collection inside it — today, and what it must do.
 *
 * Two halves. The first fixes the behaviour that exists, including the parts that are defects: a
 * characterization test that blesses nothing, it only makes a change visible. The second is the
 * matrix ADR 0040 commits to, skipped until the phase that answers it, so the work is written down
 * where it will be run rather than in a plan nobody executes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MdyFormEngine, array, createForm, field, group, record, vanillaReactivity } from "../dist/index.js";

const rows = () => group({ sku: field(""), qty: field(0) });

// ── What the refusal does today ────────────────────────────────────────────

test("a collection inside a collection is refused when the form is built", () => {
  // Not when a row arrives: a shape the runtime cannot execute must not survive long enough to
  // produce paths that look valid. This is the property the recursion has to keep.
  for (const [name, schema] of [
    ["record in record", { orders: record(group({ lines: record(rows()) })) }],
    ["array in record", { orders: record(group({ lines: array(rows()) })) }],
    ["record in array", { orders: array(group({ lines: record(rows()) })) }],
    ["array in array", { orders: array(group({ lines: array(rows()) })) }],
  ]) {
    // The two managers word it differently — "nested collections … are not supported" against
    // "a record's row cannot contain another record". Asserted as a refusal that names the kind,
    // because pinning either sentence would make a reworded message look like a regression.
    assert.throws(() => createForm(schema), (error) => {
      assert.match(error.message, /^\[modyra\]/, `${name} should be refused by the engine`);
      assert.match(error.message, /record|array/, `${name}'s refusal should name a collection kind`);
      return true;
    }, `${name} should be refused`);
  }
});

test("the refusal names the shape it refused, not the row that reached it", () => {
  try {
    createForm({ orders: array(group({ lines: record(rows()) })) });
    assert.fail("expected a refusal");
  } catch (error) {
    assert.match(String(error.message), /record/, "the message says which kind was nested");
  }
});

test("one level is unaffected, in both directions", () => {
  const form = createForm({ orders: record(rows()), items: array(rows()) });
  form.f.orders.upsert("a", { sku: "S", qty: 1 });
  form.f.items.push({ sku: "T", qty: 2 });
  assert.deepEqual(form.f.orders.keys(), ["a"]);
  assert.equal(form.f.items.rows().length, 1);
  // A record stays an object even where its keys look like indices — the property a nested record
  // under an array must keep, and the reason `array → record` is the hard one.
  form.f.orders.upsert("0", { sku: "Z", qty: 0 });
  assert.equal(Array.isArray(form.getValue().orders), false);
  form.destroy();
});

/**
 * Out of play if any collection above it says no.
 *
 * The engine used to answer from the first gate whose prefix matched, in registration order — so a
 * child registered before its parent admitted paths the closed parent refused. This is the same
 * sentence `conditions.ts` states about sections, over a different set of ancestors.
 */
test("a path is in play only when every collection above it admits it", () => {
  for (const order of ["inner first", "outer first"]) {
    const engine = new MdyFormEngine(vanillaReactivity(), () => undefined, () => "valid-only");
    const closedOuter = ["orders", { isOpen: () => false }];
    const openInner = ["orders.a.lines", { isOpen: () => true }];
    for (const [prefix, gate] of order === "inner first" ? [openInner, closedOuter] : [closedOuter, openInner]) {
      engine.registerPathGate(prefix, gate);
    }

    engine.claimField("orders.a.lines.x");
    assert.equal(engine.peekField("orders.a.lines.x"), null,
      `${order}: the closed parent should refuse the path whatever the registration order`);

    engine.destroy();
  }
});

test("an open parent does not force a closed child open", () => {
  const engine = new MdyFormEngine(vanillaReactivity(), () => undefined, () => "valid-only");
  engine.registerPathGate("orders", { isOpen: () => true });
  engine.registerPathGate("orders.a.lines", { isOpen: () => false });
  engine.claimField("orders.a.lines.x");
  assert.equal(engine.peekField("orders.a.lines.x"), null, "the inner refusal still holds");
  // A sibling the inner gate does not cover is unaffected: composition narrows, it does not spread.
  engine.claimField("orders.a.customer");
  assert.notEqual(engine.peekField("orders.a.customer"), null, "a path only the open gate covers is in play");
  engine.destroy();
});

// ── The matrix ADR 0040 commits to ─────────────────────────────────────────
//
// Each of these is a claim the phase named beside it must make true. They are skipped rather than
// absent so the suite is the work list, and an implementation that forgets one leaves a skip behind
// where a reviewer looks.

const phase = (name, fn) => test(name, { skip: "phase not implemented yet" }, fn);

phase("record → record: a child row survives its parent being declared after it", () => {});
phase("record → record: removing the parent destroys the child's fields and async runners", () => {});
phase("record → record: renaming the parent carries the whole subtree, values and flags", () => {});
phase("record → record: renaming onto an occupied key is refused", () => {});
phase("record → record: an unmounted descendant still decides the form's validity", () => {});
phase("record → record: setAll on the parent drops subtrees the write does not mention", () => {});
phase("record → record: patch on the parent leaves unnamed subtrees alone", () => {});
phase("record → record: a restored draft rebuilds both levels", () => {});
phase("record → record: undo crosses a nested creation in one step", () => {});
phase("record → record: a hostile key is refused at every level", () => {});
phase("record → array: rows push and move inside one parent key without touching another's", () => {});
phase("array → record: a move rebuilds the descendant record and says which flags it lost", () => {});
phase("depth beyond the document's cap is refused when the form is built", () => {});

/**
 * The two managers declare a row the same way, because they now run the same code.
 *
 * They did not: only the array told the form the row *owns* its cells, so the sentence
 * `MdyCollectionHost` states about ownership was true of one collection and not the other. Nothing
 * in the value showed it, because the path gate refuses the removal first — which is exactly how a
 * divergence survives.
 */
test("a row owns its cells, whichever collection declared it", () => {
  for (const [kind, build, declare, leaf] of [
    ["record", () => createForm({ c: record(rows()) }), (f) => f.f.c.upsert("k", { sku: "S", qty: 1 }), "c.k.sku"],
    ["array", () => createForm({ c: array(rows()) }), (f) => f.f.c.push({ sku: "S", qty: 1 }), "c.0.sku"],
  ]) {
    const form = build();
    declare(form);
    // A control mounts and goes; the cell is the row's, so it outlives the control.
    form.claimField(leaf);
    form.removeField(leaf);
    assert.notEqual(form.getField(leaf), null, `${kind}: the cell went with the control`);
    form.destroy();
  }
});
