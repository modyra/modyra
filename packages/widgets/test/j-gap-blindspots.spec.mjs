/**
 * The four violations the contract cannot currently see.
 *
 * `docs/contract-gaps.md` records J1–J4: places where the contract underconstrains anatomy, so a
 * renderer can be semantically wrong and still conform. Every assertion below is a **false negative
 * asserted on purpose** — each one passes today because a rule is missing, and each names the change
 * that must invert it.
 *
 * A rule added without this file would be a rule nobody watched fail. That is the failure mode
 * `docs/architecture/0010-every-claim-has-an-executable-check.md` exists to prevent, and these
 * fixtures are how the J series avoids it: when a gap closes, its assertion here flips from
 * "the contract accepts this" to "the contract rejects this", in the same commit.
 *
 * If one of these ever fails on its own, the blind spot is not where the finding says it is. That is
 * a correction to `docs/contract-gaps.md`, not a test to adjust.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { inspectWidgetDom, inspectWidgetState } from "../dist/testing/index.js";
import {
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  MDY_WIDGET_STATE_CONTRACTS,
  stateCarriers,
  widgetSupportsState,
} from "../dist/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;

function el(tag, className, attributes = {}) {
  const node = document.createElement(tag);
  if (className) node.setAttribute("class", className);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** The shell every kind carries, so each fixture below only builds what its own finding is about. */
function shell(kind, rootClasses, { labelFor = `${kind}-control` } = {}) {
  const root = el("div", rootClasses);
  const label = el("label", "mdy-label", {
    id: `${kind}-label`,
    ...(labelFor ? { for: labelFor } : {}),
  });
  const marker = el("span", "mdy-label__required");
  label.append(marker);
  const supporting = el("p", "mdy-supporting-text");
  const errors = el("ul", "mdy-control__errors", { id: `${kind}-errors` });
  const errorItem = el("li", "mdy-control__error");
  errors.append(errorItem);
  document.body.append(root);
  return {
    root,
    label,
    parts: { label, requiredMarker: marker, supportingText: supporting, errors, errorItem },
    tail: [supporting, errors],
  };
}

// ─── J3: the timepicker's real control is a part of its own ──────────────────

/** A timepicker shell with two segments, each holding whatever `segmentBox` builds. */
function timepickerWithSegments(segmentBox) {
  const { root, label, parts, tail } = shell("timepicker", "mdy-renderer mdy-renderer--timepicker");
  const wrapper = el("div", "mdy-input-wrapper");
  const control = el("input", "mdy-timepicker__input", {
    id: "timepicker-control",
    role: "combobox",
    "aria-describedby": "timepicker-errors",
  });
  const toggle = el("button", "mdy-timepicker__toggle", { type: "button" });
  wrapper.append(control, toggle);

  const hour = el("div", "mdy-timepicker-segment mdy-timepicker-segment--hour");
  const minute = el("div", "mdy-timepicker-segment mdy-timepicker-segment--minute");
  const hourControl = segmentBox("Hour");
  const minuteControl = segmentBox("Minute");
  hour.append(hourControl);
  minute.append(minuteControl);

  root.append(label, wrapper, hour, minute, ...tail);
  return {
    root,
    issues: inspectWidgetDom(root, "timepicker", {
      parts: { ...parts, inputWrapper: wrapper, control, toggle, hour, minute, hourControl, minuteControl },
    }),
  };
}

test("J3 — a timepicker segment holding a <div> instead of an input is rejected", () => {
  // The segment is a container and the control inside it is what a user types into. A <div> wearing
  // the control's class is styled like one and operable by nobody: a class is presentation and tells
  // a screen reader nothing.
  const { root, issues } = timepickerWithSegments((label) => el("div", "mdy-timepicker-segment-input", { "aria-label": label }));

  assert.deepEqual(
    issues.map((issue) => `${issue.code}:${issue.part}`),
    ["PART_ELEMENT:hourControl", "PART_ELEMENT:minuteControl"],
    "a <div> in place of the segment's control must fail the element check",
  );

  const timepickerParts = Object.keys(MDY_WIDGET_CONTRACTS.timepicker.parts);
  assert.ok(timepickerParts.includes("hourControl"), "the contract reaches the hour's control");
  assert.ok(timepickerParts.includes("minuteControl"), "the contract reaches the minute's control");
  root.remove();
});

test("J3 — the same timepicker with real inputs conforms", () => {
  // The rule has to be satisfiable by what every renderer already draws, or it is not a rule about
  // the widget but a rule against it.
  const { root, issues } = timepickerWithSegments((label) => {
    const input = el("input", "mdy-timepicker-segment-input", { "aria-label": label });
    input.type = "number";
    return input;
  });

  assert.deepEqual(issues, [], "an <input type=number> in each segment is what the contract asks for");
  root.remove();
});

// ─── J1: a choice is a radio, and the contract says which element is one ─────

/** A segmented shell whose single choice is whatever `choice` builds. */
function segmentedWithChoice(choice) {
  // No `for`: a radiogroup has no single labelable control, so the group names the label instead.
  const { root, label, parts, tail } = shell(
    "segmented", "mdy-renderer mdy-renderer--segmented", { labelFor: null },
  );
  const group = el("div", "mdy-segmented", {
    role: "radiogroup",
    "aria-labelledby": "segmented-label",
    "aria-describedby": "segmented-errors",
  });
  const { option, optionControl } = choice();
  const optionCheck = el("span", "mdy-segmented__check");
  const optionText = el("span", "mdy-segmented__text");
  option.append(...(optionControl ? [optionControl] : []), optionCheck, optionText);
  group.append(option);
  root.append(label, group, ...tail);

  const named = { ...parts, group, option, optionCheck, optionText };
  if (optionControl) named.optionControl = optionControl;
  const issues = inspectWidgetDom(root, "segmented", { parts: named });
  root.remove();
  return issues;
}

test("J1 — a segmented option that is a bare clickable <div> is rejected", () => {
  // No role, no native radio, nothing announceable — a choice only a pointer can make, which is
  // precisely what this kind used to accept.
  const issues = segmentedWithChoice(() => ({
    option: el("div", "mdy-segmented__button"),
    optionControl: null,
  }));

  assert.deepEqual(
    issues.map((issue) => `${issue.code}:${issue.part}`),
    ["PART_ELEMENT:option", "PART_MISSING:optionControl"],
    "the container is not a label and there is no radio inside it",
  );
});

test("J1 — the native pattern conforms", () => {
  // A `<label>` around its own `<input type=radio>`: the accessible spelling of a choice, and what
  // the `radio` kind has always declared. A rule that rejected it would be a rule against the
  // control rather than about it.
  const issues = segmentedWithChoice(() => {
    const control = el("input", "mdy-segmented__control");
    control.type = "radio";
    return { option: el("label", "mdy-segmented__button"), optionControl: control };
  });

  assert.deepEqual(issues, []);
});

test("J1 — a container holding an input that is not a radio is rejected", () => {
  // The check that keeps `radio` from meaning "any input". Without the type guard every text field
  // in the catalogue would satisfy it.
  const issues = segmentedWithChoice(() => {
    const control = el("input", "mdy-segmented__control");
    control.type = "text";
    return { option: el("label", "mdy-segmented__button"), optionControl: control };
  });

  assert.deepEqual(
    issues.map((issue) => `${issue.code}:${issue.part}`),
    ["PART_ELEMENT:optionControl"],
  );
});

test("J1 — the contract names both halves of a choice", () => {
  // Read from the catalogue rather than inferred from a pass: the container and the control are
  // separate parts, and both are required.
  const nodes = MDY_WIDGET_CONTRACTS.segmented.structure.nodes;
  const option = nodes.find((node) => node.part === "option");
  const control = nodes.find((node) => node.part === "optionControl");
  assert.equal(option.element, "label");
  assert.equal(control.element, "radio");
  assert.equal(control.parent, "option");
  assert.equal(option.optional, false);
  assert.equal(control.optional, false);
});

// ─── J2: a multiselect's anatomy follows the mode it was configured as ───────

/**
 * A multiselect, closed, whose single chip is whatever `chip` builds.
 *
 * Closed on purpose: everything inside the popup is required only of an open widget, so a resting
 * fixture keeps the subject to the chip. `absentParts` is how a renderer says the popup is not drawn.
 */
function multiselectWithChip(chip, variant) {
  const { root, label, parts, tail } = shell("multiselect", "mdy-renderer mdy-renderer--multiselect", { labelFor: "multiselect-control" });
  const wrapper = el("div", "mdy-multiselect");
  const header = el("div", "mdy-multiselect__header");
  const searchButton = el("button", "mdy-multiselect__search-btn", {
    id: "multiselect-control", type: "button", "aria-describedby": "multiselect-errors",
  });
  header.append(searchButton);
  wrapper.append(header);

  const options = el("div", "mdy-multiselect__options", { role: "group", "aria-label": "Chosen" });
  const optionWrapper = el("div", "mdy-chip-wrapper");
  const built = chip();
  optionWrapper.append(built.option);
  options.append(optionWrapper);

  root.append(label, wrapper, options, ...tail);
  const named = {
    ...parts, inputWrapper: wrapper, header, searchButton, options, optionWrapper,
    option: built.option, optionLabel: built.optionLabel,
    ...(built.optionCheck ? { optionCheck: built.optionCheck } : {}),
    ...(built.optionStep ? { optionStep: built.optionStep } : {}),
    ...(built.optionCount ? { optionCount: built.optionCount } : {}),
  };
  const issues = inspectWidgetDom(root, "multiselect", {
    parts: named,
    variant,
    absentParts: ["popup", "listbox", "search", "empty"],
  });
  root.remove();
  return issues;
}

/** Toggle mode: the option *is* the control, and it carries a tick. */
function toggleChip() {
  const option = el("button", "mdy-chip", { type: "button" });
  const optionCheck = el("span", "mdy-chip__check");
  const optionLabel = el("span", "mdy-chip__label");
  option.append(optionCheck, optionLabel);
  return { option, optionCheck, optionLabel };
}

/** Counter mode: the option *contains* the controls, and a button may not contain a button. */
function counterChip() {
  const option = el("div", "mdy-chip mdy-chip--counter");
  const optionStep = el("button", "mdy-chip__btn", { type: "button", "aria-label": "Decrease" });
  const optionLabel = el("span", "mdy-chip__label");
  const optionCount = el("span", "mdy-chip__count");
  option.append(optionStep, optionLabel, optionCount);
  return { option, optionStep, optionLabel, optionCount };
}

test("J2 — each mode conforms to its own anatomy", () => {
  // The rule has to be satisfiable by what the renderers already draw, in both modes, or it is a
  // rule against the widget rather than about it.
  assert.deepEqual(multiselectWithChip(toggleChip, "single"), []);
  assert.deepEqual(multiselectWithChip(counterChip, "multi"), []);
});

test("J2 — a toggle option that is not a control is rejected", () => {
  // What the kind accepted before the variants existed: a chip a pointer can click and a screen
  // reader announces as nothing.
  const issues = multiselectWithChip(() => {
    const option = el("div", "mdy-chip");
    const optionCheck = el("span", "mdy-chip__check");
    const optionLabel = el("span", "mdy-chip__label");
    option.append(optionCheck, optionLabel);
    return { option, optionCheck, optionLabel };
  }, "single");

  assert.deepEqual(issues.map((i) => `${i.code}:${i.part}`), ["PART_ELEMENT:option"]);
  assert.match(issues[0].message, /must be a button/);
});

test("J2 — a counter option missing its steppers is rejected", () => {
  const issues = multiselectWithChip(() => {
    const option = el("div", "mdy-chip mdy-chip--counter");
    const optionLabel = el("span", "mdy-chip__label");
    const optionCount = el("span", "mdy-chip__count");
    option.append(optionLabel, optionCount);
    return { option, optionLabel, optionCount };
  }, "multi");

  assert.deepEqual(issues.map((i) => `${i.code}:${i.part}`), ["PART_MISSING:optionStep"]);
});

test("J2 — a counter option that is itself a button is rejected", () => {
  // A button holding two buttons is neither valid HTML nor what any renderer emits, and it is the
  // shape a single unconditional element declaration would have forced on one of the two modes.
  const issues = multiselectWithChip(() => {
    const option = el("button", "mdy-chip mdy-chip--counter", { type: "button" });
    const optionStep = el("button", "mdy-chip__btn", { type: "button", "aria-label": "Decrease" });
    const optionLabel = el("span", "mdy-chip__label");
    const optionCount = el("span", "mdy-chip__count");
    option.append(optionStep, optionLabel, optionCount);
    return { option, optionStep, optionLabel, optionCount };
  }, "multi");

  assert.deepEqual(issues.map((i) => `${i.code}:${i.part}`), ["PART_ELEMENT:option"]);
});

test("J2 — the modes are checked against different anatomy, not the same one twice", () => {
  // The failure this whole approach is most at risk of: two variants that happen to agree, so every
  // fixture passes and nothing was ever mode-specific. Read from the catalogue rather than inferred.
  const { single, multi } = MDY_WIDGET_CONTRACTS.multiselect.variants;
  assert.notDeepEqual(single.elements, multi.elements);
  assert.notDeepEqual(single.required, multi.required);
  assert.equal(single.elements.option, "button");
  assert.equal(multi.elements.option, "container");

  // And a toggle chip judged as a counter must fail, which is what proves the variant is doing the
  // deciding rather than the markup happening to satisfy both.
  const crossed = multiselectWithChip(toggleChip, "multi");
  assert.ok(crossed.length > 0, "a toggle chip is not a conformant counter chip");
});

test("J2 — a variant the kind does not declare is a caller error", () => {
  const issues = multiselectWithChip(toggleChip, "counter");
  assert.ok(issues.some((i) => /declares no variant named counter/.test(i.message)));
});

// ─── J4a: a state satisfies from any part, not the responsible one ───────────

/**
 * A conformant open select, which both select fixtures start from.
 *
 * Built exactly, because a fixture wrong for an unrelated reason cannot demonstrate a blind spot —
 * it just fails. `MDY_POPUP_OPENERS.select` is `{ opener: "trigger", controls: "listbox",
 * role: "combobox" }`, so the trigger is an `<input role="combobox">` whose `aria-controls` names
 * the **listbox**, not the popup.
 */
function buildOpenSelect() {
  const { root, label, parts, tail } = shell("select", "mdy-renderer mdy-renderer--select");
  const wrapper = el("div", "mdy-input-wrapper");
  // A <button>: labelable, so `label[for]` resolves, and able to contain `placeholder` and `arrow`,
  // which both resolve their parent to `trigger`. An <input> satisfies the first and not the second.
  // `role="combobox"` is what makes it one, per the same tag-or-role rule ADR 0012 relies on.
  const trigger = el("button", "mdy-select__trigger", {
    type: "button",
    id: "select-control",
    role: "combobox",
    "aria-controls": "select-listbox",
    "aria-describedby": "select-errors",
    "aria-expanded": "true",
  });
  const arrow = el("span", "mdy-select__arrow");
  const placeholder = el("span", "mdy-select__placeholder");
  trigger.append(placeholder, arrow);
  wrapper.append(trigger);
  const popup = el("div", "mdy-select__dropdown mdy-popup");
  const listbox = el("ul", "mdy-select__list", {
    role: "listbox", id: "select-listbox", "aria-label": "Options",
  });
  const option = el("li", "mdy-select__option", { role: "option" });
  listbox.append(option);
  popup.append(listbox);
  root.append(label, wrapper, popup, ...tail);
  return {
    root, trigger, popup, listbox,
    parts: { ...parts, inputWrapper: wrapper, trigger, arrow, placeholder, popup, listbox, option },
  };
}

test("the select fixture these two build on is genuinely conformant", () => {
  // Without this, either assertion below could pass for a reason that has nothing to do with its
  // finding — or fail for one.
  const { root, parts } = buildOpenSelect();
  assert.deepEqual(inspectWidgetDom(root, "select", { parts }), []);
  root.remove();
});

test("J4a — aria-expanded on the root instead of the trigger is rejected", () => {
  const { root, trigger, parts } = buildOpenSelect();

  // The trigger is what a screen reader announces, and it is made to say nothing. The root says it
  // instead, where no assistive technology is listening. Saying it somewhere is not saying it.
  trigger.removeAttribute("aria-expanded");
  root.setAttribute("aria-expanded", "true");

  const issues = inspectWidgetState(root, "select", "open", { parts, control: trigger });

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["STATE_ARIA_MISSING"],
    "the state must be absent from its carrier, not from the widget",
  );
  assert.match(issues[0].message, /on trigger/, "and the failure names the part responsible");
  root.remove();
});

test("J4a — a carrier is declared for every kind and state that carries ARIA", () => {
  // A table with no candidate to reject is the failure mode this plan is most at risk of: every
  // kind × ARIA state must name a carrier, or the check silently passes for having nothing to look
  // at. `open` derives from the opener the contract already declares.
  const missing = [];
  for (const kind of MDY_WIDGET_KINDS) {
    for (const [state, contract] of Object.entries(MDY_WIDGET_STATE_CONTRACTS)) {
      if (!contract.aria || !widgetSupportsState(kind, state)) continue;
      if (stateCarriers(kind, state).length === 0) missing.push(`${kind}.${state}`);
    }
  }
  assert.deepEqual(missing, [], "every ARIA state a kind supports names the part that carries it");
});

// ─── J4b: a popup may legally frame nothing ──────────────────────────────────

test("J4b — every overlay kind requires its popup to frame something", () => {
  // Containment was never the gap: `PART_NOT_CONTAINED` already rejects a part that renders outside
  // its declared parent, listbox-inside-popup included. What was missing is **presence** — no part
  // inside four of these popups was required, so a popup framing nothing violated nothing.
  //
  // Asserted against the contract rather than against hand-built DOM, because the property is a
  // fact about the catalogue: an instance would only be one witness to it. The mechanism is the
  // ordinary `required` list, which `datepicker` already used for its calendar — not a second
  // popup-contents vocabulary saying the same thing in different words.
  const emptyPopupIsLegal = [];
  const frames = {};
  for (const [kind, definition] of Object.entries(MDY_WIDGET_CONTRACTS)) {
    if (!definition.capabilities.overlay) continue;
    const inPopup = definition.structure.nodes.filter((node) => node.parent === "popup");
    if (inPopup.every((node) => node.optional)) emptyPopupIsLegal.push(kind);
    frames[kind] = inPopup.filter((node) => !node.optional).map((node) => node.part);
  }

  assert.deepEqual(emptyPopupIsLegal, [], "no overlay kind may frame nothing");
  assert.deepEqual(frames, {
    select: ["listbox"],
    multiselect: ["listbox"],
    datepicker: ["calendar"],
    daterange: ["calendar"],
    timepicker: ["container"],
    colors: ["presets"],
  });
});

/**
 * What the inspector said about the popup's contents, and nothing else.
 *
 * Breaking the list also breaks what refers to it — the trigger's `aria-controls` dangles the moment
 * there is no list to point at — and those consequences are real findings that belong to other
 * rules. Each negative below is about one of them, so each reads only its own.
 */
function codesFor(issues, ...parts) {
  return issues.filter((issue) => parts.includes(issue.part)).map((issue) => `${issue.code}:${issue.part}`);
}

/** An open select whose popup content is built by the caller, so each negative breaks one thing. */
function openSelectWithPopup(fill) {
  const { root, parts } = buildOpenSelect();
  parts.listbox.remove();
  const built = fill();
  if (built) parts.popup.append(built);
  const next = { ...parts };
  delete next.option;
  if (built) next.listbox = built;
  else delete next.listbox;
  const issues = inspectWidgetDom(root, "select", { parts: next, open: true });
  root.remove();
  return { issues };
}

test("J4b — a popup framing nothing is rejected", () => {
  const { issues } = openSelectWithPopup(() => null);
  assert.deepEqual(
    codesFor(issues, "listbox"),
    ["PART_MISSING:listbox"],
    "an open select whose popup holds no list has nothing to choose from",
  );
});

test("J4b — a popup framing the right class with the wrong role is rejected", () => {
  const { issues } = openSelectWithPopup(() => el("div", "mdy-select__list", { role: "menu" }));
  assert.deepEqual(
    codesFor(issues, "listbox"),
    ["PART_ROLE:listbox", "PART_ELEMENT:listbox", "NAME_MISSING:listbox"],
    "a menu is not a listbox, and the options inside it are announced as commands",
  );
});

test("J4b — a portalled popup still conforms", () => {
  // The way a containment rule usually goes wrong. A popup rendered into the document root escapes
  // its field's subtree legitimately — `portal.ts` exists for exactly that — so a check that looked
  // for the popup *under* the root would report every portalled renderer as broken while the
  // renderers were right.
  const { root, parts } = buildOpenSelect();
  document.body.append(parts.popup);

  assert.deepEqual(inspectWidgetDom(root, "select", { parts, open: true }), []);
  parts.popup.remove();
  root.remove();
});

test("J4b — the list rendered outside the popup it belongs to is rejected", () => {
  // The one a `querySelector` from the widget root gets wrong: the element exists, carries the right
  // class and the right role, and is nowhere near the box the user is looking at.
  const { root, parts } = buildOpenSelect();
  root.append(parts.listbox);
  const issues = inspectWidgetDom(root, "select", { parts, open: true });
  root.remove();

  assert.deepEqual(
    codesFor(issues, "listbox", "option"),
    // Only the list is reported. The options moved with it and are still inside their own declared
    // parent, which is the rule working: containment is a statement about a part and its parent,
    // and reporting the whole subtree would name every element for one displacement.
    ["PART_NOT_CONTAINED:listbox"],
    "presence is not enough — the popup has to be what frames it",
  );
});
