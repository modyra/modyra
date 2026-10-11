/**
 * The day grid is named by the month it shows, by referring to the heading that says so.
 *
 * `aria-labelledby` wins the name computation over `aria-label` always, so a grid carrying both is
 * named by the reference whatever the written caption says. The name is therefore asserted the way
 * a reader computes it: the reference resolves to one element, that element's text is the month,
 * and no written label sits beside the reference. The referenced element is the title *inside* the
 * view-toggle button and not the button — the button carries a name of its own, "change view,
 * currently …", and a reference crossing into it would name the grid with the way out. ADR 0212.
 *
 * Both kinds: a range draws the same header, and the one that was missing it is the reason this is
 * measured rather than assumed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_CONTRACTS, datepickerFieldPartIds, daterangeFieldPartIds } = await import("@modyra/widgets");

defineMdyElements();

const PART_IDS = { datepicker: datepickerFieldPartIds, daterange: daterangeFieldPartIds };
const classOf = (kind, part) => `.${MDY_WIDGET_CONTRACTS[kind].parts[part].classes.join(".")}`;

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};

async function openCalendar(kind) {
  const form = createLitForm({ d: field(kind === "daterange" ? { start: null, end: null } : null) });
  const host = await mount(`mdy-${kind}-field`, (element) => { element.field = form.f.d; element.label = "D"; });
  await settle(host);
  const opener = host.querySelector("[aria-haspopup]") ?? host.querySelector("[aria-expanded]");
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  opener.click();
  await settle(host);
  return host;
}

for (const kind of ["datepicker", "daterange"]) {
  test(`${kind}: the grid is named by referring to the month heading, and by nothing else`, async () => {
    const host = await openCalendar(kind);
    const grid = host.querySelector(classOf(kind, "grid"));
    assert.ok(grid, "no day grid");
    // The widget's id is the element's business, so it is read back from the grid the contract
    // names rather than guessed.
    assert.match(grid.id, /__grid$/, "the grid does not carry the id the contract names");
    const { headingId } = PART_IDS[kind](grid.id.replace(/__grid$/, ""));
    assert.equal(grid.getAttribute("aria-labelledby"), headingId, "the grid does not refer to the heading the contract names");
    assert.equal(grid.getAttribute("aria-label"), null, "a written label beside a reference reaches nobody and hides that the reference is wrong");
    const heading = document.getElementById(headingId);
    assert.ok(heading, `the reference points at "${headingId}" and nothing carries it: the grid is named by nothing`);
    assert.match(heading.textContent.trim(), /^\p{L}+ \d{4}$/u, "the heading does not read as a month and a year");
  });

  test(`${kind}: the heading is the title inside the view toggle, not the toggle`, async () => {
    const host = await openCalendar(kind);
    const grid = host.querySelector(classOf(kind, "grid"));
    const heading = document.getElementById(PART_IDS[kind](grid.id.replace(/__grid$/, "")).headingId);
    assert.ok(heading, "no heading");
    assert.ok(heading.matches(classOf(kind, "headerTitle")), `the heading is .${heading.className}, not the title part`);
    const toggle = heading.closest(classOf(kind, "viewToggle"));
    assert.ok(toggle, "the title is not inside the view toggle");
    assert.equal(toggle.tagName, "BUTTON", "the view toggle is not a button");
    assert.notEqual(toggle.getAttribute("aria-label"), null, "the toggle carries no name of its own, so the title would be its name and the grid would be named after the way out");
    const header = toggle.parentElement;
    assert.deepEqual(
      [...header.children].map((child) => child.tagName),
      ["BUTTON", "BUTTON", "BUTTON"],
      "the header is not three siblings [previous][view toggle][next]",
    );
    assert.ok(header.children[0].matches(classOf(kind, "headerPrevious")));
    assert.ok(header.children[2].matches(classOf(kind, "headerNext")));
  });
}
