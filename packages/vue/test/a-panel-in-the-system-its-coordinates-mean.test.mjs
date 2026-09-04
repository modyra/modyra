/**
 * A panel is shown through the door that decides what a shown panel *is*.
 *
 * Writing `hidden` on the element looks like the same act and is not. `setOverlayOpen` also puts the
 * panel in the top layer — `popover="manual"` — and that attribute is what the foundation's
 * `.mdy-popup[popover] { position: fixed }` reads.
 *
 * **Fixed is what the coordinates mean.** `anchorOverlay` measures against the viewport, so its
 * answer is true only for a box laid out against the viewport. A panel that never became a popover
 * is laid out against the document, and the same numbers then point somewhere else by exactly how
 * far the page has scrolled — nowhere on a short page, thousands of pixels above the window on a
 * real one.
 *
 * That is why no bench here caught it: one field at the top of an empty page has no scroll, and an
 * origin error of zero pixels is not an error. This asserts the attribute rather than a position,
 * because a position is what jsdom cannot compute — but the attribute is the thing that was missing,
 * and it is the same thing in every browser.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const CASES = [
  { kind: "select", component: () => m.MdySelectField, empty: null, extra: { options: [{ value: "a", label: "A" }], searchable: true } },
  { kind: "multiselect", component: () => m.MdyMultiselectField, empty: [], extra: { options: [{ value: "a", label: "A" }] } },
  { kind: "datepicker", component: () => m.MdyDatepickerField, empty: null, extra: {} },
  { kind: "daterange", component: () => m.MdyDaterangeField, empty: { start: null, end: null }, extra: {} },
  { kind: "timepicker", component: () => m.MdyTimepickerField, empty: null, extra: {} },
  { kind: "colors", component: () => m.MdyColorsField, empty: "", extra: {} },
];

for (const testCase of CASES) {
  test(`${testCase.kind}: its panel is in the layer its coordinates were measured for`, async () => {
    assert.equal(
      MDY_WIDGET_CONTRACTS[testCase.kind].capabilities.overlay, true,
      `${testCase.kind} declares no overlay, so it has no panel this test can be about`,
    );

    const form = m.createVueForm({ value: field(testCase.empty) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(testCase.component(), { field: form.f.value, widgetId: `l-${testCase.kind}`, label: "L", ...testCase.extra }),
    });
    app.mount(host);
    await settle();

    try {
      const panel = document.querySelector(`.${partClasses(testCase.kind, "popup")[0]}`);
      assert.ok(panel, `${testCase.kind} drew no panel`);
      // From the start, not from the first opening: the attribute is what the stylesheet matches,
      // and a panel that acquires it late is laid out in the wrong system until it does.
      assert.equal(
        panel.getAttribute("popover"), "manual",
        `${testCase.kind}: the panel is not in the top layer, so viewport coordinates are being applied to a box laid out against the document`,
      );
      assert.equal(panel.hidden, true, "and it is shown before anyone opened it");

      const opener = host.querySelector("button[aria-expanded]") ?? host.querySelector("[aria-expanded]");
      opener.click();
      await settle();
      assert.equal(panel.hidden, false, `${testCase.kind}: it was opened and stayed hidden`);
      assert.equal(panel.getAttribute("popover"), "manual");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });
}
