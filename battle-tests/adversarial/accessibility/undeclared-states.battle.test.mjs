/**
 * A control announcing a state its own kind says it does not have.
 *
 * `@modyra/widgets` declares, per kind, which ARIA states exist and which part carries each one.
 * The table's own words are the claim: *an undeclared state asserted is as much a defect as a
 * declared state unchecked*, and `readonly` is declared *only where the concept means something* —
 * a control whose value is typed can be read but not written; a checkbox, a slider or a radio group
 * is either operable or disabled.
 *
 * `stateCarriers` publishes that table, so the question can be asked from outside: does each
 * projection assert only what its kind declares?
 *
 * For `readonly` the answer is no in three places, and the checkbox is the one that costs something.
 * A boolean field projects `aria-readonly="true"` and the native `readonly` attribute onto its
 * input. `stateCarriers("checkbox", "readonly")` is empty — the kind has no such state — and HTML
 * ignores `readonly` on a checkbox entirely: it is defined for text-entry controls, and the browser
 * lets the box be toggled anyway. So the two halves fail in opposite directions. A screen-reader
 * user is told the control is read-only; pressing space changes the value.
 *
 * `aria-readonly="false"` was already removed from these kinds for the same reason — the projection
 * emits the attribute only when the state is true. That fix is the evidence the reasoning is
 * accepted; what remains is that `true` still goes out on kinds where the concept does not exist.
 */

import {
  projectBooleanFieldA11y,
  projectDaterangeFieldA11y,
  projectOptionFieldA11y,
  projectTextFieldA11y,
  stateCarriers,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A field state with every axis a projection reads, so no projection is answering about undefined. */
function fieldState(over) {
  return {
    value: null,
    touched: true,
    dirty: false,
    disabled: false,
    readonly: false,
    required: false,
    valid: true,
    pending: false,
    visible: true,
    open: false,
    selectedKeys: new Set(),
    draft: { hour: "", minute: "" },
    focusedField: null,
    ...over,
  };
}

/** Every attribute a projection puts on any of its parts, flattened to `part.attribute`. */
function assertedAttributes(projection) {
  const asserted = {};
  for (const [part, contract] of Object.entries(projection)) {
    for (const [attribute, value] of Object.entries(contract?.attributes ?? {})) {
      if (value !== null && value !== false) asserted[`${part}.${attribute}`] = value;
    }
  }
  return asserted;
}

/** The kinds each projection renders, so the published table can be asked about them by name. */
const PROJECTIONS = Object.freeze([
  { kind: "text", project: projectTextFieldA11y, options: { widgetId: "w" } },
  { kind: "checkbox", project: projectBooleanFieldA11y, options: { widgetId: "w" } },
  {
    kind: "radio",
    project: projectOptionFieldA11y,
    options: { widgetId: "w", options: [{ value: "a", label: "A" }] },
  },
  { kind: "daterange", project: projectDaterangeFieldA11y, options: { widgetId: "w" } },
]);

battle(
  {
    claims: ["A11Y-004"],
    title: "read-only is announced only by the kinds whose contract has the state",
    environments: ["node"],
  },
  async (ctx) => {
    for (const { kind, project, options } of PROJECTIONS) {
      const declared = stateCarriers(kind, "readonly").length > 0;
      const asserted = assertedAttributes(project(fieldState({ readonly: true }), [], options));
      const announces = Object.entries(asserted).filter(([name]) => /(^|\.)(aria-readonly|readonly)$/.test(name));
      ctx.log.note("what a kind says when its field is read-only", { kind, declared, announces });

      if (declared) {
        // The control: a kind that declares the state must actually carry it, or the table is
        // decoration and the assertions below are about nothing.
        expectClaim(announces.length > 0, {
          claimIds: ["A11Y-004"],
          what: `${kind} declares a read-only carrier and announced nothing`,
          detail: JSON.stringify(asserted),
        });
        continue;
      }

      expectEqual(announces, [], {
        claimIds: ["A11Y-004"],
        what: `${kind} announced read-only, and stateCarriers says the kind has no such state`,
        detail: JSON.stringify(announces),
      });
    }
  },
);

battle(
  {
    claims: ["A11Y-004"],
    title: "an attribute the platform ignores is not what protects a value",
    environments: ["node"],
  },
  async (ctx) => {
    // HTML defines `readonly` for text-entry controls. On a checkbox the browser ignores it, so a
    // renderer binding it has bound nothing — the box still toggles. Announcing read-only beside it
    // is the part that makes this worse than an omission: the user is told the control cannot
    // change, and it can.
    const readOnlyBox = assertedAttributes(projectBooleanFieldA11y(fieldState({ readonly: true }), [], { widgetId: "w" }));
    ctx.log.note("what a read-only checkbox puts on its input", { readOnlyBox });

    expectClaim(readOnlyBox["input.readonly"] === undefined, {
      claimIds: ["A11Y-004"],
      what: "a checkbox carries the native readonly attribute, which its own platform ignores",
      detail: JSON.stringify(readOnlyBox),
    });

    // The control, and the boundary of any fix: the kind where `readonly` is both declared and
    // native must keep both halves. Removing it everywhere would break the kinds it is real for.
    const readOnlyText = assertedAttributes(projectTextFieldA11y(fieldState({ readonly: true }), [], { widgetId: "w" }));
    ctx.log.note("what a read-only text field puts on its input", { readOnlyText });

    expectClaim(readOnlyText["input.readonly"] === true && readOnlyText["input.aria-readonly"] === "true", {
      claimIds: ["A11Y-004"],
      what: "a text field stopped carrying read-only, which is the kind the state exists for",
      detail: JSON.stringify(readOnlyText),
    });

    // And neither kind announces the state it does not have when it is not in it — the fix that was
    // already made, pinned so it cannot come back.
    for (const [label, project, options] of [
      ["checkbox", projectBooleanFieldA11y, { widgetId: "w" }],
      ["radio", projectOptionFieldA11y, { widgetId: "w", options: [{ value: "a", label: "A" }] }],
      ["daterange", projectDaterangeFieldA11y, { widgetId: "w" }],
    ]) {
      const editable = assertedAttributes(project(fieldState({}), [], options));
      const announced = Object.keys(editable).filter((name) => name.endsWith("aria-readonly"));

      expectEqual(announced, [], {
        claimIds: ["A11Y-004"],
        what: `${label} announced aria-readonly while editable, which is the mechanically applied shell`,
        detail: JSON.stringify(editable),
      });
    }
  },
);

battle(
  {
    claims: ["A11Y-004"],
    title: "a tri-state attribute holds one of the three values it is allowed",
    environments: ["node"],
  },
  async (ctx) => {
    // `aria-checked` is defined as `true`, `false` or `mixed`. The projection builds it by
    // stringifying whatever the state carries, so a state whose `checked` is absent produces
    // `aria-checked="undefined"` — a value no assistive technology maps to a checked state, on the
    // one attribute that says whether the box is ticked.
    //
    // The projection is a published function: a consumer writing their own renderer hands it their
    // own state object, so the shape it is handed is not the engine's to guarantee. What it can
    // guarantee is that it never emits an attribute value outside the three the standard allows.
    const LEGAL = ["true", "false", "mixed"];

    for (const [label, checked] of [
      ["ticked", true],
      ["clear", false],
      ["absent", undefined],
      ["null", null],
      ["a string", "indeterminate"],
    ]) {
      const projected = projectBooleanFieldA11y(
        fieldState({ checked, value: checked }),
        [],
        { widgetId: "w" },
      ).input.attributes["aria-checked"];
      ctx.log.note("what a boolean field says about being ticked", { label, projected });

      expectClaim(projected === null || LEGAL.includes(projected), {
        claimIds: ["A11Y-004"],
        what: `a boolean field announced aria-checked=${JSON.stringify(projected)}, which is not one of ${LEGAL.join("/")}`,
        detail: JSON.stringify({ label, checked, projected }),
      });
    }
  },
);
