/**
 * The three controllers that hold a list of choices derive a choice's key the same way.
 *
 * They did not. Two defaulted to `defaultOptionKey` and one to `String`, under which every plain
 * object is `[object Object]`: an object-valued list gave every choice one key, so two choices were
 * one and holding either marked both. All three doc comments claimed the `String` default, so two of
 * them described a behaviour their own file did not have.
 *
 * It stayed invisible because every renderer in this repository passes its own `keyFor` — the
 * workaround is in four adapters, and the defect was only reachable by a consumer holding the
 * controller directly, which is exactly who a headless package is for.
 *
 * The bench is objects on purpose. For a primitive the two derivations agree exactly, so a fixture
 * built on strings cannot tell them apart, and every one of ours was.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../../core/dist/index.js";
import {
  createMultiselectFieldController,
  createOptionFieldController,
  createSelectFieldController,
  defaultOptionKey,
} from "../dist/index.js";

const OPTIONS = [
  { value: { id: 1 }, label: "One" },
  { value: { id: 2 }, label: "Two" },
];

/** The keys a controller offers for a list, taken from the projection rather than from its input. */
const keysOffered = (parts) =>
  Object.keys(parts).filter((name) => name === defaultOptionKey(OPTIONS[0].value) || name === defaultOptionKey(OPTIONS[1].value));

test("no default collapses two object-valued choices into one", () => {
  const form = createForm({ one: field(null), two: field(null), many: field([]) });

  const built = [
    ["option", createOptionFieldController({ handle: form.f.one, widgetId: "o", options: OPTIONS })],
    ["select", createSelectFieldController({ handle: form.f.two, widgetId: "s", options: OPTIONS })],
    ["multiselect", createMultiselectFieldController({ handle: form.f.many, widgetId: "m", options: OPTIONS })],
  ];

  for (const [name, controller] of built) {
    const offered = keysOffered(controller.view().parts);
    assert.equal(
      offered.length, OPTIONS.length,
      `${name} offers ${offered.length} key(s) for ${OPTIONS.length} choices: two choices under one key`,
    );
    assert.notEqual(offered[0], offered[1], `${name} gave both choices the same key`);
  }
});

test("the derivation is the one the package publishes, not one each controller invented", () => {
  const form = createForm({ one: field(null) });
  const controller = createOptionFieldController({ handle: form.f.one, widgetId: "o", options: OPTIONS });
  // Named rather than compared to a literal: the assertion has to move when the published
  // derivation moves, or it becomes a second copy of it that drifts.
  for (const option of OPTIONS) {
    assert.ok(
      controller.view().parts[defaultOptionKey(option.value)],
      `no part is projected under ${defaultOptionKey(option.value)}`,
    );
  }
});
