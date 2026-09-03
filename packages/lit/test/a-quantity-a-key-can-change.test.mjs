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
 * The keys and the cursor are read from the contract rather than named here: the declaration and the
 * renderer are one decision, and a bench holding its own copy of either passes while the two
 * disagree.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_KEYBOARD, partClasses, stateClass } = await import("@modyra/widgets");

defineMdyElements();

const OPTION = partClasses("multiselect", "option")[0];
const ACTIVE = stateClass(OPTION, "active");
const COUNT = partClasses("multiselect", "optionCount")[0];

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};

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
  const form = createLitForm({ tags: field([]) });
  const element = await mount("mdy-multiselect-field", (host) => {
    host.field = form.f.tags;
    host.label = "Tags";
    host.mode = "multi";
    host.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  });
  await settle(element);

  const trigger = element.querySelector("[aria-expanded]");
  assert.ok(trigger, "the field drew no opener, so nothing was opened");
  trigger.focus();
  trigger.click();
  await settle(element);
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the panel did not open, so nothing below is about an open list");

  const press = async (key) => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await settle(element);
  };
  // The precondition, and it is the whole subject: this key acts on *the option the cursor is on*.
  // A list opened with a pointer has no cursor, so a run that pressed straight away would report
  // "the quantity did not move" about a press that was never aimed at a row.
  await press("ArrowDown");
  assert.ok(document.querySelector(`.${ACTIVE}`), "no option carries the cursor after ArrowDown, so nothing below is aimed at a row");
  return { element, press };
}

/**
 * What the counter on the option the cursor is on reads, as a number.
 *
 * The digits are taken out of the label rather than parsed from the whole of it — the counter reads
 * `×0`, and a `Number` of that is `NaN`. Which matters more than it looks: `assert.strictEqual`
 * holds `NaN` equal to `NaN`, so a bench comparing two unparsed readings is green whether the
 * quantity moved or not. The parse is asserted, so an unreadable counter fails here instead.
 */
const quantityUnderCursor = () => {
  const option = document.querySelector(`.${ACTIVE}`);
  assert.ok(option, "no option carries the cursor, so there is no row this key acts on");
  const count = option.querySelector(`.${COUNT}`);
  assert.ok(count, "the option in counter mode drew no quantity");
  const digits = /\d+/.exec(count.textContent ?? "");
  assert.ok(digits, `the counter reads ${JSON.stringify(count.textContent)}, which holds no number to compare`);
  return Number(digits[0]);
};

test("the key raises the quantity on the option the cursor is on", async () => {
  const { element, press } = await openCounterList();
  const before = quantityUnderCursor();
  const { up } = stepKeys();

  await press(up);

  assert.equal(
    quantityUnderCursor(),
    before + 1,
    `${up} left the quantity at ${before} — the number on this row is reachable with a pointer and `
    + "with nothing else",
  );
  element.remove();
});

test("the other key lowers it again, and stops at nothing chosen", async () => {
  const { element, press } = await openCounterList();
  const { up, down } = stepKeys();

  await press(up);
  await press(up);
  assert.equal(quantityUnderCursor(), 2, `two presses of ${up} did not reach two`);

  await press(down);
  assert.equal(quantityUnderCursor(), 1, `${down} did not lower the quantity`);

  await press(down);
  await press(down);
  assert.equal(quantityUnderCursor(), 0, `${down} did not stop at nothing chosen`);
  element.remove();
});
