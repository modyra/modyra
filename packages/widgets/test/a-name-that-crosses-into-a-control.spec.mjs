/**
 * A name is never taken from an embedded control.
 *
 * When the accessible-name computation follows `aria-labelledby` into a **combobox**, **textbox** or
 * other embedded control, that element contributes its *value* and not its text. So a part named by
 * pointing at one is named by whatever happens to be chosen there — the empty string, while nothing
 * is. A listbox named after its own combobox trigger was announced as "listbox" and nothing else,
 * with every attribute correct and the referenced element present and exposed: the defect lived
 * inside the algorithm, where nothing that reads markup can reach it.
 *
 * This asserts the rule rather than the computed name, because the rule is what a bench without a
 * browser can see. It is deliberately the weaker half of the pair, and it says so: the platform's
 * own reading is the other half, and it lives in the browser tier.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { projectSelectA11y, MDY_WIDGET_CONTRACTS } from "../dist/index.js";

/** Roles whose contribution to a name is a value rather than text. */
const EMBEDDED = new Set(["combobox", "textbox", "searchbox", "spinbutton", "slider"]);

const projectionOf = (variant) => projectSelectA11y({
  widgetId: "w",
  idFactory: { part: (id, part) => `${id}__${part}`, item: (id, part, key) => `${id}__${part}__${key}` },
  open: true, activeKey: null, selectedKey: null, disabled: false, readonly: false,
  invalid: false, loading: false, visibleKeys: ["a"], variant,
});

test("no part is named by pointing at a control that answers with its value", () => {
  const projection = projectionOf("custom");
  // Which ids belong to an embedded control, taken from the projection's own roles rather than a
  // list kept here: a part that becomes a combobox tomorrow is covered the day it does.
  const embeddedIds = new Set(
    Object.values(projection)
      .filter((part) => part && typeof part === "object" && EMBEDDED.has(part.role))
      .map((part) => part.id)
      .filter((id) => id !== undefined),
  );
  assert.ok(embeddedIds.size > 0, "no part of this projection is an embedded control, so this proves nothing");

  const wrong = [];
  for (const [name, part] of Object.entries(projection)) {
    const by = part?.attributes?.["aria-labelledby"];
    if (typeof by !== "string") continue;
    // A self-reference is the one legitimate case: a control naming itself wants its own value.
    for (const id of by.split(/\s+/)) {
      if (embeddedIds.has(id) && id !== part.id) wrong.push(`${name} -> ${id}`);
    }
  }
  assert.deepEqual(wrong, [],
    `named by an embedded control, which contributes its value and not its text:\n  ${wrong.join("\n  ")}`);
});

test("the listbox is named, and by something that carries text", () => {
  const listbox = Object.values(projectionOf("custom"))
    .find((part) => part && typeof part === "object" && part.role === "listbox");
  assert.ok(listbox, "this projection draws no listbox, so the rule above was asserted about nothing");
  const by = listbox.attributes["aria-labelledby"];
  assert.ok(typeof by === "string" && by.length > 0, "the listbox names nothing at all");
  assert.ok(!by.includes("__trigger"), "the listbox is named by the control that opens it");
  void MDY_WIDGET_CONTRACTS;
});
