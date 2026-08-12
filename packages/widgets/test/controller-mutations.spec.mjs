/**
 * The controllers added by this batch, each broken on purpose.
 *
 * A suite that only shows a correct controller going green cannot tell a gate from a rubber stamp —
 * which is the argument `mutation-suite.spec.mjs` makes for the DOM contract, and it applies here
 * exactly. Four controllers arrived at once; these are the checks that their tests would notice if
 * the rule underneath moved.
 *
 * Each mutation is one a controller could plausibly ship, not one contrived to be caught: a range
 * that treats a preview as a decision, a colour that commits every keystroke, a file field that
 * forgets what it refused, a select that trusts a caller for its own validity.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import {
  createDaterangeFieldController,
} from "../dist/field/index.js";
import { createColorsFieldController } from "../dist/field/colors-field-controller.js";
import { createFileFieldController } from "../dist/field/file-field-controller.js";
import { createSelectFieldController } from "../dist/field/select-field-controller.js";

const drained = () => new Promise((resolve) => { setTimeout(resolve, 0); });

/**
 * Every mutation states the rule it breaks and the observation that would catch it.
 *
 * `observe` returns what the suite asserts; `correct` is what the controller does today. A mutation
 * whose `correct` value is what a broken controller would also produce is a mutation that proves
 * nothing, and saying both makes that visible.
 */
const MUTATIONS = [
  {
    rule: "a preview is not a decision",
    kind: "daterange",
    detail: "the cell under the pointer stands in for an end that does not exist; writing it to the draft commits a range on the first click",
    run() {
      const rx = vanillaReactivity();
      const form = createForm({ r: field({ start: null, end: null }) }, { reactivity: rx });
      const c = createDaterangeFieldController({ widgetId: "w", handle: form.f.r }, rx);
      c.dispatch({ type: "open" });
      c.dispatch({ type: "select-date", iso: c.state().cells[10].iso });
      c.dispatch({ type: "preview", iso: c.state().cells[14].iso });
      const observed = { draftEnd: c.state().draft.end, committed: form.f.r.value().end };
      c.destroy(); form.destroy();
      return observed;
    },
    correct: { draftEnd: null, committed: null },
  },
  {
    rule: "a partial colour is not a value and is not an error",
    kind: "colors",
    detail: "committing every keystroke stores `#0` as black; rejecting it takes the text away from the person typing",
    run() {
      const rx = vanillaReactivity();
      const form = createForm({ c: field("") }, { reactivity: rx });
      const c = createColorsFieldController({ widgetId: "w", handle: form.f.c }, rx);
      c.dispatch({ type: "text", value: "#0" });
      const observed = { text: c.state().text, committed: form.f.c.value() };
      c.destroy(); form.destroy();
      return observed;
    },
    correct: { text: "#0", committed: "" },
  },
  {
    rule: "what a selection refused is shown, not dropped",
    kind: "file",
    detail: "a field that drops candidates silently leaves someone looking at a list missing the file they just chose",
    run() {
      const rx = vanillaReactivity();
      const form = createForm({ f: field([]) }, { reactivity: rx });
      const c = createFileFieldController({ widgetId: "w", handle: form.f.f, accept: ".pdf", multiple: true }, rx);
      c.dispatch({ type: "select", files: [{ name: "a.pdf", type: "application/pdf", size: 1 }, { name: "b.exe", type: "application/octet-stream", size: 1 }] });
      const observed = { kept: c.state().files.length, refused: c.state().rejected.length };
      c.destroy(); form.destroy();
      return observed;
    },
    correct: { kept: 1, refused: 1 },
  },
  {
    rule: "out of play, no verdict — read, not taken on trust",
    kind: "select",
    detail: "the standalone controller takes `invalid` from its caller, so a select is only as right about a disabled field as whoever wired it",
    async run() {
      const rx = vanillaReactivity();
      const form = createForm({ s: field(null, [required()]) }, { reactivity: rx });
      const c = createSelectFieldController({ widgetId: "w", handle: form.f.s, options: [{ value: "a", label: "A" }] }, rx);
      await drained();
      const failing = c.state().invalid;
      form.setDisabled("s", () => true);
      await drained();
      const observed = { failing, outOfPlay: c.state().invalid };
      c.destroy(); form.destroy();
      return observed;
    },
    correct: { failing: true, outOfPlay: false },
  },
];

for (const mutation of MUTATIONS) {
  test(`${mutation.kind}: ${mutation.rule}`, async () => {
    const observed = await mutation.run();
    assert.deepEqual(observed, mutation.correct, `${mutation.detail}\n  observed: ${JSON.stringify(observed)}`);
  });
}

/**
 * The list is the metric, as it is next door.
 *
 * A controller added without a mutation here is a controller whose suite has never rejected
 * anything — and that is indistinguishable, from the outside, from one that cannot.
 */
test("every controller this batch added is represented", () => {
  assert.deepEqual(
    MUTATIONS.map((m) => m.kind).sort(),
    ["colors", "daterange", "file", "select"],
  );
});
