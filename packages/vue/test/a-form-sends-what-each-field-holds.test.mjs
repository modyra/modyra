/**
 * A native submit carries each field's value under the field's path, and nothing else.
 *
 * What the browser sends is what `new FormData(form)` reads, so that is what is asserted here rather
 * than which element carries which attribute: a name on the wrong part, a key built from the widget
 * id, a hidden input left behind by an earlier value and a disabled field still sending are all
 * visible in the payload and in nothing else.
 *
 * Each value is changed from outside the field after it is mounted, so a payload that only reflects
 * the first render is caught as well.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const vue = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { renderToString } = await import("vue/server-renderer");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }];
const PATH = "value";
const WIDGET_ID = "sent-widget";

/**
 * The kind, its component, what it needs besides a field, then two values and the payload each one
 * sends, as `[key, value]` pairs in document order.
 */
const KINDS = [
  ["select (native)", "MdySelectField", { options: OPTIONS }, "a", [[PATH, "a"]], "c", [[PATH, "c"]]],
  ["select (custom)", "MdySelectField", { options: OPTIONS, searchable: true }, "a", [[PATH, "a"]], "c", [[PATH, "c"]]],
  ["multiselect (multi)", "MdyMultiselectField", { options: OPTIONS, mode: "multi" },
    ["a", "c"], [[PATH, "a"], [PATH, "c"]], ["b"], [[PATH, "b"]]],
  ["multiselect (single)", "MdyMultiselectField", { options: OPTIONS, mode: "single" },
    ["a"], [[PATH, "a"]], ["c"], [[PATH, "c"]]],
  ["radio", "MdyOptionField", { kind: "radio", options: OPTIONS }, "a", [[PATH, "a"]], "c", [[PATH, "c"]]],
  ["segmented", "MdyOptionField", { kind: "segmented", options: OPTIONS }, "a", [[PATH, "a"]], "c", [[PATH, "c"]]],
  ["colors", "MdyColorsField", {}, "#112233", [[PATH, "#112233"]], "#ff0000", [[PATH, "#ff0000"]]],
];

const payload = (form) => [...new document.defaultView.FormData(form).entries()];

for (const [name, component, extra, first, firstSent, second, secondSent] of KINDS) {
  test(`${name}: a native submit carries the held value under the field's path`, async () => {
    const form = vue.createVueForm({ value: field(first) });
    const element = document.createElement("form");
    const host = document.createElement("div");
    element.append(host);
    document.body.append(element);
    const app = createApp({
      render: () => h(vue[component], { field: form.f.value, widgetId: WIDGET_ID, label: "Field", ...extra }),
    });
    app.mount(host);
    await settle();
    try {
      assert.deepEqual(payload(element), firstSent, "the payload is not the value the field was given");
      assert.ok(
        payload(element).every(([key]) => !key.includes(WIDGET_ID)),
        "a key built from the widget id reached the payload",
      );

      form.f.value.set(second);
      await settle();
      assert.deepEqual(payload(element), secondSent, "the payload kept a value the field no longer holds");

      form.setDisabled(PATH, () => true);
      await settle();
      assert.deepEqual(payload(element), [], "a disabled field still sends a value");
    } finally {
      app.unmount();
      element.remove();
    }
  });
}

/**
 * A range sends its two ends under two keys, one per end, and only while the field is in play.
 *
 * Its two boxes carry the keys, and a box shows a date the way the reader's locale writes one. So
 * the keys and their order are asserted here, and the *value* under each key is asserted by the
 * test after this one.
 */
test("daterange: a native submit carries one key per end under the field's path", async () => {
  const form = vue.createVueForm({ value: field({ start: "2026-01-01", end: "2026-01-10" }) });
  const element = document.createElement("form");
  const host = document.createElement("div");
  element.append(host);
  document.body.append(element);
  const app = createApp({
    render: () => h(vue.MdyDaterangeField, { field: form.f.value, widgetId: WIDGET_ID, label: "Field" }),
  });
  app.mount(host);
  await settle();
  try {
    const keys = () => payload(element).map(([key]) => key);
    assert.deepEqual(keys(), [`${PATH}.start`, `${PATH}.end`]);

    form.f.value.set({ start: "2026-06-06", end: "2026-06-20" });
    await settle();
    assert.deepEqual(keys(), [`${PATH}.start`, `${PATH}.end`]);
    assert.notDeepEqual(
      payload(element).map(([, value]) => value),
      payload(element).map(() => ""),
      "a range holding two dates sends two empty ends",
    );

    form.setDisabled(PATH, () => true);
    await settle();
    assert.deepEqual(payload(element), [], "a disabled range still sends its ends");
  } finally {
    app.unmount();
    element.remove();
  }
});

/**
 * The value under each end's key is the date the range holds, not the text its box shows.
 *
 * The contract sends a range from its two boxes, and a box shows the date spelt for the reader's
 * locale, so the payload carries `January 1, 2026` where the model holds `2026-01-01`. Making the
 * payload carry the held date is a decision of the shared contract, not of this renderer.
 */
test("daterange: each end sends the date it holds, not the text its box shows", { todo: "the contract sends a range from its presentation boxes" }, async () => {
  const form = vue.createVueForm({ value: field({ start: "2026-01-01", end: "2026-01-10" }) });
  const element = document.createElement("form");
  const host = document.createElement("div");
  element.append(host);
  document.body.append(element);
  const app = createApp({
    render: () => h(vue.MdyDaterangeField, { field: form.f.value, widgetId: WIDGET_ID, label: "Field" }),
  });
  app.mount(host);
  await settle();
  try {
    assert.deepEqual(payload(element), [[`${PATH}.start`, "2026-01-01"], [`${PATH}.end`, "2026-01-10"]]);
  } finally {
    app.unmount();
    element.remove();
  }
});

/**
 * Outside every form a set of radios has no payload to join, and its name is only what groups it:
 * the scoped widget id, so two sets drawn from one path on one page stay two choices.
 */
test("radio: a set outside any form groups by its scoped id, not by the path", async () => {
  const form = vue.createVueForm({ value: field("a") });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(vue.MdyOptionField, { field: form.f.value, widgetId: WIDGET_ID, label: "Field", kind: "radio", options: OPTIONS }),
  });
  app.mount(host);
  await settle();
  try {
    const names = [...host.querySelectorAll('input[type="radio"]')].map((radio) => radio.name);
    assert.equal(names.length, OPTIONS.length);
    assert.ok(names.every((one) => one === names[0] && one.includes(WIDGET_ID)), `radios named ${names.join(", ")}`);
  } finally {
    app.unmount();
    host.remove();
  }
});

/**
 * HTML rendered on the server has no mounted set to name by its form, so the radios carry the scoped
 * id: one choice before hydration, rather than options that can all be checked at once.
 */
test("radio: a set rendered on the server is already one group", async () => {
  const form = vue.createVueForm({ value: field("a") });
  const html = await renderToString(h("form", [
    h(vue.MdyOptionField, { field: form.f.value, widgetId: WIDGET_ID, label: "Field", kind: "radio", options: OPTIONS }),
  ]));
  const names = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(([tag]) => /\bname="([^"]*)"/.exec(tag)?.[1]);
  assert.equal(names.length, OPTIONS.length);
  assert.ok(names.every((one) => one !== undefined && one === names[0] && one.includes(WIDGET_ID)), `radios named ${names.join(", ")}`);
});

/**
 * A radio drawn after mount, for an option that was not there before, joins the set under the path,
 * and the radios already named keep the path through the re-render that draws it.
 */
test("radio: an option added after mount is sent under the path", async () => {
  const form = vue.createVueForm({ value: field("a") });
  const options = (await import("vue")).shallowRef(OPTIONS.slice(0, 2));
  const element = document.createElement("form");
  const host = document.createElement("div");
  element.append(host);
  document.body.append(element);
  const app = createApp({
    render: () => h(vue.MdyOptionField, { field: form.f.value, widgetId: WIDGET_ID, label: "Field", kind: "radio", options: options.value }),
  });
  app.mount(host);
  await settle();
  try {
    options.value = OPTIONS;
    await settle();
    element.querySelector('input[type="radio"][value="c"]').checked = true;
    const names = [...element.querySelectorAll('input[type="radio"]')].map((radio) => radio.name);
    assert.deepEqual(names, OPTIONS.map(() => PATH), `radios named ${names.join(", ")}`);
    assert.deepEqual(payload(element), [[PATH, "c"]]);
  } finally {
    app.unmount();
    element.remove();
  }
});

/**
 * A new widget id changes the name the render draws, and the same flush that writes it puts the path
 * back, before any task — a submit, a click — can run: the set is never sent under the scoped id, and
 * the held choice stays checked.
 */
test("radio: a set whose widget id changes is still sent under the path", async () => {
  const form = vue.createVueForm({ value: field("b") });
  const widgetId = (await import("vue")).shallowRef(WIDGET_ID);
  const element = document.createElement("form");
  const host = document.createElement("div");
  element.append(host);
  document.body.append(element);
  const app = createApp({
    render: () => h(vue.MdyOptionField, { field: form.f.value, widgetId: widgetId.value, label: "Field", kind: "radio", options: OPTIONS }),
  });
  app.mount(host);
  await settle();
  try {
    const written = [];
    const observer = new document.defaultView.MutationObserver((records) => {
      for (const record of records) written.push(record.oldValue);
    });
    observer.observe(element, { subtree: true, attributeFilter: ["name"], attributeOldValue: true });
    widgetId.value = "renamed-widget";
    await nextTick();
    // Read before yielding to any task: this is what a submit queued behind the flush would see.
    const names = [...element.querySelectorAll('input[type="radio"]')].map((radio) => radio.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();
    assert.ok(written.some((one) => one?.includes("renamed-widget")), `the render wrote the new id as the name: ${written.join(", ")}`);
    assert.deepEqual(names, OPTIONS.map(() => PATH));
    assert.ok(element.querySelector('input[type="radio"][value="b"]').checked, "the held choice stays checked");
    assert.deepEqual(payload(element), [[PATH, "b"]]);
  } finally {
    app.unmount();
    element.remove();
  }
});
