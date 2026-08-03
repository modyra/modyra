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

// ─── J1: segmented admits anything as a choice ───────────────────────────────

test("J1 — a segmented option that is a bare clickable <div> is accepted", () => {
  // No `for`: a radiogroup has no single labelable control, so the group names the label instead.
  const { root, label, parts, tail } = shell(
    "segmented", "mdy-renderer mdy-renderer--segmented", { labelFor: null },
  );
  const group = el("div", "mdy-segmented", {
    role: "radiogroup",
    "aria-labelledby": "segmented-label",
    "aria-describedby": "segmented-errors",
  });

  // No role, no native radio, nothing announceable — a choice only a pointer can make.
  const option = el("div", "mdy-segmented__button");
  const optionText = el("span", "mdy-segmented__text");
  const optionCheck = el("span", "mdy-segmented__check");
  option.append(optionCheck, optionText);
  group.append(option);
  root.append(label, group, ...tail);

  const issues = inspectWidgetDom(root, "segmented", {
    parts: { ...parts, group, option, optionText, optionCheck },
  });

  // Plan 40 inverts this, under ADR 0012: an option is a radio, satisfied by the native tag or by
  // `role="radio"` — and by neither here.
  assert.deepEqual(issues, [], "`option` is declared `presentation`, so nothing constrains it");

  // And the reason, read from the contract rather than inferred from the pass.
  const optionNode = MDY_WIDGET_CONTRACTS.segmented.structure.nodes
    .find((node) => node.part === "option");
  assert.equal(optionNode.element, "presentation", "plan 40 makes this `radio`");
  root.remove();
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
