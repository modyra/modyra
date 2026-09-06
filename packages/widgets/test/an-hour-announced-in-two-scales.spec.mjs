/**
 * The hour segment announces the number the face shows.
 *
 * A spinbutton states three numbers and a word: where the range starts, where it ends, where the
 * value sits, and how to say it. The range comes from the clock the field is set to, so on a
 * 24-hour face it is 0–23. The draft behind it is held canonically as 1–12 with a period, which is
 * a different scale — and a value from one scale published against bounds from the other names an
 * hour the face does not show, inside a range that permits the one it does.
 *
 * Both formats are asserted because only the pair can fail: on a 12-hour face the two scales
 * coincide, so a projection that never converts is indistinguishable from one that always does.
 */
import assert from "node:assert";
import test from "node:test";

import { vanillaReactivity } from "@modyra/core";
import { createTimepickerFieldController } from "../dist/field/index.js";

function hourControlOf(format, initialValue) {
  const rx = vanillaReactivity();
  const value = rx.signal(initialValue);
  const errors = rx.signal([]);
  const flag = () => rx.signal(false);
  const touched = flag(), dirty = flag(), pending = flag();
  const required = flag(), disabled = flag(), readonly = flag();
  const handle = {
    path: "time", value, errors, touched, dirty, pending, required, disabled, readonly,
    valid: rx.computed(() => errors().length === 0),
    interactivity: rx.computed(() => "enabled"),
    set(v) { value.set(v); },
    markAsTouched() { touched.set(true); },
    markAsDirty() { dirty.set(true); },
  };
  const controller = createTimepickerFieldController({ widgetId: "time", handle, format }, rx);
  return controller.view().parts.hourControl.attributes;
}

test("a 24-hour face announces the hour it shows, inside the range it declares", () => {
  const a = hourControlOf("24h", "14:05");
  assert.strictEqual(a["aria-valuemin"], 0);
  assert.strictEqual(a["aria-valuemax"], 23);
  assert.strictEqual(a["aria-valuenow"], 14, "the face shows 14; a reader must not be told 2");
  assert.match(String(a["aria-valuetext"]), /\b14\b/);
});

test("a 12-hour face announces the hour it shows, with the half of the day", () => {
  const a = hourControlOf("12h", "02:05 PM");
  assert.strictEqual(a["aria-valuemin"], 1);
  assert.strictEqual(a["aria-valuemax"], 12);
  assert.strictEqual(a["aria-valuenow"], 2);
  assert.strictEqual(a["aria-valuetext"], "2 PM");
});
