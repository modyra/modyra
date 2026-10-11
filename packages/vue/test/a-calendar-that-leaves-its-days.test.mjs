/**
 * A calendar's header leads somewhere a person can see.
 *
 * The controllers hold three views and answer the header press by switching between them. A renderer
 * that only ever draws the days takes that press, changes nothing on screen, and leaves the years and
 * months reachable by nobody. The other two views are drawn from the contract's projection, so the
 * bounds a field declares grey out the months and years they rule out.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { calendarViewAfterPick, calendarViewOnToggle } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
const press = (element) => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

const CASES = [
  { kind: "datepicker", component: () => m.MdyDatepickerField, held: "2026-06-05" },
  { kind: "daterange", component: () => m.MdyDaterangeField, held: { start: "2026-06-05", end: "2026-06-06" } },
];

for (const one of CASES) {
  test(`${one.kind}: the header goes out to the years, and choosing comes back down to the days`, async () => {
    const form = m.createVueForm({ when: field(one.held) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(one.component(), { field: form.f.when, label: "Quando", widgetId: "w", minDate: "2025-03-10", maxDate: "2026-06-20" }),
    });
    app.mount(host);
    await settle();
    try {
      press(host.querySelector("button"));
      await settle();
      const byId = (id) => document.getElementById(id);
      // Which view is on screen, read from the views themselves rather than from the controller.
      const shown = () => ["grid", "months", "years"].filter((part) => byId(`w__${part}`)?.hidden === false);
      assert.deepEqual(shown(), ["grid"], "the calendar did not open on its days");

      press(byId("w__heading").closest("button"));
      await settle();
      assert.equal(calendarViewOnToggle("days"), "years");
      assert.deepEqual(shown(), ["years"], "pressing the header did not reach the years");

      const years = [...byId("w__years").querySelectorAll("button")];
      assert.deepEqual(years.map((each) => each.textContent), ["2025", "2026"], "the years ignore the declared bounds");
      assert.equal(byId("w__years").getAttribute("role"), "grid");
      assert.ok(byId("w__years").getAttribute("aria-labelledby"), "the years view is a grid nobody named");
      assert.equal(years[1].getAttribute("aria-selected"), "true", "the year on screen is not the one said to be chosen");

      // Choosing the year already on screen is still a choice: it lands on that year's months.
      press(years[1]);
      await settle();
      assert.equal(calendarViewAfterPick("years"), "months");
      assert.deepEqual(shown(), ["months"], "choosing a year did not land on its months");

      const months = [...byId("w__months").querySelectorAll("button")];
      assert.equal(months.length, 12);
      assert.equal(months[6].disabled, true, "a month past the limit is offered");
      assert.equal(months[2].disabled, false, "a month inside the limit is refused");
      assert.equal(months[5].getAttribute("aria-selected"), "true", "June is on screen and not said to be chosen");

      press(months[2]);
      await settle();
      assert.deepEqual(shown(), ["grid"], "choosing a month did not land on its days");
      assert.match(byId("w__heading").textContent, /2026/);
      assert.doesNotMatch(byId("w__heading").textContent, /June|Jun/, "the month chosen is not the month shown");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });
}
