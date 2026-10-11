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

  // A year's keys are the button's: an arrow on it moves nothing underneath, so the hidden days take
  // neither the value nor the focus, and the years stay on screen.
  test(`${one.kind}: an arrow pressed on a year leaves the value and the years where they are`, async () => {
    const form = m.createVueForm({ when: field(one.held) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(one.component(), { field: form.f.when, label: "Quando", widgetId: "w", minDate: "2025-03-10", maxDate: "2026-06-20" }),
    });
    const thrown = [];
    app.config.errorHandler = (error) => { thrown.push(error); };
    app.mount(host);
    await settle();
    try {
      press(host.querySelector("button"));
      await settle();
      const byId = (id) => document.getElementById(id);
      press(byId("w__heading").closest("button"));
      await settle();
      const year = byId("w__years").querySelectorAll("button")[1];
      year.focus();
      for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "PageDown"]) {
        year.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        await settle();
      }
      assert.deepEqual(thrown, [], "an arrow on a year threw");
      assert.deepEqual(form.f.when.value(), one.held, "an arrow on a year changed the value");
      assert.equal(byId("w__years").hidden, false, "an arrow on a year left the years");
      assert.equal(byId("w__grid").hidden, true, "an arrow on a year brought the days back");
      assert.ok(!byId("w__grid").contains(document.activeElement), "an arrow on a year sent the focus into the hidden days");

      // Enter on a year is the button's own press: it chooses the year, and commits no day.
      const keyed = byId("w__years").querySelectorAll("button")[0];
      keyed.focus();
      const enter = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      if (keyed.dispatchEvent(enter)) press(keyed);
      await settle();
      assert.deepEqual(form.f.when.value(), one.held, "Enter on a year committed a day");
      assert.equal(byId("w__months").hidden, false, "Enter on a year did not reach its months");

      // The button keeps its own keys, and the panel still closes from it.
      const opener = host.querySelector("[aria-expanded]");
      assert.equal(opener.getAttribute("aria-expanded"), "true");
      byId("w__months").querySelector("button").dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await settle();
      assert.equal(opener.getAttribute("aria-expanded"), "false", "Escape on a month did not close the panel");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });

  // The declared step between views, held with the accelerator: out from the days to the months and
  // the years, clamped there, and back in — from whichever view the keyboard is standing in, with the
  // focus following into the view reached.
  test(`${one.kind}: the accelerator and a vertical arrow step out to the years and back to the days`, async () => {
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
      const shown = () => ["grid", "months", "years"].filter((part) => byId(`w__${part}`)?.hidden === false);
      const step = async (key) => {
        const pressed = new window.KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
        (document.activeElement ?? byId("w__grid")).dispatchEvent(pressed);
        await settle();
        return pressed.defaultPrevented;
      };
      byId("w__grid").querySelector('[tabindex="0"]').focus();

      assert.equal(await step("ArrowUp"), true, "the step out was left to the browser");
      assert.deepEqual(shown(), ["months"], "the step out from the days did not reach the months");
      assert.equal(byId("w__months").querySelector('[aria-selected="true"]'), document.activeElement,
        "the focus did not follow into the months, onto the month on screen");

      await step("ArrowUp");
      assert.deepEqual(shown(), ["years"], "a second step out did not reach the years");
      assert.equal(document.activeElement?.textContent, "2026", "the focus did not land on the year on screen");

      await step("ArrowUp");
      assert.deepEqual(shown(), ["years"], "a step out past the years went somewhere");

      await step("ArrowDown");
      assert.deepEqual(shown(), ["months"], "the step in from the years did not reach the months");
      await step("ArrowDown");
      assert.deepEqual(shown(), ["grid"], "the step in from the months did not reach the days");
      assert.ok(byId("w__grid").contains(document.activeElement), "the focus did not come back to the days");
      assert.deepEqual(form.f.when.value(), one.held, "stepping between views changed the value");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });
}
