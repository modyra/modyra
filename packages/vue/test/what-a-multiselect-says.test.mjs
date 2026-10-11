import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("@modyra/widgets");

/**
 * What a multiselect says when the thing it holds changes.
 *
 * Three policies compose these sentences — which value moved and where it landed, that a quantity
 * settled and whether it is at its floor, what was added and removed since the last thing said — and
 * the words are published in five languages. This renderer draws the region that carries them and
 * never fills it, so the page reports every one of those acts as the empty string: a change nobody
 * is told about, on a control whose whole job is to hold several things at once.
 *
 * Asserted as "names the value" rather than against a whole sentence: which words a language uses is
 * the message table's business, and pinning them here would make this bench a second translator.
 */
const said = (root) => (root.querySelector(
  partClasses("multiselect", "announcement").map((one) => `.${one}`).join(""),
)?.textContent ?? "").trim();

test("taking a value announces which one", async () => {
  const fixture = await config.mount("multiselect", {});
  await fixture.settle?.();
  assert.equal(said(fixture.root), "", "something was said before anything happened");

  fixture.drive?.("open");
  await fixture.settle?.();
  const option = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "option").map((one) => `.${one}`).join(""),
  )][0];
  assert.ok(option, "no option to take");
  // The words this option actually carries, read from it rather than assumed: a fixture's labels are
  // the fixture's business, and a bench that hard-codes one is asserting its own guess.
  const label = (option.querySelector(
    partClasses("multiselect", "optionLabel").map((one) => `.${one}`).join(""),
  )?.textContent ?? "").trim();
  assert.notEqual(label, "", "the option carries no words to be named by");
  option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();

  const sentence = said(fixture.root);
  assert.notEqual(sentence, "", "a value was taken and the control said nothing");
  assert.ok(sentence.includes(label), `the sentence names no value: ${JSON.stringify(sentence)}`);
  fixture.dispose?.();
});

/** Take the first option, then act on the chip it produced. */
const withOneHeld = async (mountedAs = {}) => {
  const fixture = await config.mount("multiselect", mountedAs);
  await fixture.settle?.();
  fixture.drive?.("open");
  await fixture.settle?.();
  const options = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "option").map((one) => `.${one}`).join(""),
  )];
  for (const option of options.slice(0, 2)) {
    option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();
  }
  return fixture;
};

test("stepping a quantity says the value and where it stands", async () => {
  // **Counter mode, named.** The default fixture draws no steppers at all, so a version of this test
  // that skipped when it found none passed while exercising nothing — measured: default and single
  // give zero steppers, `multi` gives four. The precondition is asserted rather than skipped, so a
  // fixture that stops offering them fails here instead of going quiet.
  const fixture = await withOneHeld({ variant: "multi" });
  const steppers = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "optionStep").map((one) => `.${one}`).join(""),
  )];
  assert.ok(steppers.length > 0, "this fixture draws no steppers, so no quantity can be stepped");
  const before = said(fixture.root);
  steppers[steppers.length - 1]?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();
  assert.notEqual(said(fixture.root), before, "a quantity was stepped and the control said nothing new");
  fixture.dispose?.();
});

test("a quantity that reaches its floor says so", async () => {
  // The boundary is its own half of the sentence: the register's diagnostic quotes it directly —
  // *the quantity is at its floor and the control says "" — nothing marks the boundary*. Stepping
  // down to one and hearing only the count back would leave a person at a limit nobody named.
  const fixture = await withOneHeld({ variant: "multi" });
  const steppers = [...fixture.root.querySelectorAll(
    partClasses("multiselect", "chipStep").map((one) => `.${one}`).join(""),
  )];
  assert.ok(steppers.length >= 2, "a chip with no steppers has no quantity to take to a floor");

  steppers[steppers.length - 1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();
  const above = said(fixture.root);

  steppers[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();
  const atFloor = said(fixture.root);

  // Both halves, because a sentence that always said "minimum" would pass an assertion on the floor
  // alone while telling a person at three that they are at the limit.
  assert.notEqual(above, atFloor, "the floor is announced the same way as any other quantity");
  assert.ok(atFloor.length > above.length, `nothing marks the boundary: ${JSON.stringify(atFloor)}`);
  fixture.dispose?.();
});

const { chipMovedAnnouncement, quantityAnnouncement, MDY_I18N_MESSAGES_DEFAULT: words } = await import("@modyra/widgets");

const chipsOf = (root) => [...root.querySelectorAll(
  partClasses("multiselect", "chip").map((one) => `.${one}`).join(""),
)];
const labelsOf = (root) => chipsOf(root).map((chip) => chip.getAttribute("aria-label") ?? chip.textContent ?? "");
const press = async (fixture, element, key) => {
  element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await fixture.settle?.();
};
/**
 * Two values held and the panel shut. The chip's keys are declared `when: "closed"`: with the list
 * still showing, the arrows are the list's, and a chip test run with it open measures the list.
 */
const withTwoHeldShut = async (mountedAs) => {
  const fixture = await withOneHeld(mountedAs);
  const trigger = fixture.root.querySelector('[aria-haspopup]');
  assert.ok(trigger, "no trigger to close the panel from");
  await press(fixture, trigger, "Escape");
  assert.equal(trigger.getAttribute("aria-expanded"), "false", "the panel did not close, so the chip's keys are not in play");
  return fixture;
};
/** Disposed whatever the outcome: a fixture left mounted keeps its panel in the document for the next test. */
const using = async (fixture, body) => {
  try { await body(fixture); } finally { fixture.dispose?.(); }
};

test("a quantity stepped from the keyboard says which value and how many", async () => {
  // "Something new was said" is satisfied by any sentence, including one naming the wrong value or a
  // stale count. Built with the policy and the table the renderer is meant to use, so this asserts
  // the act was described, not which words a language picks.
  await using(await withTwoHeldShut({ variant: "multi" }), async (fixture) => {
  const [chip] = chipsOf(fixture.root);
  assert.ok(chip, "no chip to step");
  await press(fixture, chip, "ArrowUp");
  await press(fixture, chip, "ArrowUp");
  const expected = quantityAnnouncement("First", 3, {
    settled: words.quantitySettled, atMinimum: words.quantityAtMinimum,
  });
  assert.equal(said(fixture.root), expected);
  await press(fixture, chipsOf(fixture.root)[0], "ArrowDown");
  await press(fixture, chipsOf(fixture.root)[0], "ArrowDown");
  assert.equal(said(fixture.root), quantityAnnouncement("First", 1, {
    settled: words.quantitySettled, atMinimum: words.quantityAtMinimum,
  }));
  });
});

test("a chip is picked up, carried and put down from the keyboard", async () => {
  await using(await withTwoHeldShut({ variant: "multi", config: { reorderable: true } }), async (fixture) => {
  const before = labelsOf(fixture.root);
  assert.equal(before.length, 2, "two chips are needed to carry one past the other");

  await press(fixture, chipsOf(fixture.root)[0], "Enter");
  assert.equal(said(fixture.root), chipMovedAnnouncement(words.selectionGrabbed, "First", 1, 2));
  assert.equal(labelsOf(fixture.root).join("|"), before.join("|"), "picking a chip up moved it");

  await press(fixture, chipsOf(fixture.root)[0], "ArrowRight");
  assert.equal(labelsOf(fixture.root).join("|"), [before[1], before[0]].join("|"), "a held chip did not travel");
  assert.equal(said(fixture.root), chipMovedAnnouncement(words.selectionMoved, "First", 2, 2));

  await press(fixture, chipsOf(fixture.root)[1], "Enter");
  assert.equal(said(fixture.root), chipMovedAnnouncement(words.selectionDropped, "First", 2, 2));

  // Down, the arrows walk the strip again rather than carrying.
  await press(fixture, chipsOf(fixture.root)[1], "ArrowLeft");
  assert.equal(labelsOf(fixture.root).join("|"), [before[1], before[0]].join("|"), "a dropped chip still travels");
  });
});

test("Escape puts a held chip back where it was picked up", async () => {
  await using(await withTwoHeldShut({ variant: "multi", config: { reorderable: true } }), async (fixture) => {
  const before = labelsOf(fixture.root);
  await press(fixture, chipsOf(fixture.root)[0], "Enter");
  await press(fixture, chipsOf(fixture.root)[0], "ArrowRight");
  await press(fixture, chipsOf(fixture.root)[1], "Escape");
  assert.equal(labelsOf(fixture.root).join("|"), before.join("|"), "Escape left the chip where it was carried");
  assert.equal(said(fixture.root), chipMovedAnnouncement(words.selectionReturned, "First", 1, 2));

  // Nothing held: the same key is not the chip's and must reach whatever else answers it.
  const free = new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  chipsOf(fixture.root)[0].dispatchEvent(free);
  assert.equal(free.defaultPrevented, false, "Escape with nothing held was taken by the chip");
  });
});

test("a field that does not reorder holds nothing", async () => {
  await using(await withTwoHeldShut({ variant: "multi" }), async (fixture) => {
  const before = labelsOf(fixture.root);
  const said0 = said(fixture.root);
  await press(fixture, chipsOf(fixture.root)[0], "Enter");
  await press(fixture, chipsOf(fixture.root)[0], "ArrowRight");
  assert.equal(labelsOf(fixture.root).join("|"), before.join("|"), "a chip moved on a field that offers no reordering");
  assert.equal(said(fixture.root), said0, "a grab was announced on a field that offers no reordering");
  });
});

test("a chip moved by its pointer handle is the one the sentence names", async () => {
  // Two neighbours that swap differ at both places, so a sentence read off the two orders can name
  // either. Moving the first chip later must name the first chip, not the one it passed.
  await using(await withTwoHeldShut({ variant: "multi", config: { reorderable: true } }), async (fixture) => {
    const later = chipsOf(fixture.root)[0].querySelector(`button[aria-label="${words.chipMoveLaterLabel.replace("{value}", "First")}"]`)
      ?? [...chipsOf(fixture.root)[0].querySelectorAll(partClasses("multiselect", "chipMove").map((one) => `.${one}`).join(""))].at(-1);
    assert.ok(later, "the first chip offers no way to move it later");
    later.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();
    assert.equal(said(fixture.root), chipMovedAnnouncement(words.selectionMoved, "First", 2, 2));
  });
});

test("a held chip whose value is taken away is no longer held when it comes back", async () => {
  await using(await withTwoHeldShut({ variant: "multi", config: { reorderable: true } }), async (fixture) => {
    const dragging = `${partClasses("multiselect", "chip")[0]}--dragging`;
    await press(fixture, chipsOf(fixture.root)[0], "Enter");
    assert.ok(chipsOf(fixture.root)[0].classList.contains(dragging), "the held chip is not drawn as held");
    // Taken off from the list rather than from the chip, which is the route the chip cannot see.
    fixture.drive?.("open");
    await fixture.settle?.();
    // Through the panel this trigger controls: a panel is portalled out of the fixture's root, and a
    // document-wide query can find one an earlier mount left behind.
    const option = () => {
      const panel = fixture.root.ownerDocument.getElementById(
        fixture.root.querySelector("[aria-haspopup]")?.getAttribute("aria-controls") ?? "",
      );
      return panel?.querySelector(`[data-key="a"]${partClasses("multiselect", "option").map((one) => `.${one}`).join("")}`)
        ?? panel?.querySelectorAll(partClasses("multiselect", "option").map((one) => `.${one}`).join(""))[0];
    };
    // A counter row's own press adds one; the remove control on the chip is the list-independent way off.
    const remove = chipsOf(fixture.root)[0].querySelector(partClasses("multiselect", "chipRemove").map((one) => `.${one}`).join(""));
    assert.ok(remove, "the chip offers no way to take it off");
    remove.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();
    option().dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();
    const back = chipsOf(fixture.root).find((chip) => chip.getAttribute("data-key") === "a");
    assert.ok(back, "the value did not come back");
    assert.equal(back.classList.contains(dragging), false, "the value came back already held");
  });
});
