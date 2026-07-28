/**
 * Every field kind shares the same outer shell. The structure is not arbitrary: it is the
 * documented theme class structure that `@modyra/angular` and `@modyra/lit` already render
 * (see packages/lit/src/base.ts) — `mdy-renderer`, `mdy-label`, `mdy-input-wrapper`,
 * `mdy-control__errors`. The shipped `@modyra/styles` themes target exactly these, so
 * emitting them is what makes a plain-rendered form look like an Angular- or Lit-rendered
 * one instead of an unstyled approximation of it.
 *
 * Renderers build the control themselves and insert it into the wrapper.
 */
import { MDY_FIELD_SHELL_CLASSES, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "@modyra/widgets";
import { el, setText } from "./dom.js";

export interface FieldShell {
  readonly root: HTMLDivElement;
  readonly label: HTMLLabelElement;
  /** Holds the control between the prefix/suffix slots, like the Lit base element's wrapper. */
  readonly wrapper: HTMLDivElement;
  readonly description: HTMLParagraphElement;
  readonly errorList: HTMLUListElement;
  /** Reflects state the themes key off: touched on the root, disabled/error on the wrapper. */
  syncState(state: { touched?: boolean; disabled?: boolean; hasError?: boolean; filled?: boolean; required?: boolean }): void;
}

export function buildFieldShell(labelText: string | undefined, kind: MdyWidgetKind): FieldShell {
  const root = el("div") as HTMLDivElement;
  root.classList.add(...MDY_WIDGET_CONTRACTS[kind].rootClasses);

  const label = el("label", MDY_FIELD_SHELL_CLASSES.label) as HTMLLabelElement;
  if (labelText) setText(label, labelText);
  const requiredMark = el("span", MDY_FIELD_SHELL_CLASSES.requiredMarker);
  setText(requiredMark, "*");
  requiredMark.hidden = true;
  label.appendChild(requiredMark);

  const wrapper = el("div", MDY_FIELD_SHELL_CLASSES.inputWrapper) as HTMLDivElement;
  // The themes lay the wrapper out as a flex row and expect the control inside an inliner —
  // without it the control is a flex item with no basis and collapses to nothing.
  const inliner = el("div", MDY_FIELD_SHELL_CLASSES.control);
  wrapper.appendChild(inliner);
  const description = el("p", MDY_FIELD_SHELL_CLASSES.supportingText) as HTMLParagraphElement;
  const errorList = el("ul", MDY_FIELD_SHELL_CLASSES.errors) as HTMLUListElement;

  root.append(label, wrapper, description, errorList);

  return {
    root,
    label,
    wrapper,
    description,
    errorList,
    syncState({ touched, disabled, hasError, filled, required }) {
      root.classList.toggle("mdy-renderer--touched", Boolean(touched));
      wrapper.classList.toggle("mdy-input-wrapper--disabled", Boolean(disabled));
      wrapper.classList.toggle("mdy-input-wrapper--error", Boolean(hasError));
      label.classList.toggle("mdy-label--filled", Boolean(filled));
      label.classList.toggle("mdy-label--has-error", Boolean(hasError));
      requiredMark.hidden = !required;
    },
  };
}

/** Puts the control inside the input wrapper, where every renderer and every theme expects it. */
export function insertControl(shell: FieldShell, control: HTMLElement): void {
  (shell.wrapper.querySelector(`.${MDY_FIELD_SHELL_CLASSES.control}`) ?? shell.wrapper).appendChild(control);
}
