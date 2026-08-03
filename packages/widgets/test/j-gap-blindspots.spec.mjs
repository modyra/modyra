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
import { MDY_WIDGET_CONTRACTS } from "../dist/index.js";

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

// ─── J3: the timepicker's real control is one level below the contract ───────

test("J3 — a timepicker segment holding a <div> instead of an input is accepted", () => {
  const { root, label, parts, tail } = shell("timepicker", "mdy-renderer mdy-renderer--timepicker");
  const wrapper = el("div", "mdy-input-wrapper");
  const control = el("input", "mdy-timepicker__input", {
    id: "timepicker-control",
    role: "combobox",
    "aria-describedby": "timepicker-errors",
  });
  const toggle = el("button", "mdy-timepicker__toggle", { type: "button" });
  wrapper.append(control, toggle);

  // `hour` and `minute` are declared `group`, and the element a user actually types into sits inside
  // them, undeclared. So a segment containing a <div> where every renderer puts an
  // <input type="number"> is indistinguishable from one that is right.
  const hour = el("div", "mdy-timepicker-segment mdy-timepicker-segment--hour");
  const minute = el("div", "mdy-timepicker-segment mdy-timepicker-segment--minute");
  hour.append(el("div", "mdy-timepicker-segment-input"));
  minute.append(el("div", "mdy-timepicker-segment-input"));

  root.append(label, wrapper, hour, minute, ...tail);

  const issues = inspectWidgetDom(root, "timepicker", {
    parts: { ...parts, inputWrapper: wrapper, control, toggle, hour, minute },
  });

  // Plan 38 inverts this: with `hourControl`/`minuteControl` declared, a <div> carrying the class
  // must fail the `control` element check, because a class is styling and tells a screen reader
  // nothing.
  assert.deepEqual(issues, [], "the contract cannot yet see inside hour/minute");

  // And the reason, stated directly: no declared part reaches the inner control.
  const parts38 = Object.keys(MDY_WIDGET_CONTRACTS.timepicker.parts);
  assert.ok(!parts38.includes("hourControl"), "plan 38 adds hourControl");
  assert.ok(!parts38.includes("minuteControl"), "plan 38 adds minuteControl");
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

test("J4a — aria-expanded on the root instead of the trigger is accepted", () => {
  const { root, trigger, parts } = buildOpenSelect();

  // The trigger is what a screen reader announces, and it is made to say nothing. The root says it
  // instead, where no assistive technology is listening.
  trigger.removeAttribute("aria-expanded");
  root.setAttribute("aria-expanded", "true");

  const issues = inspectWidgetState(root, "select", "open", { parts, control: trigger });

  // Plan 41 inverts this: `open` names `trigger` as its carrier, and present-elsewhere-but-absent-
  // there becomes a failure rather than a pass.
  assert.deepEqual(issues, [], "any declared part may satisfy the state today");
  assert.equal(trigger.getAttribute("aria-expanded"), null, "the responsible part says nothing");
  root.remove();
});

// ─── J4b: a popup may legally frame nothing ──────────────────────────────────

test("J4b — four of six overlay kinds may render an empty popup and conform", () => {
  // Containment is *not* the gap: `PART_NOT_CONTAINED` already rejects a part that renders outside
  // its declared parent, listbox-inside-popup included. What is missing is **presence** — no part
  // inside these popups is required, so a popup framing nothing violates nothing.
  //
  // Asserted against the contract rather than against hand-built DOM, because the property is a
  // fact about the catalogue: an instance would only be one witness to it.
  const emptyPopupIsLegal = [];
  for (const [kind, definition] of Object.entries(MDY_WIDGET_CONTRACTS)) {
    if (!definition.capabilities.overlay) continue;
    const inPopup = definition.structure.nodes.filter((node) => node.parent === "popup");
    if (inPopup.every((node) => node.optional)) emptyPopupIsLegal.push(kind);
  }

  // Plan 42 inverts this: each overlay kind declares the semantic root its popup must contain, and
  // this list shrinks to empty.
  assert.deepEqual(
    emptyPopupIsLegal.sort(),
    ["colors", "multiselect", "select", "timepicker"],
    "these four declare no required part inside their popup",
  );

  // The two that are already covered, and by an ordinary required part rather than a popup rule —
  // which is the shape plan 42 should follow rather than invent.
  for (const kind of ["datepicker", "daterange"]) {
    const calendar = MDY_WIDGET_CONTRACTS[kind].structure.nodes
      .find((node) => node.part === "calendar");
    assert.equal(calendar.parent, "popup");
    assert.equal(calendar.optional, false, `${kind} already requires its popup to hold a calendar`);
  }
});
