import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";
import { describeKind } from "../dist/catalog-hover.js";
import { declarationAt } from "../dist/slot-definition.js";

const FIXTURE = fileURLToPath(
  new URL("../../../spec/fixtures/dynamic-form/v2/nested-layout.json", import.meta.url),
);

test("describes every kind the catalogue holds, and nothing it does not", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const markdown = describeKind(kind);
    assert.ok(markdown, `no description for ${kind}`);
    assert.match(markdown, new RegExp(`\`${kind}\``));
  }
  assert.equal(describeKind("richtext"), undefined);
  assert.equal(describeKind(""), undefined);
});

test("a description names the parts the catalogue names, not a copy of them", () => {
  // The point of the hover is that it cannot drift. Asserting a hand-written part list here would
  // reintroduce exactly the second description the projection exists to avoid, so the expectation
  // is read from the catalogue too.
  for (const kind of MDY_WIDGET_KINDS) {
    const markdown = describeKind(kind);
    for (const part of Object.keys(MDY_WIDGET_CONTRACTS[kind].parts)) {
      assert.ok(markdown.includes(`\`${part}\``), `${kind}: hover omits part ${part}`);
    }
  }
});

test("an overlay kind says so and a plain one stays quiet", () => {
  const overlaid = MDY_WIDGET_KINDS.filter((kind) => MDY_WIDGET_CONTRACTS[kind].capabilities.overlay);
  const plain = MDY_WIDGET_KINDS.filter((kind) => !MDY_WIDGET_CONTRACTS[kind].capabilities.overlay);
  assert.ok(overlaid.length > 0 && plain.length > 0, "the corpus of kinds no longer has both");

  for (const kind of overlaid) assert.match(describeKind(kind), /\*\*Overlay\*\*/);
  for (const kind of plain) assert.doesNotMatch(describeKind(kind), /\*\*Overlay\*\*/);
});

const text = readFileSync(FIXTURE, "utf8");
const LAYOUT = text.indexOf('"layout"');
/** Inside the first `needle` at or after `from` — the fixture is minified, so offsets are exact. */
const inside = (needle, from = 0) => text.indexOf(needle, from) + 1;
/** The same string where the layout uses it, rather than where `fields` declares it. */
const reference = (needle) => inside(needle, LAYOUT);

test("a layout child resolves to the field it names", () => {
  const declaration = declarationAt(text, reference('"street"'));
  assert.ok(declaration, "a layout child named a field and resolved to nothing");
  assert.equal(text.slice(declaration.offset, declaration.offset + declaration.length), '"street"');

  // The target is the declaration in `fields`, not the reference in `layout` the cursor sat on.
  assert.ok(declaration.offset < LAYOUT, "resolved to the reference, not the field");
});

test("a nested column child resolves too", () => {
  const declaration = declarationAt(text, reference('"city"'));
  assert.ok(declaration, "a child nested inside a columns row resolved to nothing");
  assert.ok(declaration.offset < LAYOUT);
});

test("standing on the declaration offers no jump to itself", () => {
  const declaration = declarationAt(text, reference('"street"'));
  assert.equal(declarationAt(text, declaration.offset + 1), undefined);
});

test("prose that happens to match a field name is not a reference", () => {
  const document = JSON.stringify({
    version: 2,
    fields: [{ name: "street", kind: "text", label: "street" }],
  });
  const labelValue = document.lastIndexOf('"street"') + 1;
  assert.equal(declarationAt(document, labelValue), undefined, "a label was treated as a pointer");
});

test("a name matching nothing resolves to nothing", () => {
  const document = JSON.stringify({
    version: 2,
    fields: [{ name: "street", kind: "text" }],
    layout: [{ kind: "section", id: "s", children: ["absent"] }],
  });
  assert.equal(declarationAt(document, document.indexOf('"absent"') + 1), undefined);
});

test("malformed source resolves to nothing rather than throwing", () => {
  assert.equal(declarationAt("", 0), undefined);
  assert.equal(declarationAt("{ this is not json", 5), undefined);
  assert.equal(declarationAt('{"fields":', 4), undefined);
});
