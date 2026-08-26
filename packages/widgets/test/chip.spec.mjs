/**
 * The chip primitive and its variants.
 *
 * Every renderer asks this one function what classes a chip carries, so these assertions are the
 * reason a theme can style `.mdy-chip--selected` once and have it apply to every chip on screen,
 * whichever renderer drew it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chipActionName,
  quantityAnnouncement,
  settledVoice,
  MDY_CHIP_CLASSES,
  MDY_WIDGET_CONTRACTS,
  hiddenChipCount,
  wayBackActionName,
  wayBackSentence,
  multiselectChipClasses,
} from "../dist/index.js";

test("the chip vocabulary is fixed and namespaced", () => {
  assert.deepEqual(MDY_CHIP_CLASSES, {
    block: "mdy-chip",
    centered: "mdy-chip--centered",
    counter: "mdy-chip--counter",
    value: "mdy-chip--value",
    selected: "mdy-chip--selected",
    removable: "mdy-chip--removable",
    check: "mdy-chip__check",
    label: "mdy-chip__label",
    count: "mdy-chip__count",
    step: "mdy-chip__btn",
    remove: "mdy-chip__remove",
    move: "mdy-chip__move",
    wrapper: "mdy-chip-wrapper",
  });
});

test("the mode picks the variant, and selection is a state on top of it", () => {
  assert.deepEqual(multiselectChipClasses(), ["mdy-chip", "mdy-chip--centered"]);
  assert.deepEqual(multiselectChipClasses({ mode: "multi" }), ["mdy-chip", "mdy-chip--counter"]);
  // Selected is never a variant of its own: one rule paints a taken chip in either mode.
  assert.deepEqual(multiselectChipClasses({ selected: true }), ["mdy-chip", "mdy-chip--centered", "mdy-chip--selected"]);
  assert.deepEqual(multiselectChipClasses({ mode: "multi", selected: true }), ["mdy-chip", "mdy-chip--counter", "mdy-chip--selected"]);
});

test("a value chip stands for something taken, whatever the mode", () => {
  assert.deepEqual(multiselectChipClasses({ role: "value" }), ["mdy-chip", "mdy-chip--value"]);
  assert.deepEqual(multiselectChipClasses({ role: "value", mode: "multi" }), ["mdy-chip", "mdy-chip--value"]);
});

test("the primitive comes first, so a variant can only ever refine it", () => {
  for (const appearance of [{}, { mode: "multi" }, { role: "value" }, { selected: true }]) {
    assert.equal(multiselectChipClasses(appearance)[0], MDY_CHIP_CLASSES.block);
  }
});

test("the multiselect's chip parts are the chip vocabulary, not names of their own", () => {
  const { parts } = MDY_WIDGET_CONTRACTS.multiselect;
  assert.deepEqual(parts.option.classes, [MDY_CHIP_CLASSES.block]);
  assert.deepEqual(parts.optionCheck.classes, [MDY_CHIP_CLASSES.check]);
  assert.deepEqual(parts.optionLabel.classes, [MDY_CHIP_CLASSES.label]);
  assert.deepEqual(parts.optionCount.classes, [MDY_CHIP_CLASSES.count]);
  assert.deepEqual(parts.optionStep.classes, [MDY_CHIP_CLASSES.step]);
  assert.deepEqual(parts.optionWrapper.classes, [MDY_CHIP_CLASSES.wrapper]);
  assert.deepEqual(parts.chip.classes, [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value]);
});

test("a quantity says what it settled on, and says when it is at its floor", () => {
  const words = { settled: "{value}, {count}", atMinimum: "{value}, {count}, minimum" };
  assert.equal(quantityAnnouncement("Alfa", 3, words), "Alfa, 3");
  // On arriving at one, not on leaving it: a warning at the moment of deletion is too late, because
  // the value is already gone and the person is being told rather than asked.
  assert.equal(quantityAnnouncement("Alfa", 1, words), "Alfa, 1, minimum");
});

test("a settling voice says the value a gesture ended on, not every value it passed", () => {
  const said = [];
  let queued = null;
  const voice = settledVoice((sentence) => said.push(sentence), {
    schedule: (run) => { queued = run; return 1; },
    cancel: () => { queued = null; },
  });
  // Eleven presses of a held key: a region read on every one of them reads a backlog out after the
  // person has let go.
  for (const count of [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) voice.announce(`Alfa, ${count}`);
  assert.deepEqual(said, [], "nothing is said while the presses are still arriving");
  queued();
  assert.deepEqual(said, ["Alfa, 2"], "one sentence, and it is the value the gesture ended on");
});

test("the button that takes a chip off is named for the chip", () => {
  // The verb alone names eight controls the same on a strip of eight chips. The words are the
  // renderer's, so what is checked here is the rule: the object belongs in the name.
  assert.equal(chipActionName("Remove", "Alfa"), "Remove Alfa");
  assert.equal(chipActionName("Rimuovi", "Ferrovia"), "Rimuovi Ferrovia");
  // A chip with nothing to say its name by keeps the verb rather than gaining a trailing space:
  // a name ending in whitespace is a different string to anything matching on it exactly.
  assert.equal(chipActionName("Remove", ""), "Remove");
  assert.equal(chipActionName("Remove", "   "), "Remove");
});

test("the closed control carries what was chosen, and the popup carries the options", () => {
  // The anatomy: the field shows what was chosen, as chips in a strip inside the control a person
  // presses; the options are seen in the popup, where there is room for them. A second copy of the
  // options in the closed field put every one of them on the page twice and made the control's
  // height follow the catalogue.
  const { parts, structure } = MDY_WIDGET_CONTRACTS.multiselect;
  // One grid, one part. `listbox` existed to name the popup's copy of a grid the field also drew;
  // with the field's copy gone there is only one, and two names for it could only disagree.
  assert.deepEqual(parts.options.classes, ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"]);
  assert.equal(parts.listbox, undefined);
  const parentOf = (part) => structure.nodes.find((node) => node.part === part)?.parent;
  assert.equal(parentOf("options"), "popup");
  assert.equal(parentOf("search"), "popup");
  // Beside the opener, not inside it (ADR 0142): a chip carries a button that takes a value off, and
  // a control that opens something may not contain a control that destroys something. Under the
  // widget's own box rather than the shell every kind sits in (ADR 0143), which is where all three
  // renderers draw it — one part name, one element.
  assert.equal(parentOf("chips"), "box");
  assert.equal(parentOf("trigger"), "box");
  // A row between the strip and its cells: ARIA structures a grid as grid → row → cell, and the
  // strip is one row of them. ADR 0148.
  assert.equal(parentOf("chipRow"), "chips");
  assert.equal(parentOf("chip"), "chipRow");
  // The chip is where a value is changed, so the control that takes it off belongs to the chip.
  assert.equal(parentOf("chipRemove"), "chip");
});

/**
 * A strip built the way the contract builds one: chips inside a row, not directly inside the strip.
 *
 * Boxes are stated rather than laid out, because what is under test is which elements are counted —
 * a question a layout engine does not answer and a fake one cannot get wrong.
 */
function stripHolding(chips) {
  const box = { left: 0, right: 100 };
  const chipEls = chips.map((at) => ({
    className: MDY_CHIP_CLASSES.block,
    getBoundingClientRect: () => at,
  }));
  const row = { className: "mdy-multiselect__chip-row", getBoundingClientRect: () => ({ left: 0, right: 400 }) };
  return {
    scrollWidth: 400,
    clientWidth: 100,
    getBoundingClientRect: () => box,
    children: [row],
    querySelectorAll: (selector) => (selector === `.${MDY_CHIP_CLASSES.block}` ? chipEls : []),
  };
}

test("the strip counts the chips it is not showing, not the row that holds them", () => {
  // Three of five sit past the trailing edge.
  const five = stripHolding([
    { left: 0, right: 30 }, { left: 32, right: 62 },
    { left: 110, right: 140 }, { left: 142, right: 172 }, { left: 174, right: 204 },
  ]);
  assert.equal(hiddenChipCount(five), 3);

  // The count follows the chips rather than staying at the one row that holds them: read off the
  // strip's own children this answers 1 for every arrangement, which is right only by coincidence
  // when exactly one chip is out of sight.
  const nine = stripHolding(Array.from({ length: 9 }, (_, i) => ({ left: 110 + i * 32, right: 140 + i * 32 })));
  assert.equal(hiddenChipCount(nine), 9);

  // Clipped at the leading edge counts too: the row scrolls both ways.
  const behind = stripHolding([{ left: -40, right: -10 }, { left: 10, right: 40 }]);
  assert.equal(hiddenChipCount(behind), 1);
});

test("a strip that shows everything it holds counts none", () => {
  const full = stripHolding([{ left: 0, right: 30 }]);
  full.scrollWidth = 100;
  assert.equal(hiddenChipCount(full), 0);
});

test("the way back is named for the act it reverses, not for the word undo", () => {
  const words = {
    label: "Undo",
    removed: "{value} removed",
    moved: "{value} moved",
    cleared: "{count} items cleared",
  };
  const labelOf = (key) => ({ a: "Alfa" })[key] ?? key;

  // One reversal covers three acts, so a fixed name would be a button that says one thing and does
  // three. "Restore Alfa" would be wrong for the middle one, which is why the name is built from the
  // act's own sentence rather than from a verb of its own.
  assert.equal(
    wayBackActionName({ act: "remove", optionKey: "a", count: 1 }, words, labelOf),
    "Undo: Alfa removed",
  );
  assert.equal(
    wayBackActionName({ act: "move", optionKey: "a", count: 1 }, words, labelOf),
    "Undo: Alfa moved",
  );
  // A clear has no value to name and says how many it took.
  assert.equal(
    wayBackActionName({ act: "clear", optionKey: null, count: 5 }, words, labelOf),
    "Undo: 5 items cleared",
  );

  // The name and the announcement say the same words about the same act: one set of templates, so a
  // translation cannot move one without the other.
  for (const act of ["remove", "move", "clear"]) {
    const way = { act, optionKey: act === "clear" ? null : "a", count: 5 };
    assert.ok(wayBackActionName(way, words, labelOf).endsWith(wayBackSentence(way, words, labelOf)), act);
  }
});
