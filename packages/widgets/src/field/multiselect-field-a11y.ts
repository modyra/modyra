/**
 * Accessibility projection for the multiselect field widget.
 *
 * The options are a group of toggle buttons — `role="group"` with `aria-pressed` on each chip — not
 * a listbox. A listbox announces "N of M selected" and expects a single roving focus through a list
 * the user opens; these chips are all on screen at once and each is independently on or off, which
 * is what a pressed toggle already means.
 */
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { fieldDescribedBy } from "./shell-a11y.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import { blocksFocus } from "../interactivity.js";
import type { MdyFieldError } from "@modyra/core";
import { assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
import { MDY_CHIP_CLASSES, multiselectChipClasses } from "../chip.js";
import { stateClass } from "../state.js";
import type { MdyMultiselectFieldState } from "./multiselect-field-types.js";
import { errorsVisible, holdsUneditedValue, shownErrors } from "./verdict.js";

export interface MdyMultiselectFieldA11yOptions {
  /**
   * Whether the supporting text is on the page.
   *
   * Named unconditionally, the description points at an element a renderer may not have drawn — the
   * reference resolves to nothing and the control is described by an id rather than by words.
   * Defaults to true, which is what every caller relied on before it could say otherwise.
   */
  readonly descriptionVisible?: boolean;
  /**
   * Whether the error container is on the page, whether or not it holds a message.
   *
   * A renderer that keeps it under every field that can fail a rule passes this, and the control's
   * description then names one element that never changes — no moment at which the reference can
   * point at something not yet drawn, or already gone.
   *
   * Defaults to whether there are errors to show, so a renderer that draws the container only when it
   * has something to say is unaffected.
   */
  readonly errorsReserved?: boolean;
  readonly widgetId: string;
}

/** Builds the static IDs used by a multiselect field widget view. */
export function multiselectFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly groupId: string;
  readonly triggerId: string;
  readonly popupId: string;
  readonly searchId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  assertUsableWidgetId(widgetId);
  return {
    labelId: `${widgetId}__label`,
    groupId: `${widgetId}__group`,
    triggerId: `${widgetId}__trigger`,
    popupId: `${widgetId}__popup`,
    searchId: `${widgetId}__search`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__errors`,
  };
}

/** Computes the public state classes for the multiselect field root. */
export function multiselectFieldRootClasses<TValue>(state: MdyMultiselectFieldState<TValue>): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
  ];
}

/**
 * Projects ARIA attributes and classes for the multiselect field parts (per-option chip parts are
 * built by the controller, same split option-field-controller.ts uses).
 *
 * The options live in an overlay, like every other popup widget in the catalog: `trigger` is what
 * the user sees and operates, `popup` is the panel it controls, and `group` is the chip group
 * inside it. Laying the group out inline instead would reflow the page on every open.
 */
export function projectMultiselectFieldA11y<TValue>(
  state: MdyMultiselectFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyMultiselectFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly placeholder: MdyPartContract;
  readonly chips: MdyPartContract;
  /** The single row a grid structures its cells in. */
  readonly chipRow: MdyPartContract;
  readonly popup: MdyPartContract;
  readonly search: MdyPartContract;
  readonly group: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
  /**
   * What was chosen, said out loud, with the words to say it.
   *
   * A choice lands and the strip is the only confirmation — which is the one a screen reader user
   * does not get. The text is the whole selection rather than the last change, so it differs
   * whenever the selection does: a region written once announces the first choice and swallows
   * every one after it, which passes any check that makes only one.
   */
  readonly announcement: MdyPartContract & { readonly text: string };
  /**
   * One chip in the strip: a value the person has chosen, as they see it.
   *
   * Projected rather than left to each renderer, because it is the element of this widget a person
   * looks at most and it was the one element no projection described. Three renderers each built it,
   * and they were brought into agreement one attribute at a time — the value class reached the last
   * of them a day after the other two, and a chip that said where it stood in the strip reached one
   * of them first. Agreement arrived at by correction diverges again on the next attribute nobody
   * has measured.
   *
   * `position` and `size` are the chip's place in the strip and how many there are. They are given
   * rather than derived because the strip decides what it draws — a strip that hides what does not
   * fit still has to say one of eight, not one of three.
   */
  readonly chip: (key: string, appearance: {
    readonly label: string;
    readonly count: number;
    readonly position: number;
    readonly size: number;
    readonly active: boolean;
    readonly named: boolean;
  }) => MdyPartContract;
} {
  const { labelId, groupId, triggerId, popupId, searchId, descriptionId, errorId } =
    multiselectFieldPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
  // Whether the person is being told yet — `aria-invalid` says the same thing the error list does.
  // A rule they have not answered waits for them to reach the field; a refusal about the value
  // already there does not, because they can neither cause it by inaction nor see the reason unless
  // it is said.
  const tellingThem = errorsVisible({ disabled: state.disabled, touched: state.touched, holdsUnedited: holdsUneditedValue(state, "multiselect") }, errors);

  const opener = projectOverlayOpenerA11y("multiselect", { widgetId: options.widgetId, open: state.open });
  // What the catalogue says a chip in the strip is. Read once here rather than at each renderer,
  // which is how one of them came to carry a role the other two did not.
  const chipRole = MDY_WIDGET_CONTRACTS.multiselect.parts.chip.role;
  // Both, error first — an error does not take the place of the instruction that would have
  // prevented it. The container is pointed at while it is on the page, which is not the same as
  // while it holds a message: a renderer that reserves it keeps one reference that never changes.
  const describedBy = fieldDescribedBy({
    errorId,
    descriptionId,
    errorsPresent: options.errorsReserved ?? hasErrors,
    descriptionPresent: options.descriptionVisible ?? true,
  });

  return {
    root: {
      classes: [
        ...multiselectFieldRootClasses(state),
        ...(state.open ? ["mdy-renderer--open"] : []),
      ],
      attributes: {},
    },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: {
        for: triggerId,
      },
    },
    trigger: {
      id: triggerId,
      // The trigger's own classes, not the field box's. Carrying `mdy-multiselect` here put the
      // wrapper's class on the control, so one class named two elements and whatever resolved a
      // part by class found the wrong one — including the label, which then named a box.
      classes: [...MDY_WIDGET_CONTRACTS.multiselect.parts.trigger.classes],
      // The role as well as the attributes. Spreading only the attributes left the opener with
      // `aria-expanded`, `aria-invalid` and `aria-required` on a bare `<button>` — a role with no
      // value to be wrong about and nothing to expand, so every one of them named a state the
      // element cannot be in.
      ...(opener?.role ? { role: opener.role } : {}),
      attributes: {
        ...opener?.attributes,
        // The caption, and only the caption: a control carrying `aria-labelledby` *and* a name of
        // its own says the first and nothing else, because the reference wins the computation. One
        // mechanism, so three renderers cannot each pick a different one. ADR 0175.
        "aria-labelledby": labelId,
        "aria-invalid": String(tellingThem),
        "aria-required": String(state.required),
        "aria-disabled": String(state.disabled),
        // A read-only field refuses the change and stays in play: focusable, submitted, validated.
        // What refuses it is the controller, and this is what says so.
        "aria-readonly": state.readonly ? "true" : null,
        "aria-describedby": describedBy,
        disabled: state.disabled,
      },
    },
    placeholder: {
      classes: ["mdy-multiselect__placeholder"],
      // Shown only while nothing is selected — the chips speak for themselves once there are any.
      attributes: { hidden: state.selectedKeys.size > 0 },
    },
    chip: (key, appearance) => ({
      classes: [
        ...multiselectChipClasses({ role: "value" }),
        // Where the keyboard is standing in the strip, which a class is what makes visible.
        ...(appearance.active ? [stateClass(MDY_CHIP_CLASSES.block, "active")] : []),
      ],
      ...(chipRole === undefined ? {} : { role: chipRole }),
      attributes: {
        // The roving position: one chip is the strip's tab stop and the arrows move it, so the rest
        // are reachable without being separate stops on the way through the form.
        tabindex: appearance.active ? 0 : -1,
        "data-key": key,
        // The words, and how many of this one when the mode counts. A chip whose label is the whole
        // name it has is announced twice by a reader that also reads its text; the name is given
        // here because the strip may show a shortened label and must still say the whole one.
        "aria-label": appearance.count > 1 ? `${appearance.label}, ${appearance.count}` : appearance.label,
        // Which of how many, in the grid's vocabulary. A `gridcell` does not carry `aria-posinset`
        // and `aria-setsize` — they were written and the accessibility layer discarded them, so the
        // position ADR 0137 pays the scrolling strip with never arrived. A grid says the same thing
        // with a column index against the count on the grid, and a reader announces it in its own
        // slot after the name: "Roma, column 3 of 12". ADR 0148.
        //
        // **One cell per chip, never one per button.** `aria-colindex` counts cells, so a chip whose
        // five buttons were cells each would land a person on "column 14 of 72" — arithmetically
        // right and humanly useless. The buttons are inside the cell and reached with the grid's
        // interaction mode.
        "aria-colindex": appearance.position,
        // The tooltip exists only while one chip is naming itself, and names that chip alone.
        "aria-describedby": appearance.named ? `${options.widgetId}__chiptip` : null,
      },
    }),
    chips: {
      classes: ["mdy-multiselect__chips"],
      attributes: {
        // The strip is one line that scrolls, so a chip past its trailing edge is off screen with
        // nothing to say it exists. The field's description carries how many were chosen, which is
        // the fact that makes the hidden ones findable — pointed at from the strip itself, because a
        // reader on the strip is exactly the person who cannot see that it runs on.
        "aria-describedby": state.selectedKeys.size > 0 ? descriptionId : null,
        // How many chips there are, in the grid's own vocabulary. `aria-posinset`/`aria-setsize` are
        // what a list says it with and a `gridcell` does not carry them; a grid says the same thing
        // with a column count and a column index, which exist for a set that is not all rendered —
        // the same shape as a row that scrolls. A reader hears "column 3 of 12". ADR 0148.
        "aria-colcount": String(state.selectedKeys.size),
        // Stated rather than left to be inferred: one row, so nobody is left looking for rows they
        // have not found.
        "aria-rowcount": "1",
      },
    },
    chipRow: {
      classes: ["mdy-multiselect__chip-row"],
      attributes: { "aria-rowindex": "1" },
    },
    popup: {
      id: popupId,
      classes: ["mdy-multiselect__dropdown"],
      attributes: {
        // The role the catalogue declares for this part, read rather than restated: the opener
        // announces what will open, and a second spelling here is how the two come apart.
        role: MDY_WIDGET_CONTRACTS.multiselect.parts.popup.role ?? null,
        // A dialog is named or it is a region an assistive technology cannot introduce. The field's
        // label is what it is: the panel belongs to that field and to nothing else.
        "aria-labelledby": labelId,
        hidden: !state.open,
      },
    },
    search: {
      id: searchId,
      classes: ["mdy-multiselect-overlay__input"],
      attributes: {
        "aria-controls": groupId,
        "aria-label": "Filter options",
        // The native attribute, so the question is reachability rather than writability. Filtering
        // does not change the value, so a user who may read the field must still be able to do it.
        disabled: blocksFocus(state.interactivity),
      },
    },
    group: {
      id: groupId,
      classes: ["mdy-multiselect__options"],
      attributes: {
        // `role="group"` supports neither `aria-invalid` nor `aria-required`: they say something
        // about a value, and a group holds no value. `aria-invalid` moves to the trigger, which
        // supports it.
        //
        // `aria-required` has nowhere to go on this widget, and that is a gap rather than an
        // oversight. The chips are toggle buttons in a group by deliberate choice (see the note at
        // the top of this file), and neither `group` nor `button` supports the attribute — so the
        // requirement reaches assistive technology through nothing. It did not before either: an
        // attribute a role does not support is not announced, so writing it here only produced
        // markup axe reports as critical. Closing it needs a visually-hidden "required" in the label,
        // which is shared CSS this package does not own yet.
        role: "group",
        "aria-labelledby": labelId,
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
      },
    },
    description: {
      id: descriptionId,
      classes: [MDY_FIELD_SHELL_CLASSES.supportingText],
      attributes: {},
    },
    announcement: {
      classes: [...MDY_WIDGET_CONTRACTS.multiselect.parts.announcement.classes],
      attributes: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
      // The words are the renderer's, because the sentence is a *delta* and a projection sees only
      // the present state. `multiselectAnnouncement` composes it from what changed.
      text: "",
    },
    error: {
      id: errorId,
      classes: [MDY_FIELD_SHELL_CLASSES.errors],
      attributes: {
        // A live region and nothing more. `role="alert"` here would override the list semantics of
        // the <ul> it sits on: axe reports every <li> inside such a list as an orphaned list item, and
        // a screen reader sees the same thing. `aria-live` announces the list when it appears, so the
        // role would cost the structure and add nothing.
        "aria-live": "polite",
      },
    },
  };
}
