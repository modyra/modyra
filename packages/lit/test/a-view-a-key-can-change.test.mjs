/**
 * The calendar's other views can be reached from a keyboard.
 *
 * The months and years views are opened by a button in the header, and no key declared a change of
 * view at all: every intent this kind declares while open moves *within* the view being shown. So
 * the act behind that button was operable with a pointer and with nothing else — the species ADR
 * 0198 names, not the affordance the month arrows are. ADR 0199.
 *
 * **Asserted by pressing the gesture and reading where focus is, not by reading the view's state.**
 * This renderer is why that distinction earns its place: it changed the view correctly and left the
 * keyboard on a cell the render had just removed, because it only ever landed focus in the days —
 * which was invisible while the only way into these views was a pointer on the header.
 *
 * The gesture is the platform's accelerator, taken from the declaration rather than named here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_KEYBOARD, partClasses } = await import("@modyra/widgets");

defineMdyElements();

const CELL = { days: partClasses("datepicker", "gridcell")[0], months: partClasses("datepicker", "monthCell")[0], years: partClasses("datepicker", "yearCell")[0] };
// Both accelerators, and that is the measurement rather than a convenience. `primary` is documented
// as the platform's own — `Cmd` where the platform uses it, `Ctrl` elsewhere — but the matcher
// accepts either on every platform, so pressing only the one this machine happens to use would leave
// the other declared and unexercised.
const ACCELERATORS = [{ ctrlKey: true }, { metaKey: true }];

function zoomKeys() {
  const declared = MDY_WIDGET_KEYBOARD.datepicker.filter((one) => one.intent === "view" && one.when === "open");
  const out = declared.find((one) => one.by === 1);
  const back = declared.find((one) => one.by === -1);
  assert.ok(out && back, "the kind declares no pair of gestures for stepping between its views");
  assert.equal(out.modifier, "primary", "the gesture is no longer the platform's accelerator, so the press below is the wrong one");
  return { out: out.key, back: back.key };
}

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};

async function openCalendar() {
  const form = createLitForm({ d: field(null) });
  const element = await mount("mdy-datepicker-field", (host) => { host.field = form.f.d; host.label = "D"; });
  await settle(element);
  const opener = element.querySelector("[aria-haspopup]") ?? element.querySelector("[aria-expanded]");
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  opener.click();
  await settle(element);
  assert.ok(
    document.activeElement?.classList?.contains(CELL.days),
    `the calendar opened with focus on .${document.activeElement?.className}, not on a day`,
  );
  const press = async (key, held = {}) => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
    await settle(element);
  };
  return { element, press };
}

const viewHoldingFocus = () => {
  const at = document.activeElement;
  const found = Object.entries(CELL).find(([, cls]) => at?.classList?.contains(cls));
  return found?.[0] ?? `nothing (.${at?.className ?? "?"})`;
};

for (const accelerator of ACCELERATORS) {
  const held = Object.keys(accelerator)[0];
  test(`${held}: the accelerator steps out to the months, then to the years, and the keyboard goes with it`, async () => {
    const { element, press } = await openCalendar();
    const { out } = zoomKeys();

    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "months", "stepping out of the days did not land the keyboard in the months");

    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "years", "stepping out of the months did not land the keyboard in the years");

    // Clamped, not wrapped: a ring would send a held key from the widest view straight back to the
    // narrowest and oscillate there.
    await press(out, accelerator);
    assert.equal(viewHoldingFocus(), "years", "stepping out of the widest view wrapped round instead of stopping");
    element.remove();
  });
}

test("and back in again, one view at a time", async () => {
  const { element, press } = await openCalendar();
  const { out, back } = zoomKeys();

  await press(out, ACCELERATORS[0]);
  await press(out, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "years", "the walk out did not reach the years, so the walk back is measuring nothing");

  await press(back, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "months", "stepping back in from the years did not stop at the months");

  await press(back, ACCELERATORS[0]);
  assert.equal(viewHoldingFocus(), "days", "stepping back in from the months did not reach the days");
  element.remove();
});
