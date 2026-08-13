/**
 * The range picker, driven the way a person drives it.
 *
 * It kept nine reactive properties of its own — the draft, the preview, which pick opens the range
 * and which closes it, the month on screen, the focused cell, the view — and decided all of them
 * itself, as the range picker of every other renderer did. Now it asks the controller for the kind.
 *
 * The check is behavioural rather than structural: the same clicks, and what the form ends up
 * holding. A migration that compiles and no longer commits a range is the failure mode worth having
 * a test for.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
defineMdyElements();

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
};

async function open() {
  const form = createLitForm({ stay: field({ start: null, end: null }) });
  const element = await mount("mdy-daterange-field", (el) => {
    el.field = form.f.stay;
    el.label = "Stay";
  });
  element.querySelector(".mdy-datepicker__toggle").click();
  await settle(element);
  return { form, element };
}

const cells = (element) => [...element.querySelectorAll(".mdy-datepicker__cell")];
const cellFor = (element, iso) => cells(element).find((c) => c.dataset.iso === iso || c.getAttribute("data-iso") === iso);

test("two picks make a range, and the popup closes on the second", async () => {
  const { form, element } = await open();
  const enabled = cells(element).filter((c) => !c.disabled);
  assert.ok(enabled.length > 2, "the calendar drew no pickable days");

  enabled[5].click();
  await settle(element);
  assert.equal(form.f.stay.value().start, null, "one end is not a range, so nothing is committed");

  enabled[9].click();
  await settle(element);
  const value = form.f.stay.value();
  assert.ok(value.start && value.end, "the second pick closes the range and writes it");
  assert.ok(value.start <= value.end, "the ends come out in order whichever was clicked first");
  assert.equal(element.querySelector(".mdy-datepicker__popup"), null, "the popup stayed open over a finished range");

  element.remove();
});

test("the preview follows the pointer before anything is decided", async () => {
  const { form, element } = await open();
  const enabled = cells(element).filter((c) => !c.disabled);

  enabled[3].click();
  await settle(element);
  enabled[7].dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
  await settle(element);

  // The highlight is the previewed range, which is what makes a range visible before it exists.
  const inRange = element.querySelectorAll(".mdy-datepicker__cell--in-range");
  assert.ok(inRange.length > 0, "hovering a second end highlighted nothing");
  assert.equal(form.f.stay.value().start, null, "a preview is not a decision");

  element.remove();
});

test("the header reaches the years, and choosing narrows back to the days", async () => {
  const { element } = await open();
  element.querySelector(".mdy-datepicker__view-toggle").click();
  await settle(element);
  const years = element.querySelector(".mdy-datepicker__year-picker");
  assert.ok(years, "the header opened no year view");

  years.querySelector("button:not([disabled])").click();
  await settle(element);
  assert.ok(element.querySelector(".mdy-datepicker__month-picker"), "a year lands on its months");

  element.querySelector(".mdy-datepicker__month-picker").querySelector("button:not([disabled])").click();
  await settle(element);
  assert.ok(element.querySelector(".mdy-datepicker__grid"), "a month lands on its days");

  element.remove();
});
