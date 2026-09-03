/**
 * Runtime contract conformance for the Lit elements.
 *
 * Same gate as the framework-free renderer: `assertWidgetDomContract` from `@modyra/widgets/testing`
 * reads the DOM these elements actually rendered and checks it against the catalog's classes,
 * containment, ordering and ARIA. Lit renders in light DOM, so there is nothing to pierce.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { inspectWidgetDom } = await import("../../widgets/dist/testing/index.js");

defineMdyElements();

const option = { value: "x", label: "X" };
const ELEMENTS = [
  ["mdy-text-field", "text", ""],
  ["mdy-textarea-field", "textarea", ""],
  ["mdy-number-field", "number", 0],
  ["mdy-checkbox-field", "checkbox", false],
  ["mdy-toggle-field", "toggle", false],
  ["mdy-slider-field", "slider", 0],
  ["mdy-radio-group-field", "radio", null],
  ["mdy-segmented-field", "segmented", null],
  // `email` and `password` are the text element under a different input type: same anatomy, and
  // leaving them out meant two of the seventeen kinds were never inspected on this adapter at all.
  ["mdy-text-field", "email", ""],
  ["mdy-text-field", "password", ""],
  ["mdy-file-field", "file", null],
];

function partsOf(root, kind) {
  const q = (selector) => root.querySelector(selector);
  const shell = {
    label: q(".mdy-label, .mdy-toggle__label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle"),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
  switch (kind) {
    case "file":
      return { ...shell, inputWrapper: null, dropzone: q(".mdy-file-container"), control: q(".mdy-file-input"), content: q(".mdy-file-content"), fileList: q(".mdy-file-list"), clear: q(".mdy-file-clear") };
    case "daterange": {
      const inputs = root.querySelectorAll(".mdy-daterange__input");
      return { ...shell, startControl: inputs[0] ?? null, endControl: inputs[1] ?? null, separator: q(".mdy-daterange__sep"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup") };
    }
    case "checkbox":
      return { ...shell, control: q('input[type="checkbox"]'), indicator: q(".mdy-checkbox__indicator") };
    case "toggle":
      return { ...shell, control: q('input[type="checkbox"]'), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "radio":
    case "segmented":
      return kind === "segmented"
        ? { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") }
        : { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-input"), optionCheck: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    // The overlay kinds. Without these they fell through to the text-field default, so the trigger,
    // the toggle and the search button — the parts the contract names as openers — were left to be
    // resolved by class alone, and a fixture cannot assert what it never named.
    case "select":
      return { ...shell, trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), arrow: q(".mdy-select__arrow"), popup: q(".mdy-select__dropdown"), listbox: q(".mdy-select__list"), option: Array.from(root.querySelectorAll(".mdy-select__option")) };
    case "multiselect":
      return {
        // `inputWrapper` is the shell's box, as it is for every kind; the widget's own layout box is
        // `box`. One name for two different elements is what this rename removed.
        ...shell, inputWrapper: q(".mdy-input-wrapper"), box: q(".mdy-multiselect"),
        trigger: q(".mdy-multiselect__trigger"),
        chips: q(".mdy-multiselect__chips"), arrow: q(".mdy-multiselect__arrow"),
        popup: q(".mdy-multiselect__dropdown"),
        placeholder: q(".mdy-multiselect__placeholder"),
        // One grid now, in the popup. The field's own copy is gone, so nothing has to be named by
        // exclusion — and the chips in the strip are the *values*, which is a different part from
        // the options in the grid.
        options: q(".mdy-multiselect__options"),
        optionWrapper: Array.from(root.querySelectorAll(".mdy-multiselect__options .mdy-chip-wrapper")),
        option: Array.from(root.querySelectorAll(".mdy-multiselect__options .mdy-chip")),
        optionCheck: Array.from(root.querySelectorAll(".mdy-multiselect__options .mdy-chip__check")),
        optionLabel: Array.from(root.querySelectorAll(".mdy-multiselect__options .mdy-chip__label")),
        chip: Array.from(root.querySelectorAll(".mdy-multiselect__chips .mdy-chip")),
        chipRemove: Array.from(root.querySelectorAll(".mdy-multiselect__chips .mdy-chip__remove")),
      };
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup"), calendar: q(".mdy-datepicker__calendar"), grid: q(".mdy-datepicker__grid") };
    case "timepicker":
      return { ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: q(".mdy-timepicker__popup") };
    case "colors":
      return {
        ...shell, control: q(".mdy-colors__native-hidden"), hexInput: q(".mdy-colors__hex-input"),
        toggle: q(".mdy-colors__toggle-area"), popup: q(".mdy-colors__dropdown"),
        presets: q(".mdy-colors__presets"),
        nativePicker: q(".mdy-colors__primary-picker"),
      };
    default:
      return { ...shell, control: q("input, textarea") };
  }
}

/**
 * Divergences the Lit elements still have from the contract, recorded rather than waived — the
 * assertion below matches this map exactly, so one can neither appear silently nor outlive its fix.
 */

const KNOWN_DIVERGENCES = {};

/** The kinds whose anatomy declares a prefix and a suffix. */
const AFFIX_KINDS = new Set(["text", "email", "password"]);

for (const [tag, kind, initial] of ELEMENTS) {
  test(`<${tag}> renders the ${kind} contract`, async () => {
    const form = createLitForm({ value: field(initial) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "Label";
      if (kind === "radio" || kind === "segmented") el.options = [option];
      if (kind === "email" || kind === "password") el.type = kind;
      // `prefix` and `suffix` render only when a host projects something into them, so a fixture
      // that slots nothing leaves two declared parts unbuilt on every kind that has them.
      if (AFFIX_KINDS.has(kind)) {
        for (const slot of ["prefix", "suffix"]) {
          const affix = document.createElement("span");
          affix.setAttribute("slot", slot);
          affix.textContent = slot === "prefix" ? "@" : ".com";
          el.append(affix);
        }
      }
    });

    if (AFFIX_KINDS.has(kind)) {
      assert.ok(element.querySelector(".mdy-input-prefix"), `${kind} projected a prefix and rendered none`);
      assert.ok(element.querySelector(".mdy-input-suffix"), `${kind} projected a suffix and rendered none`);
    }

    const issues = inspectWidgetDom(element, kind, {
      parts: partsOf(element, kind),
      // The class vocabulary is contract data: a theme can only style what it can enumerate.
      strictClasses: true,
    });
    assert.deepEqual(
      issues.map((issue) => `${issue.code}:${issue.part}`),
      KNOWN_DIVERGENCES[kind] ?? [],
      `${kind}: ${issues.map((issue) => issue.message).join(" / ")}`,
    );

    element.remove();
  });
}

test("every element takes its root classes from the catalog", async () => {
  const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");
  const form = createLitForm({ value: field("") });
  for (const [tag, kind] of ELEMENTS) {
    const element = await mount(tag, (el) => { el.field = form.f.value; });
    for (const className of MDY_WIDGET_CONTRACTS[kind].rootClasses) {
      assert.ok(element.classList.contains(className), `<${tag}> must carry ${className}`);
    }
    element.remove();
  }
});

/**
 * Every widget whose contract declares `dismissOnOutsidePointer` must close on a pointer outside
 * it — the catalog says so for all of them, so the test enumerates the catalog rather than one
 * hand-picked element.
 */
const OVERLAY_ELEMENTS = [
  ["mdy-datepicker-field", "datepicker", null, ".mdy-datepicker__toggle"],
  ["mdy-timepicker-field", "timepicker", null, ".mdy-timepicker__toggle"],
  ["mdy-colors-field", "colors", null, ".mdy-colors__toggle-area"],
  ["mdy-select-field", "select", null, ".mdy-select__trigger"],
  ["mdy-multiselect-field", "multiselect", [], ".mdy-multiselect__search-btn, .mdy-multiselect"],
  ["mdy-daterange-field", "daterange", null, ".mdy-datepicker__toggle"],
];

for (const [tag, kind, initial, opener] of OVERLAY_ELEMENTS) {
  test(`<${tag}> dismisses its overlay on a pointer outside it`, async () => {
    const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");
    assert.notEqual(
      MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnOutsidePointer,
      false,
      `${kind} must declare the dismissal capability`,
    );

    const form = createLitForm({ value: field(initial) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "Field";
      if (kind === "select" || kind === "multiselect") { el.options = [option]; el.searchable = true; }
    });
    const outside = document.createElement("button");
    document.body.append(outside);

    element.querySelector(opener).click();
    await element.updateComplete;
    assert.equal(element._open, true, `${tag} did not open`);

    // The dismissal policy is the contract's; the element only reports where the pointer landed.
    // `light-dismiss` is an *interaction* — an origin and a completion — so the suite drives both.
    // A single-event test would pass on a renderer that dismissed on the press alone, which takes
    // the popup away from a user who was scrolling.
    const declared = MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnOutsidePointer;
    assert.equal(declared, "light-dismiss", `${tag} declares no light dismiss`);

    const press = (target, opts = {}) => target.dispatchEvent(
      Object.assign(new window.Event("pointerdown", { bubbles: true }),
        { pointerId: 1, isPrimary: true, button: 0, ...opts }),
    );
    const fire = (target, type, opts = {}) => target.dispatchEvent(
      Object.assign(new window.Event(type, { bubbles: true }), opts),
    );

    // Beginning outside and completing inside is not a dismissal: pressing away and returning.
    press(outside);
    fire(element, "click");
    await element.updateComplete;
    assert.equal(element._open, true, `${tag} dismissed on an interaction that completed inside it`);

    // Neither is an interaction the browser cancelled to scroll the page.
    press(outside);
    fire(outside, "pointercancel", { pointerId: 1 });
    fire(outside, "click");
    await element.updateComplete;
    assert.equal(element._open, true, `${tag} dismissed on a cancelled pointer`);

    // Nor a secondary button: a right-click opens a context menu, it does not dismiss.
    press(outside, { button: 2 });
    fire(outside, "click");
    await element.updateComplete;
    assert.equal(element._open, true, `${tag} dismissed on a non-primary button`);

    // Origin and completion both outside dismisses.
    press(outside);
    fire(outside, "click");
    await element.updateComplete;
    assert.equal(element._open, false, `${tag} stayed open after an interaction outside it`);

    outside.remove();
    element.remove();
  });
}

/**
 * The DOM contract, with the overlay open.
 *
 * At rest an overlay widget renders none of its popup, so the listbox and its options, the calendar
 * grid and its cells, the clock face — forty-five parts across six kinds — had their classes,
 * parents, order, semantics and cardinality checked nowhere. `overlayOnlyParts` names them, which is
 * what makes this suite's scope a measurement rather than a guess.
 */
const ABSENT_WHILE_OPEN = {
  select: ["empty", "loading"],
  // `chips` and `chip` are drawn now: the closed control shows what was chosen.
  multiselect: ["empty", "loading", "optionStep", "optionCount"],
  datepicker: ["actions"],
  daterange: ["actions"],
  timepicker: [],
  colors: [],
};

for (const [tag, kind, initial, opener] of OVERLAY_ELEMENTS) {
  test(`<${tag}> renders the ${kind} contract while it is open`, async () => {
    const { MDY_POPUP_OPENERS } = await import("../../widgets/dist/index.js");
    const form = createLitForm({ value: field(initial) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "Label";
      if (kind === "select" || kind === "multiselect") { el.options = [option]; el.searchable = true; }
    });

    element.querySelector(opener).click();
    await element.updateComplete;

    // The element carrying the relation is the part the contract names, which is not always the one
    // a pointer lands on: a datepicker's opener is its typeable control.
    const parts = partsOf(element, kind);
    const declaredOpener = parts[MDY_POPUP_OPENERS[kind].opener];
    assert.ok(declaredOpener, `${kind}: the declared opener part is not mapped`);
    assert.equal(declaredOpener.getAttribute("aria-expanded"), "true", `${kind} did not open`);

    const issues = inspectWidgetDom(element, kind, {
      parts,
      absentParts: ABSENT_WHILE_OPEN[kind] ?? [],
      strictClasses: true,
      // The overlay is showing, so the parts that only exist inside it are required of this run.
      open: true,
    });
    assert.deepEqual(
      issues.map((issue) => `${issue.code}:${issue.part}`),
      [],
      `${kind}: ${issues.map((issue) => issue.message).join(" / ")}`,
    );

    element.remove();
  });
}
