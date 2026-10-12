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
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();
window.HTMLElement.prototype.getClientRects = function () { return this.closest("[hidden]") === null ? [{}] : []; };

/**
 * Waits until the render a step causes has happened, then lets the update that follows it finish.
 *
 * Each step waits on what it changes on screen — the view or the page — never on the focus the test
 * goes on to assert, so a focus that moves late still fails the assertion instead of being waited out.
 */
const settle = async (element, drawn) => {
  for (const deadline = Date.now() + 2000; !drawn(); await new Promise((resolve) => setTimeout(resolve, 0))) {
    if (Date.now() > deadline) assert.fail("the step never drew what it changes");
    await element.updateComplete;
  }
  await element.updateComplete;
};

const CASES = [
  { tag: "mdy-datepicker-field", held: "2026-06-05" },
  { tag: "mdy-daterange-field", held: { start: "2026-06-05", end: "2026-06-06" } },
];

const onTheDay = () => document.activeElement?.classList?.contains("mdy-datepicker__cell--focused") === true;

for (const one of CASES) {
  test(`${one.tag}: the title out to the years keeps the keyboard, the title back puts it on the day`, async () => {
    const form = createLitForm({ d: field(one.held) });
    const element = await mount(one.tag, (host) => { host.field = form.f.d; host.label = "D"; });
    await settle(element, () => element.querySelector("[aria-haspopup], [aria-expanded]") !== null);
    const opener = element.querySelector("[aria-haspopup]") ?? element.querySelector("[aria-expanded]");
    const days = () => element.querySelector("[role='grid']") !== null && element.querySelector(".mdy-datepicker__year-grid") === null;
    opener.focus();
    opener.click();
    await settle(element, days);
    assert.ok(onTheDay(), "the calendar did not open with the keyboard on a day");

    const next = element.querySelector("button[class*='--next']");
    const title = next.previousElementSibling;
    assert.equal(title?.tagName, "BUTTON", "no title button sits before Next");

    title.focus();
    title.click();
    await settle(element, () => !days());
    assert.equal(document.activeElement, title, "the title that opened the years let go of the keyboard");

    title.click();
    await settle(element, days);
    assert.ok(onTheDay(), `the title that brought the days back left the keyboard on .${document.activeElement?.className}`);

    const page = title.textContent;
    next.focus();
    next.click();
    await settle(element, () => title.textContent !== page);
    assert.equal(document.activeElement, next, "a page turned by Next took the keyboard off Next");
    element.remove();
  });
}
