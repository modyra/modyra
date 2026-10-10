/**
 * A panel hangs from the field, not from the button that opened it.
 *
 * The contract's anchoring (`overlayAnchoringFor`) says which edge a panel lines up with and whether
 * it matches the width it hangs from. Those are statements about the field: a list as wide as its
 * control, a calendar flush with the control's end. Measured against the small button at the end of
 * the field instead, a list is as wide as an arrow and a calendar flipped above opens over the very
 * control it belongs to. The other renderers measure the input wrapper.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const {
  MDY_POPUP_OPENERS, anchorOverlay, overlayAnchoringFor, partClasses, viewportSize,
} = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 30)); };

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const CASES = {
  select: () => [m.MdySelectField, { options: OPTIONS, searchable: true }, null],
  multiselect: () => [m.MdyMultiselectField, { options: OPTIONS }, []],
  datepicker: () => [m.MdyDatepickerField, {}, null],
  daterange: () => [m.MdyDaterangeField, {}, { start: null, end: null }],
  timepicker: () => [m.MdyTimepickerField, {}, null],
  colors: () => [m.MdyColorsField, {}, "#112233"],
};

/** The field's box, wide; anything else in it, a small square at its end. */
const FIELD = { x: 100, y: 200, left: 100, top: 200, right: 500, bottom: 240, width: 400, height: 40 };
const BUTTON = { x: 470, y: 205, left: 470, top: 205, right: 495, bottom: 235, width: 25, height: 30 };

const wrapperClass = (kind) => partClasses(kind, "inputWrapper")[0];

// A page with room: on a viewport with none, the pickers are centred as sheets and the anchor's box
// is never consulted, so the question would not be asked.
Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1280 });
Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 900 });

for (const [kind, make] of Object.entries(CASES)) {
  test(`${kind}: the panel is placed against the field's box`, async () => {
    const [component, props, empty] = make();
    const original = window.Element.prototype.getBoundingClientRect;
    window.Element.prototype.getBoundingClientRect = function measured() {
      const box = this.classList.contains(wrapperClass(kind)) ? FIELD : BUTTON;
      return { ...box, toJSON: () => box };
    };
    const form = m.createVueForm({ value: field(empty) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({ render: () => h(component, { field: form.f.value, label: "L", widgetId: "p", ...props }) });
    app.mount(host);
    try {
      await settle();
      const opener = MDY_POPUP_OPENERS[kind];
      const door = document.querySelector(`.${partClasses(kind, opener.alsoOpensFrom ?? opener.opener)[0]}`)
        ?? document.querySelector(`.${partClasses(kind, opener.opener)[0]}`);
      door.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await settle();
      await settle();
      const panel = document.querySelector(`.${partClasses(kind, "popup")[0]}`);
      assert.ok(panel, `${kind} drew no panel`);
      const expected = anchorOverlay(FIELD, viewportSize(document), { ...overlayAnchoringFor(kind), direction: "ltr" }).properties;
      const written = Object.fromEntries(Object.keys(expected).map((name) => [name, panel.style.getPropertyValue(name)]));
      assert.deepEqual(written, Object.fromEntries(Object.entries(expected).map(([name, value]) => [name, String(value)])));
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
      window.Element.prototype.getBoundingClientRect = original;
    }
  });
}
