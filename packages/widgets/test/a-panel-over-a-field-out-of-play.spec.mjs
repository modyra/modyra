/**
 * A widget taken out of play is not open.
 *
 * `MDY_DISABLED_BLOCKS_TRANSITIONS` is published `true` — *a disabled widget makes none of the moves
 * its table declares* — and that was read as a rule about what it may do next. It is also a rule
 * about the one state it can already be in: a panel standing open on a disabled field is not the
 * result of a move it is about to make, it is the residue of one it made while it still could.
 *
 * What it costs is not tidiness. A document rule takes a field out of play when another field
 * changes, and the panel that stays is over a control nobody can operate — reachable by the keyboard,
 * offering choices that lead nowhere.
 *
 * Three renderers appeared to honour this. They draw the panel inside the field, so it goes with the
 * field's own treatment — the same accident of placement that ADR 0206 ends for a field leaving the
 * document, met a second time on a different road.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../../core/dist/index.js";
import {
  MDY_DISABLED_BLOCKS_TRANSITIONS,
  createColorsFieldController,
  createDatepickerFieldController,
  createDaterangeFieldController,
  createMultiselectFieldController,
  createTimepickerFieldController,
  staysOpen,
} from "../dist/index.js";

/** Every kind whose controller holds an open panel, built the way a host builds one. */
const OVERLAY_KINDS = [
  ["datepicker", (handle) => createDatepickerFieldController({ handle, widgetId: "w" }), null],
  ["daterange", (handle) => createDaterangeFieldController({ handle, widgetId: "w" }), { start: null, end: null }],
  ["timepicker", (handle) => createTimepickerFieldController({ handle, widgetId: "w" }), null],
  ["colors", (handle) => createColorsFieldController({ handle, widgetId: "w", presets: [] }), ""],
  ["multiselect", (handle) => createMultiselectFieldController({ handle, widgetId: "w", options: [{ value: "a", label: "A" }] }), []],
];

test("the rule this rests on is still the one the contract publishes", () => {
  // If a disabled widget were allowed its transitions, everything below would be asserting a
  // preference rather than the contract.
  assert.equal(MDY_DISABLED_BLOCKS_TRANSITIONS, true);
  assert.equal(staysOpen(true, false), true, "a widget in play may be open");
  assert.equal(staysOpen(true, true), false, "a widget out of play may not");
  assert.equal(staysOpen(false, false), false, "and nothing opens a widget that was not open");
});

for (const [kind, build, empty] of OVERLAY_KINDS) {
  test(`${kind}: a panel does not stand open over a field taken out of play`, () => {
    const form = createForm({ value: field(empty) });
    const controller = build(form.f.value);

    controller.dispatch({ type: "open" });
    // Asserted before the act, or a controller that never opened would pass this by never having
    // anything to close.
    assert.equal(controller.state().open, true, `${kind} did not open, so nothing below is a measurement`);

    form.setDisabled("value", () => true);
    assert.equal(controller.state().disabled, true, `${kind} did not hear that it was taken out of play`);
    assert.equal(
      controller.state().open, false,
      `${kind}: the field is out of play and its panel is still standing open over it`,
    );
  });
}
