/**
 * A controller's state may not contradict its own handle.
 *
 * Every controller derives its state from a field handle, and four of them seed a signal from the
 * handle at construction and maintain it by hand afterwards. Two of those were caches rather than
 * derivations: the state exposed the live value beside a copy that only its own intents updated, so
 * a write from anywhere else — a draft restored, a server response, `patch()` — left the two
 * disagreeing. The option field decides which radio is checked from the copy, so the form held one
 * value and the control showed another.
 *
 * A property, not a case. It runs over every controller that takes a handle, so a fifteenth arrives
 * already covered and a cache reintroduced anywhere fails here by the name of the field it broke.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "@modyra/core";
import {
  createBooleanFieldController,
  createDatepickerFieldController,
  createDaterangeFieldController,
  createMultiselectFieldController,
  createOptionFieldController,
  createTextFieldController,
} from "../dist/index.js";
// Not on the entry: no renderer consumes it yet, and a name goes public with the implementation
// that uses it. Reached from its module, which is where the tests import it from.
import { createColorsFieldController } from "../dist/field/colors-field-controller.js";

function handleFor(initial) {
  const rx = vanillaReactivity();
  const value = rx.signal(initial);
  const errors = rx.signal([]);
  const flag = () => rx.signal(false);
  const disabled = flag();
  const readonly = flag();
  return {
    rx,
    handle: {
      path: "f",
      value,
      errors,
      touched: flag(),
      dirty: flag(),
      valid: rx.computed(() => errors().length === 0),
      pending: flag(),
      required: flag(),
      constraints: rx.signal({}),
      interactivity: rx.computed(() =>
        disabled() ? "disabled" : readonly() ? "readonly" : "enabled"),
      disabled,
      readonly,
      set: (v) => value.set(v),
      markAsTouched: () => undefined,
      markAsDirty: () => undefined,
    },
  };
}

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

/**
 * Each case names what the state says about the value, and what the value must then be. Written as
 * the *question the state answers* rather than as a field name, so a controller that renames a field
 * has to say so here too.
 */
const CASES = [
  {
    kind: "option",
    initial: "a",
    build: ({ handle, rx }) =>
      createOptionFieldController({ widgetId: "w", handle, options: OPTIONS }, rx),
    write: "b",
    // The key is what a renderer checks the radio from; the value is what the form holds.
    agrees: (state) => state.selectedKey === "b" && state.selectedValue === "b",
    field: "selectedKey",
  },
  {
    kind: "colors",
    initial: "#112233",
    build: ({ handle, rx }) => createColorsFieldController({ widgetId: "w", handle }, rx),
    write: "#445566",
    // Half-typed first, then completed. Only an incomplete colour makes the box differ from the
    // value at all, so this is the one path where a copy can be left behind — and the commit is
    // what must give the box back to the value before anything writes from outside.
    before: (controller) => {
      controller.dispatch({ type: "text", value: "#99" });
      controller.dispatch({ type: "text", value: "#778899" });
    },
    // The text is what the input shows; the value is what the form holds.
    agrees: (state) => state.text === "#445566" && state.value === "#445566",
    field: "text",
  },
  {
    kind: "boolean",
    initial: false,
    build: ({ handle, rx }) => createBooleanFieldController({ widgetId: "w", handle }, rx),
    write: true,
    agrees: (state) => state.checked === true,
    field: "checked",
  },
  {
    kind: "text",
    initial: "one",
    build: ({ handle, rx }) => createTextFieldController({ widgetId: "w", handle }, rx),
    write: "two",
    agrees: (state) => state.value === "two",
    field: "value",
  },
  {
    kind: "datepicker",
    initial: "2026-07-15",
    build: ({ handle, rx }) => createDatepickerFieldController({ widgetId: "w", handle }, rx),
    write: "2026-08-02",
    agrees: (state) => state.selectedDate === "2026-08-02",
    field: "selectedDate",
  },
  {
    kind: "daterange",
    initial: { start: "2026-07-15", end: "2026-07-20" },
    build: ({ handle, rx }) => createDaterangeFieldController({ widgetId: "w", handle }, rx),
    write: { start: "2026-08-01", end: "2026-08-05" },
    agrees: (state) => state.value.start === "2026-08-01" && state.value.end === "2026-08-05",
    field: "value",
  },
  {
    kind: "multiselect",
    initial: ["a"],
    build: ({ handle, rx }) =>
      createMultiselectFieldController({ widgetId: "w", handle, options: OPTIONS }, rx),
    write: ["b"],
    agrees: (state) => state.selectedKeys.has("b") && !state.selectedKeys.has("a"),
    field: "selectedKeys",
  },
];

for (const { kind, initial, build, write, agrees, field, before } of CASES) {
  test(`${kind}: a value written from outside reaches the state`, () => {
    const setup = handleFor(initial);
    const controller = build(setup);

    // Read once first: a cache that is only ever read after the write would pass by accident.
    assert.ok(controller.state(), `${kind}: no state at all`);

    // Some kinds only expose the copy after an interaction has filled it, so the case says what to
    // do first. Without it the write lands on a controller nobody has touched, which is the easy
    // half of the question.
    before?.(controller);

    // From outside: not an intent, which is the whole point. A draft restored, a server response
    // and `patch()` all arrive this way.
    setup.handle.set(write);

    assert.ok(
      agrees(controller.state()),
      `${kind}: \`${field}\` did not follow a value written outside the controller — the form holds `
        + `one thing and the state says another`,
    );
    controller.destroy();
  });
}
