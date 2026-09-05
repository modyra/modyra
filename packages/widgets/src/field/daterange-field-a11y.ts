/**
 * Accessibility projection for the date-range field widget — the same WAI-ARIA grid pattern the
 * datepicker uses, with two controls instead of one.
 *
 * A range has a start and an end, and they are two labelled inputs rather than one. That is the
 * whole difference at this layer: which of the two the combobox semantics sit on, and how each is
 * named — a control named only by the field's own label leaves a screen-reader user two identical
 * boxes with no way to tell which end they are typing.
 */
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { fieldDescribedBy } from "./shell-a11y.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import { assertUsableWidgetId } from "../ids.js";
import { submissionNames } from "../submission.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import type { MdyDaterangeFieldState } from "./daterange-field-types.js";
import { errorsVisible, holdsUneditedValue, shownErrors } from "./verdict.js";
import { fieldShellRootClasses } from "./shell-a11y.js";

export interface MdyDaterangeFieldA11yOptions {
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
  /** How each end is named, for a host that translates. Defaults are English and deliberate. */
  /**
   * The caption a document wrote, which names the pair rather than either box.
   *
   * The two ends together are the thing the author named; each box has a name of its own that says
   * its role in the pair. Given here, the group says the author's word once on entry. ADR 0175.
   */
  readonly label?: string;
  readonly startLabel?: string;
  readonly endLabel?: string;
  /**
   * The field's path, from which each end takes the key it submits under.
   *
   * Two ends under one key would leave a receiving end unable to say which date is which — and
   * `FormData.get` takes the first and drops the other without an error, so the loss is silent. So
   * they are suffixed, and the contract declares the suffixes rather than each renderer inventing
   * them.
   */
  readonly submitName?: string;
}

export function daterangeFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly startId: string;
  readonly endId: string;
  readonly gridId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  assertUsableWidgetId(widgetId);
  return {
    labelId: `${widgetId}__label`,
    startId: `${widgetId}__start`,
    endId: `${widgetId}__end`,
    gridId: `${widgetId}__grid`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__errors`,
  };
}

/** The root's classes, from the shared table every kind reads. */
export function daterangeFieldRootClasses(state: MdyDaterangeFieldState): readonly string[] {
  return fieldShellRootClasses(state as unknown as Readonly<Record<string, unknown>>);
}

export function projectDaterangeFieldA11y(
  state: MdyDaterangeFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyDaterangeFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  /** The box holding both ends, which is what the caption names. ADR 0175. */
  readonly inputWrapper: MdyPartContract;
  readonly startControl: MdyPartContract;
  readonly endControl: MdyPartContract;
  readonly toggle: MdyPartContract;
  readonly grid: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, startId, endId, gridId, descriptionId, errorId } =
    daterangeFieldPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error text
  // renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
  // Whether the person is being told yet — `aria-invalid` says the same thing the error list does.
  // A rule they have not answered waits for them to reach the field; a refusal about the value
  // already there does not, because they can neither cause it by inaction nor see the reason unless
  // it is said.
  const tellingThem = errorsVisible({ disabled: state.disabled, touched: state.touched, holdsUnedited: holdsUneditedValue(state, "daterange") }, errors);

  const opener = projectOverlayOpenerA11y("daterange", { widgetId: options.widgetId, open: state.open });
  // Both, error first — an error does not take the place of the instruction that would have
  // prevented it. The container is pointed at while it is on the page, which is not the same as
  // while it holds a message: a renderer that reserves it keeps one reference that never changes.
  const describedBy = fieldDescribedBy({
    errorId,
    descriptionId,
    errorsPresent: options.errorsReserved ?? hasErrors,
    // A description exists when the renderer says one does. Defaulted to `true`, a control claimed
    // `aria-describedby` at rest and pointed it at an element holding nothing — which asserts that a
    // description exists and sends a reader to a text nobody wrote. It also makes "I have a
    // description, and it is empty" indistinguishable from "I have none", where silence is the
    // honest statement of nothing to say. The errors half of this reference was repaired for exactly
    // that reason; the hint half is the same shape.
    descriptionPresent: options.descriptionVisible ?? false,
  });
  const definition = MDY_WIDGET_CONTRACTS.daterange;

  /** The key each end submits under, suffixed so the two are told apart. */
  const submitNames = options.submitName === undefined
    ? {}
    : submissionNames("daterange", options.submitName);

  /** Both ends carry the same semantics and differ only in what they are called. */
  const end = (id: string, label: string, classes: readonly string[], name: string | undefined): MdyPartContract => ({
    id,
    classes: [...classes],
    attributes: {
      // What a native submit reads. Absent leaves the end unserialised, which is what a form does
      // with a control that has no name: it sends nothing at all rather than sending it empty.
      name: name ?? null,
      // Its own name and nothing else. Pointing a box at the caption gives a *part* the name of the
      // *whole*: `aria-labelledby` wins the name computation, so both boxes announced the field's
      // words — "Stay", "Stay" — and each box's own name never spoke. What carries "of what" is the
      // group around them, which the caption names once, on entry. ADR 0175.
      "aria-label": label,
      "aria-invalid": String(tellingThem),
      "aria-required": String(state.required),
      "aria-disabled": String(state.disabled),
      "aria-describedby": describedBy,
      // The native attribute too: `aria-disabled` alone would announce a disabled field that still
      // accepts a typed date.
      disabled: state.disabled,
      // Both halves, on both ends. A read-only range refuses the typed date and the calendar's
      // choice alike — the controller declines either — so the native attribute stops the typing
      // and the ARIA says why. Either one alone is the pair that was wrong before: a control a
      // person cannot type into with nothing saying so, or a claim with nothing behind it.
      readonly: state.readonly,
      "aria-readonly": state.readonly ? "true" : null,
    },
  });

  return {
    root: { classes: daterangeFieldRootClasses(state), attributes: {} },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      // The label points at the start, which is where a click on it should land: the first thing
      // a person fills. Pointing it at the wrapper would name neither.
      attributes: { for: startId },
    },
    // The two boxes together are the thing the caption names. A person entering hears "Stay, group"
    // once and then each box's own role — which is the reading a sighted person gets from the
    // layout, and the only one that says both which end this is and what it is an end of.
    inputWrapper: {
      classes: [],
      // The caption's words, not a reference to it: a reference is one more thing that can point at
      // nothing — a label a document did not ask for is never drawn — and a reader hears the same
      // sentence either way.
      attributes: { role: "group", ...(options.label ? { "aria-label": options.label } : {}) },
    },
    startControl: end(startId, options.startLabel ?? "Start date", definition.parts.startControl.classes, submitNames.startControl),
    endControl: end(endId, options.endLabel ?? "End date", definition.parts.endControl.classes, submitNames.endControl),
    toggle: {
      classes: [...definition.parts.toggle.classes],
      // The opener carries the overlay semantics, not the inputs: one grid serves both ends, so one
      // thing opens it and one thing says whether it is open. A `<button>` already has room for
      // `aria-expanded`, which is why the opener relation declares no role for this kind — and why
      // a role written here as well said something the relation had deliberately left unsaid.
      attributes: {
        ...opener?.attributes,
        // No pointer at the field's caption. This is a button, and a button is named for the act it
        // performs — `aria-labelledby` wins the name computation, so a renderer that gives this door
        // its action name saw the caption announced instead: "T, button", the label repeated, saying
        // nothing about what pressing it does. The two inputs beside it are what the caption names.
        "aria-disabled": String(state.disabled),
      },
    },
    grid: {
      id: gridId,
      classes: [...definition.parts.grid.classes],
      attributes: { role: "grid", "aria-labelledby": labelId },
    },
    description: {
      id: descriptionId,
      classes: [MDY_FIELD_SHELL_CLASSES.supportingText],
      attributes: {},
    },
    error: {
      id: errorId,
      classes: [MDY_FIELD_SHELL_CLASSES.errors],
      attributes: { "aria-live": "polite" },
    },
  };
}
