/**
 * The date field: the calendar's first column, and who answers the keyboard.
 *
 * The alignment test is here because the two halves of a calendar come from different places and
 * agree only if someone makes them. The grid the controller lays out begins on the locale's first
 * day of the week; the weekday labels Intl hands back are Sunday-first whatever the locale. Read
 * straight through, they line up **in English and nowhere else** — every column a day out, in a
 * calendar that otherwise looks perfectly well made. Asserting it in one locale would prove nothing:
 * English is the one where the accident is invisible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyDatepickerField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { buildDateLocale } = await import("../../core/dist/datetime.js");
const { partClasses, popupHoldsAnAction } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("datepicker", part)[0];

const draw = (locale = "en") => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyDatepickerField, { field: form.f.value, widgetId: "d", label: "When", locale }),
  });
  app.mount(host);
  return { host, form, toggle: host.querySelector(`.${cls("toggle")}`), dispose: () => { app.unmount(); host.remove(); } };
};

const open = async (fixture) => { fixture.toggle.click(); await settle(); };
/** The day of the week a cell's date falls on, read from the id the contract spells. */
const weekdayOfFirstCell = (host) => {
  const iso = host.querySelector("[role=gridcell]").id.replace(/^.*__day__/, "");
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
};

for (const locale of ["en", "it"]) {
  test(`${locale}: the first column is the day the week starts on`, async () => {
    const fixture = draw(locale);
    await open(fixture);

    const expected = buildDateLocale(locale).firstDayOfWeek;
    assert.equal(
      weekdayOfFirstCell(fixture.host), expected,
      `the grid starts on weekday ${weekdayOfFirstCell(fixture.host)} and this locale's week starts on ${expected}`,
    );

    const headers = [...fixture.host.querySelectorAll("[role=columnheader]")].map((e) => e.textContent);
    const names = buildDateLocale(locale).dayNamesNarrow;
    assert.equal(headers.length, names.length, "there is not one header per column");
    assert.equal(
      headers[0], names[expected],
      `the first column is labelled "${headers[0]}" and holds ${names[expected]}`,
    );
    fixture.dispose();
  });
}

test("the reading position gets focus when the calendar opens", async () => {
  const fixture = draw();
  await open(fixture);

  const focused = document.activeElement;
  assert.ok(focused?.classList?.contains(cls("gridcell")), `focus is on .${focused?.className || "nothing"}`);
  assert.ok(focused.id.includes("__day__"), "the focused element is not a day");
  fixture.dispose();
});

test("an arrow moves the reading position, and the calendar answers it", async () => {
  const fixture = draw();
  await open(fixture);
  const before = document.activeElement.id;

  document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await settle();

  assert.notEqual(document.activeElement.id, before, "ArrowRight left the reading position where it was");
  fixture.dispose();
});

test("Tab closes the calendar and is left to the browser", async () => {
  const fixture = draw();
  await open(fixture);
  assert.equal(popupHoldsAnAction("datepicker"), false,
    "this calendar now holds an action of its own, so Tab is no longer expected to leave");

  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();

  assert.equal(fixture.toggle.getAttribute("aria-expanded"), "false", "Tab left the calendar open behind the person");
  assert.equal(
    event.defaultPrevented, false,
    "Tab was swallowed: the calendar closed and focus never moved on, which is a field you cannot leave",
  );
  fixture.dispose();
});

test("the grid is still referenced when the calendar is shut", () => {
  const fixture = draw();

  // The control names the grid with `aria-controls` on every render, so the grid has to exist while
  // the calendar is shut. Removing it on close leaves the control pointing at nothing.
  const control = fixture.host.querySelector(`.${cls("control")}`);
  const controls = control.getAttribute("aria-controls");
  assert.ok(controls, "the control names no grid at all");
  assert.ok(
    fixture.host.ownerDocument.getElementById(controls),
    `aria-controls points at ${controls}, which is not in the document`,
  );
  fixture.dispose();
});
