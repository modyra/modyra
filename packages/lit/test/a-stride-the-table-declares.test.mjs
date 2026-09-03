/**
 * The longer stride is one the table declares, and one the calendar actually takes.
 *
 * `PageUp` turns to the previous month and `Shift`+`PageUp` to the previous year. The second half
 * shipped in every renderer and was written down nowhere: the keyboard table said only that these
 * keys move a page, so a legend built from it would have told a person the calendar turns a month at
 * a time — which is half of what their keyboard does. This is the mirror of the defects this batch
 * repaired: there, rules declared and honoured by nobody; here, an act honoured and declared by
 * nobody.
 *
 * **Both halves are asserted, and the bare one first.** A run where the plain press also failed to
 * move would report "the year did not jump" about a calendar that was not moving at all, and the
 * distance is the whole claim: a month is not a year, and only comparing the two says which
 * happened.
 *
 * The keys are read from the declaration. A bench naming `PageUp` would keep passing after the
 * binding moved, which is the failure this file exists to make impossible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_KEYBOARD } = await import("@modyra/widgets");

defineMdyElements();

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};

/** The key that pages backwards, taken from whichever binding declares the longer stride. */
function pagingKey(kind) {
  const declared = MDY_WIDGET_KEYBOARD[kind].filter((one) => one.longStride === true && one.when === "open");
  assert.ok(declared.length > 0, `${kind} declares no movement with a longer stride, so this bench has no subject`);
  const back = declared.find((one) => one.by === -1);
  assert.ok(back, `${kind} declares a longer stride only in one direction`);
  assert.equal(back.page, true, "the longer stride is declared on a movement that is not a page, so the units below are guesswork");
  return back.key;
}

async function openCalendar(kind) {
  const form = createLitForm({ d: field(kind === "daterange" ? { start: null, end: null } : null) });
  const host = await mount(`mdy-${kind}-field`, (element) => { element.field = form.f.d; element.label = "D"; });
  await settle(host);
  const opener = host.querySelector("[aria-haspopup]") ?? host.querySelector("[aria-expanded]");
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  opener.click();
  await settle(host);
  const heading = () => host.querySelector(".mdy-datepicker__header-label")?.textContent?.trim()
    ?? host.querySelector(".mdy-datepicker__view-toggle")?.textContent?.trim() ?? null;
  assert.ok(heading(), "the calendar drew no heading, so there is nothing that says which month is showing");
  const press = async (key, held = {}) => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
    await settle(host);
  };
  return { host, heading, press };
}

const yearOf = (heading) => Number(/\d{4}/.exec(heading)?.[0]);

for (const kind of ["datepicker", "daterange"]) {
  test(`${kind}: the page key turns a month, and held with Shift it turns a year`, async () => {
    const { host, heading, press } = await openCalendar(kind);
    const key = pagingKey(kind);

    const start = heading();
    const startYear = yearOf(start);
    assert.ok(Number.isFinite(startYear), `the heading reads ${JSON.stringify(start)}, which holds no year to compare`);

    // The bare press first: without it, "the year did not move" could be said of a calendar that
    // does not move at all.
    await press(key);
    const paged = heading();
    assert.notEqual(paged, start, `${key} did not turn the calendar at all, so nothing below is about a stride`);
    assert.equal(yearOf(paged), startYear, `${key} alone left the month behind and changed the year — the two strides are the same length`);

    await press(key, { shiftKey: true });
    assert.equal(
      yearOf(heading()),
      startYear - 1,
      `Shift+${key} moved the calendar from ${paged} to ${heading()} — the declaration says this movement takes a longer stride`,
    );
    host.remove();
  });
}
