/**
 * The calendar's other views can be reached from a keyboard.
 *
 * The months and years views are opened by a button in the header, and no key declared a change of
 * view at all: every intent this kind declares while open moves *within* the view being shown. So
 * the act behind that button was operable with a pointer and with nothing else — the species ADR
 * 0198 names, not the affordance the month arrows are. ADR 0199.
 *
 * **Asserted by pressing the gesture and reading where focus is, not by reading the view's state.**
 * A view that changed while the keyboard stayed on a cell the render has taken away is not a view a
 * person reached: the next press goes to the document. Focus inside the view is the whole claim.
 *
 * The gesture is the platform's accelerator, taken from the declaration rather than named here —
 * this is the first binding outside `undo` to use it, so a bench spelling `Ctrl` would pass on one
 * platform and be measuring nothing on the other.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_WIDGET_KEYBOARD, partClasses } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const CELL = { days: partClasses("datepicker", "gridcell")[0], months: partClasses("datepicker", "monthCell")[0], years: partClasses("datepicker", "yearCell")[0] };

/** The two gestures the kind declares for stepping between its views, by the direction each goes. */
function zoomKeys() {
  const declared = MDY_WIDGET_KEYBOARD.datepicker.filter((one) => one.intent === "view" && one.when === "open");
  const out = declared.find((one) => one.by === 1);
  const back = declared.find((one) => one.by === -1);
  assert.ok(out && back, "the kind declares no pair of gestures for stepping between its views");
  assert.equal(out.modifier, "primary", "the gesture is no longer the platform's accelerator, so the press below is the wrong one");
  return { out: out.key, back: back.key };
}

// Both accelerators, and that is the measurement rather than a convenience. `primary` is documented
// as the platform's own — `Cmd` where the platform uses it, `Ctrl` elsewhere — but the matcher
// accepts either on every platform, so pressing only the one this machine happens to use would leave
// the other declared and unexercised.
const ACCELERATORS = [{ ctrlKey: true }, { metaKey: true }];

async function openCalendar() {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "d", kind: "datepicker", label: "D" }], { submitLabel: null });
  await settle();
  const root = host.querySelector('[data-mdy-field="d"]');
  const opener = root.querySelector("[aria-haspopup]") ?? root.querySelector("[aria-expanded]");
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  opener.dispatchEvent(new window.Event("click", { bubbles: true }));
  await settle();
  // The precondition: the calendar is showing its days and the keyboard is on one of them. A run
  // that started anywhere else would report about a step it never took from where it claims.
  assert.ok(
    document.activeElement?.classList?.contains(CELL.days),
    `the calendar opened with focus on .${document.activeElement?.className}, not on a day`,
  );
  return { host, root };
}

const press = async (key, held = {}) => {
  document.activeElement?.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
  await settle();
};

/** Which view holds the keyboard, named by the class the cell under it carries. */
const viewHoldingFocus = () => {
  const at = document.activeElement;
  const found = Object.entries(CELL).find(([, cls]) => at?.classList?.contains(cls));
  return found?.[0] ?? `nothing (.${at?.className ?? "?"})`;
};

for (const accelerator of ACCELERATORS) {
  const held = Object.keys(accelerator)[0];
  test(`${held}: the accelerator steps out to the months, then to the years, and the keyboard goes with it`, async () => {
    const { host } = await openCalendar();
    const { out } = zoomKeys();

    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "months", "stepping out of the days did not land the keyboard in the months");

    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "years", "stepping out of the months did not land the keyboard in the years");

    // Clamped, not wrapped: a ring would send a held key from the widest view straight back to the
    // narrowest and oscillate there.
    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "years", "stepping out of the widest view wrapped round instead of stopping");
    host.remove();
  });
}

test("and back in again, one view at a time", async () => {
  const { host } = await openCalendar();
  const { out, back } = zoomKeys();

  await press(out, ACCELERATORS[0]);
  await press(out, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "years", "the walk out did not reach the years, so the walk back is measuring nothing");

  await press(back, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "months", "stepping back in from the years did not stop at the months");

  await press(back, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "days", "stepping back in from the months did not reach the days");
  host.remove();
});

test("the bare arrow still walks the grid, and the held one does not move a day", async () => {
  const { host, root } = await openCalendar();
  const { back } = zoomKeys();
  const focusedDay = () => root.querySelector('[role="grid"]')?.querySelector('[tabindex="0"]')?.textContent?.trim();

  const before = focusedDay();
  assert.ok(before, "no day carries the reading position, so a movement cannot be seen");

  // The collision this gesture was chosen to avoid. Asserted where it could actually happen — inside
  // the grid, with a press that changes no view because it is already at the narrowest one. Measured
  // from the trigger instead, the grid's own handler never runs and the collision cannot appear.
  await press(back, ACCELERATORS[0]);
  assert.equal(focusedDay(), before, `the held arrow moved the reading position from ${before} to ${focusedDay()} as well as meaning a view change`);

  await press(back);
  assert.notEqual(focusedDay(), before, "the bare arrow stopped walking the grid");
  host.remove();
});
