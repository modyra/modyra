/**
 * The title that brings the days back puts the keyboard on the day; paging leaves it on the button.
 *
 * Both are one rule read from two sides. A header control that holds the keyboard and is still
 * showing keeps it — except on the render that changes the view back to the days, where a person
 * returns to choose a day. ADR 0226.
 *
 * jsdom lays nothing out, so every element reports no client rects and reads as unseen. The rule
 * keeps the keyboard only on a control that is showing, so here an element counts as showing unless
 * it sits under `hidden`. Without that, the button that paged would read as gone and the paging
 * case would pass for the wrong reason.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

window.HTMLElement.prototype.getClientRects = function () { return this.closest("[hidden]") === null ? [{}] : []; };

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
const press = (element) => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

const CASES = [
  { kind: "datepicker", component: () => m.MdyDatepickerField, held: "2026-06-05" },
  { kind: "daterange", component: () => m.MdyDaterangeField, held: { start: "2026-06-05", end: "2026-06-06" } },
];

for (const one of CASES) {
  test(`${one.kind}: the title out to the years keeps the keyboard, the title back puts it on the day`, async () => {
    const form = m.createVueForm({ when: field(one.held) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(one.component(), { field: form.f.when, label: "Quando", widgetId: "w" }),
    });
    app.mount(host);
    await settle();
    try {
      press(host.querySelector("button"));
      await settle();
      const grid = document.getElementById("w__grid");
      const onTheDay = () => grid.contains(document.activeElement) && document.activeElement !== grid;
      const title = document.getElementById("w__heading").closest("button");
      const next = title.nextElementSibling;
      assert.match(next?.className ?? "", /--next/, "no Next button sits after the title");

      title.focus();
      press(title);
      await settle();
      assert.equal(grid.hidden, true, "the title did not leave the days");
      assert.equal(document.activeElement, title, "the title that opened the years let go of the keyboard");

      press(title);
      await settle();
      assert.equal(grid.hidden, false, "the title did not bring the days back");
      assert.ok(onTheDay(), `the title that brought the days back left the keyboard on .${document.activeElement?.className}`);

      next.focus();
      press(next);
      await settle();
      assert.equal(document.activeElement, next, "a page turned by Next took the keyboard off Next");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });
}
