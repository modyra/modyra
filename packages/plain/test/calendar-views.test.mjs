/**
 * The month and year views.
 *
 * A calendar that only pages a month at a time puts a birth date thirty clicks away, and this
 * renderer did exactly that until the view mode became part of the widget contract. The check is
 * behavioural rather than structural: opening the views, choosing in them, and arriving back at the
 * day grid holding the month and year the user chose.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_PAINT_BEATS, settleFor } = await import("../../widgets/dist/testing/index.js");
const { PAINT_BEAT } = await import("../conformance.config.mjs");

/** The beat this renderer declares it paints on, rather than a number guessed here. */
const settle = () => settleFor(PAINT_BEAT ?? MDY_PAINT_BEATS.task);

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { form } = mountMdyForm(
    host,
    [{ kind: "datepicker", name: "when", label: "When", value: "2026-07-15" }],
    { submitLabel: null },
  );
  host
    .querySelector(".mdy-datepicker__toggle")
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  return { host, form };
}

const label = (host) => host.querySelector(".mdy-datepicker__header-label");
const monthGrid = (host) => host.querySelector(".mdy-datepicker__month-picker");
const yearGrid = (host) => host.querySelector(".mdy-datepicker__year-picker");
const dayGrid = (host) => host.querySelector(".mdy-datepicker__grid");

test("the header opens the years, and closes back to the days", async () => {
  const { host } = await mount();
  assert.equal(dayGrid(host).hidden, false, "a calendar opens on its days");
  assert.equal(yearGrid(host).hidden, true);

  // The top of the funnel, not the next step down it: someone reaching for the header wants a date
  // far from the month on screen, and walking the months to get there is the paging this avoids.
  label(host).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  assert.equal(yearGrid(host).hidden, false, "the label opened the years");
  assert.equal(dayGrid(host).hidden, true, "the views replace the grid, they do not stack on it");

  label(host).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  assert.equal(dayGrid(host).hidden, false, "and again, back to the days");
  assert.equal(yearGrid(host).hidden, true);
});

test("choosing narrows towards the days, and the grid follows", async () => {
  const { host } = await mount();
  label(host).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();

  const years = [...yearGrid(host).querySelectorAll("button")];
  const target = years.find((button) => button.textContent.trim() === "2030");
  assert.ok(target, "the year picker offers a year a century either side");
  target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  assert.equal(monthGrid(host).hidden, false, "choosing a year lands on its months");

  const months = [...monthGrid(host).querySelectorAll("button")];
  months[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  assert.equal(dayGrid(host).hidden, false, "choosing a month lands on its days");
  assert.match(label(host).textContent, /2030/, "the calendar is showing the year that was chosen");
});

test("the views carry the semantics the day grid already had", async () => {
  const { host } = await mount();
  label(host).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();

  assert.equal(yearGrid(host).getAttribute("role"), "grid", "a run of bare buttons announces nothing");
  const chosen = yearGrid(host).querySelector('[aria-selected="true"]');
  assert.ok(chosen, "which year is showing was a class and nothing a screen reader could read");
  assert.equal(chosen.textContent.trim().length > 0, true);
});

test("choosing a month or a year commits no value", async () => {
  const { host, form } = await mount();
  const before = form.f.when.value();
  label(host).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  yearGrid(host).querySelector("button:not([disabled])").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  monthGrid(host).querySelectorAll("button")[4].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  assert.equal(form.f.when.value(), before, "navigating is not picking");
});
