/**
 * The number on an option in an open list can be changed from a keyboard.
 *
 * In counter mode each option carries a quantity between two `±` buttons. Those buttons are
 * `tabindex="-1"` — deliberately, because a stop per button would make Tab a scroll through the
 * list — so until the kind declared a key for them the number on a row could be changed with a
 * pointer and with nothing else. ADR 0198.
 *
 * **Asserted by pressing the key and reading the number, not by reading the element.** The `±`
 * buttons are in the document whatever else is true, so a check that asked whether they existed
 * passed on every day of the defect. The only question that separates the two is whether the
 * quantity moved.
 *
 * The keys are read from the contract rather than named here: the declaration and the renderer are
 * one decision, and a bench holding its own copy of the key names passes while the two disagree.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_WIDGET_KEYBOARD, partClasses, stateClass } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const COUNT = partClasses("multiselect", "optionCount")[0];
const OPTION = partClasses("multiselect", "option")[0];
const ACTIVE = stateClass(OPTION, "active");

/** The two keys the kind declares for the quantity on an option, by the direction each goes. */
function stepKeys() {
  const bindings = MDY_WIDGET_KEYBOARD.multiselect.filter(
    (one) => one.intent === "step" && one.on === "option" && one.when === "open",
  );
  const up = bindings.find((one) => one.by === 1);
  const down = bindings.find((one) => one.by === -1);
  assert.ok(up && down, "the kind declares no pair of keys for the quantity on an option");
  return { up: up.key, down: down.key };
}

async function openCounterList() {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{
    name: "tags", kind: "multiselect", label: "Tags", mode: "multi",
    options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
  }], { submitLabel: null });
  await settle();

  const root = host.querySelector('[data-mdy-field="tags"]');
  const trigger = root.querySelector("[aria-expanded]");
  trigger.focus();
  trigger.dispatchEvent(new window.Event("click", { bubbles: true }));
  await settle();
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the panel did not open, so nothing below is about an open list");

  const popup = document.getElementById(trigger.getAttribute("aria-controls"));
  assert.ok(popup, "the panel opened with no element to press into");
  // The precondition, and it is the whole subject: this key acts on *the option the cursor is on*.
  // A list opened with a pointer has no cursor, so a run that pressed straight away would report
  // "the quantity did not move" about a press that was never aimed at a row.
  await press("ArrowDown");
  assert.ok(popup.querySelector(`.${ACTIVE}`), "no option carries the cursor after ArrowDown, so nothing below is aimed at a row");
  return { host, popup };
}

const press = async (key) => {
  document.activeElement?.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await settle();
};

/**
 * What the counter on the option the cursor is on reads, as a number.
 *
 * The digits are taken out of the label rather than parsed from the whole of it — the counter reads
 * `\u00d70`, and a `Number` of that is `NaN`. Which matters more than it looks: `assert.strictEqual`
 * holds `NaN` equal to `NaN`, so a bench comparing two unparsed readings is green whether the
 * quantity moved or not. The parse is asserted, so an unreadable counter fails here instead.
 */
const quantityUnderCursor = (popup) => {
  const option = popup.querySelector(`.${ACTIVE}`);
  assert.ok(option, "no option carries the cursor, so there is no row this key acts on");
  const count = option.querySelector(`.${COUNT}`);
  assert.ok(count, "the option in counter mode drew no quantity");
  const digits = /\d+/.exec(count.textContent ?? "");
  assert.ok(digits, `the counter reads ${JSON.stringify(count.textContent)}, which holds no number to compare`);
  return Number(digits[0]);
};

test("the key raises the quantity on the option the cursor is on", async () => {
  const { host, popup } = await openCounterList();
  const before = quantityUnderCursor(popup);

  await press(stepKeys().up);

  assert.equal(
    quantityUnderCursor(popup),
    before + 1,
    `${stepKeys().up} left the quantity at ${before} — the number on this row is reachable with a `
    + "pointer and with nothing else",
  );
  host.remove();
});

test("the other key lowers it again, and stops at nothing chosen", async () => {
  const { host, popup } = await openCounterList();
  const { up, down } = stepKeys();

  await press(up);
  await press(up);
  assert.equal(quantityUnderCursor(popup), 2, `two presses of ${up} did not reach two`);

  await press(down);
  assert.equal(quantityUnderCursor(popup), 1, `${down} did not lower the quantity`);

  await press(down);
  await press(down);
  assert.equal(quantityUnderCursor(popup), 0, `${down} did not stop at nothing chosen`);
  host.remove();
});
