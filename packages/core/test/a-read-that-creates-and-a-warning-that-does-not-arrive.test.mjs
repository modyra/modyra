/**
 * Two rules the two collection managers disagreed about, and the benches that keep them agreeing.
 *
 * Both were found by comparing the managers line by line rather than by a failing test: the same
 * method, written twice, differing in one call each. Neither difference was argued anywhere, and
 * both had the shape where the wrong one is invisible — a read that quietly creates, and a warning
 * that quietly does not arrive.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { createForm, field, group, array, record } = await import("../dist/index.js");

/**
 * The doors, told apart by what they leave behind.
 *
 * This is the known positive the other assertions lean on: without it, "the field set did not grow"
 * proves nothing, because it is also what a broken observable says. Kept as a test so that the day
 * the two doors stop differing, this says so instead of the checks below silently becoming vacuous.
 */
test("the two doors differ: one creates the field it is asked for, the other does not", () => {
  const form = createForm({ rows: array(group({ name: field("") }), { initial: [{ name: "x" }] }) });
  const engine = form._adapter ?? form._engine;
  const names = () => engine.fieldNames().filter((n) => n.startsWith("rows.")).sort();
  const before = JSON.stringify(names());

  assert.equal(engine.peekField("rows.0.ghost"), null, "peekField answered for a field nobody declared");
  assert.equal(JSON.stringify(names()), before, "peekField created a field, which is the difference it exists for");

  assert.ok(engine.getField("rows.0.ghost"), "getField did not create the field it was asked for");
  assert.notEqual(JSON.stringify(names()), before, "getField created nothing, so these two doors are now the same");
  form.destroy?.();
});

test("reading a collection's values creates no fields, whichever kind it is", () => {
  for (const kind of ["array", "record"]) {
    const rows = kind === "array"
      ? array(group({ name: field("") }), { initial: [{ name: "x" }] })
      : record(group({ name: field("") }), { initial: { r1: { name: "x" } } });
    const form = createForm({ rows });
    const engine = form._adapter ?? form._engine;
    const names = () => engine.fieldNames().sort().join(",");

    const before = names();
    form.value();

    assert.equal(names(), before, `reading a ${kind}'s values brought a field into existence`);
    form.destroy?.();
  }
});

/**
 * The same mistake in three placements.
 *
 * Two of them diagnosed it and the third said nothing, which is how the divergence was found: with
 * only two cases a difference does not say which side is right, and the top-level one is what makes
 * the silence the anomaly rather than the rule.
 *
 * The assertion is the *same* message, path included — not merely that a warning appeared. What
 * makes this diagnostic worth having is that it names the collection; a bench that accepted any
 * warning would pass on a generic one that helps nobody.
 */
test("the same mistake is reported wherever the collection sits", () => {
  const inner = () => record(group({ tag: field("") }), { initial: { k1: { tag: "t" } } });
  const seen = [];
  const real = console.warn;
  console.warn = (...args) => seen.push(args.join(" "));

  try {
    const placements = {
      "at the top": () => {
        const form = createForm({ solo: inner() });
        return [form, form.f.solo, "solo"];
      },
      "inside a keyed row": () => {
        const form = createForm({ outer: record(group({ inner: inner() }), { initial: { r1: { inner: { k1: { tag: "t" } } } } }) });
        return [form, form.f.outer.row("r1").inner, "outer.r1.inner"];
      },
      "inside a positional row": () => {
        const form = createForm({ outer: array(group({ inner: inner() }), { initial: [{ inner: { k1: { tag: "t" } } }] }) });
        return [form, form.f.outer.at(0).inner, "outer.0.inner"];
      },
    };

    for (const [where, build] of Object.entries(placements)) {
      const [form, collection, path] = build();
      seen.length = 0;
      // An array where the collection takes an object keyed by row key: the mistake this
      // diagnostic exists to name.
      collection.setAll([1, 2, 3]);

      assert.equal(seen.length, 1, `${where}: expected exactly one warning, saw ${seen.length}`);
      assert.match(
        seen[0], new RegExp(`setAll on "${path.replace(/\./g, "\\.")}"`),
        `${where}: the warning does not name the collection it is about — it read ${JSON.stringify(seen[0])}`,
      );
      form.destroy?.();
    }
  } finally {
    console.warn = real;
  }
});
