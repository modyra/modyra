/**
 * What the swatch shows when the field holds nothing.
 *
 * The colour a part displays is the contract's answer — `content.color` — because a part that shows
 * a value had its content invented by every renderer that drew it. On the one control whose whole
 * job is to show a colour, four renderers produced three answers for the empty field: a transparent
 * square, the declared colour, and `background-color:` with nothing after it, from a copied literal
 * behind a `??` that does not fire on the empty string a cleared field holds.
 *
 * Both states, because only the pair can fail: a door that always answered the held value and one
 * that always answered the fallback are the same answer while a value is held.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { vanillaReactivity, createForm, field } from "@modyra/core";
import { createColorsFieldController } from "../dist/field/index.js";

const swatchOf = (held) => {
  const rx = vanillaReactivity();
  const form = createForm({ tint: field(held, []) });
  const controller = createColorsFieldController({ widgetId: "w", handle: form.f.tint }, rx);
  return controller.view().parts.preview.content?.color;
};

test("a field holding a colour shows that colour", () => {
  assert.equal(swatchOf("#ff0000"), "#ff0000");
});

test("a field holding nothing shows the colour the contract names, never nothing", () => {
  // The empty string is the state a cleared field is actually in, and the one a nullish check misses.
  for (const empty of ["", null]) {
    const shown = swatchOf(empty);
    assert.ok(shown !== undefined && shown !== "" && shown !== null,
      `a field holding ${JSON.stringify(empty)} showed ${JSON.stringify(shown)} — the control whose `
      + "job is to show a colour was given none");
  }
});
