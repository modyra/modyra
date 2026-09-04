/**
 * The date range: two presses make a choice, and the calendar under it is the date field's.
 *
 * The shared half is asserted here as *sameness*, not re-tested: the two kinds draw one calendar, so
 * the check that matters is that the range's grid starts where the date field's does. Copying the
 * date field's assertions would pass just as well against two independent copies, which is the state
 * this file exists to prevent.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyDaterangeField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { buildDateLocale } = await import("../../core/dist/datetime.js");
const { partClasses } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("daterange", part)[0];

const draw = (locale = "it") => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyDaterangeField, { field: form.f.value, widgetId: "r", label: "When", locale }),
  });
  app.mount(host);
  return { host, form, toggle: host.querySelector(`.${cls("toggle")}`), dispose: () => { app.unmount(); host.remove(); } };
};

const open = async (fixture) => { fixture.toggle.click(); await settle(); };
const dayCell = (host, iso) => host.querySelector(`[id$="__day__${iso}"]`);

test("the grid starts where this locale's week starts", async () => {
  // Asserted in Italian on purpose: the labels Intl returns are Sunday-first whatever the locale, so
  // English is the one language where getting this wrong is invisible.
  const fixture = draw("it");
  await open(fixture);

  const iso = fixture.host.querySelector("[role=gridcell]").id.replace(/^.*__day__/, "");
  assert.equal(
    new Date(`${iso}T00:00:00Z`).getUTCDay(), buildDateLocale("it").firstDayOfWeek,
    "the range's grid does not start on the day this locale's week starts on",
  );
  fixture.dispose();
});

test("two presses make a range, and one press does not", async () => {
  const fixture = draw();
  await open(fixture);
  const cells = [...fixture.host.querySelectorAll("[role=gridcell]")];
  const first = cells[10];
  const second = cells[14];

  first.click();
  await settle();
  const afterOne = fixture.form.f.value.value();
  assert.ok(
    afterOne === null || afterOne.end === null || afterOne.end === undefined,
    `one press already produced a finished range (${JSON.stringify(afterOne)}), so the second press decides nothing`,
  );

  second.click();
  await settle();
  const afterTwo = fixture.form.f.value.value();
  assert.ok(afterTwo, "two presses produced no range at all");
  assert.ok(afterTwo.start && afterTwo.end, `the range is still incomplete: ${JSON.stringify(afterTwo)}`);
  assert.ok(afterTwo.start <= afterTwo.end, `the range runs backwards: ${JSON.stringify(afterTwo)}`);
  fixture.dispose();
});

test("both ends are named, and the separator is not read out", async () => {
  const fixture = draw();

  const inputs = [...fixture.host.querySelectorAll("input")];
  assert.equal(inputs.length, 2, "a range has two boxes");
  for (const input of inputs) {
    const named = input.getAttribute("aria-label") ?? input.getAttribute("aria-labelledby");
    assert.ok(named, "one end of the range has no name, so it is announced as an unlabelled box");
  }
  assert.notEqual(inputs[0].getAttribute("aria-label"), inputs[1].getAttribute("aria-label"),
    "both ends carry the same name, so they cannot be told apart");

  // What the dash means is already said by the two boxes having their own names; announcing
  // "en dash" between them tells a person nothing they need.
  const separator = fixture.host.querySelector(`.${cls("separator")}`);
  assert.equal(separator?.getAttribute("aria-hidden"), "true", "the separator is read out between the two ends");
  fixture.dispose();
});

test("the panel the toggle names is in the document while it is shut", () => {
  const fixture = draw();

  const controls = fixture.toggle.getAttribute("aria-controls");
  assert.ok(controls, "the toggle names no panel at all");
  assert.ok(
    fixture.host.ownerDocument.getElementById(controls),
    `aria-controls points at ${controls}, which is not in the document`,
  );
  fixture.dispose();
});
