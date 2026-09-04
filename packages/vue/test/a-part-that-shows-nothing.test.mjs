/**
 * A part whose job is to show something shows it.
 *
 * The components draw the parts they need by hand, with the projection, and delegate the rest to a
 * walk over the declared structure. That walk knew the shape and nothing about the value, so the
 * parts it drew were boxes with the right classes and nothing inside — and the parts a component
 * delegates are precisely the ones that *display* a value. A slider with no number, a file field
 * whose prompt says nothing, a swatch with no colour.
 *
 * Which is why it landed on exactly three kinds. Where the value lives inside the native control —
 * text, number, date — the component draws that control itself and the defect does not appear.
 *
 * **Absent and empty are asserted apart.** The first repair supplied the prompt *instead of* the
 * structure beneath it, which deleted the button that empties the field; a check reading a missing
 * element's text as `""` called that a success.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const draw = async (component, value, extra = {}) => {
  const form = m.createVueForm({ value: field(value) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(component, { field: form.f.value, widgetId: "v", label: "Given", ...extra }) });
  app.mount(host);
  await settle();
  return { host, form, dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; } };
};

/** The element a part is drawn as, or `null` — never conflated with one that is drawn and empty. */
const partElement = (host, kind, part) => host.querySelector(`.${partClasses(kind, part)[0]}`);

test("the slider shows the number it holds", async () => {
  const view = await draw(m.MdySliderField, 50, { min: 0, max: 100 });
  try {
    const readout = partElement(view.host, "slider", "value");
    assert.ok(readout, "the slider drew no value readout at all");
    assert.equal(readout.textContent.trim(), "50", "the field holds 50 and the readout says nothing");
  } finally {
    view.dispose();
  }
});

test("the file field says what it is for, and keeps the button that empties it", async () => {
  const view = await draw(m.MdyFileField, []);
  try {
    const content = partElement(view.host, "file", "content");
    const clear = partElement(view.host, "file", "clear");
    assert.ok(content, "the file field drew no content box");
    assert.ok(clear, "the button that empties the field is not on the page — supplying the prompt deleted it");
    assert.notEqual(content.textContent.trim(), "", "the prompt box says nothing");
    assert.notEqual(clear.textContent.trim(), "", "the button that empties the field has no mark on it");
  } finally {
    view.dispose();
  }
});

test("the colour field's swatch is the colour it holds", async () => {
  const view = await draw(m.MdyColorsField, "#ff8800");
  try {
    const preview = partElement(view.host, "colors", "preview");
    assert.ok(preview, "the colour field drew no swatch");
    assert.equal(
      preview.style.backgroundColor, "rgb(255, 136, 0)",
      "the one control whose whole job is to show a colour is showing none",
    );
  } finally {
    view.dispose();
  }
});
