/**
 * Every field kind shares the same outer shell: `mdy-renderer`, `mdy-label`, `mdy-input-wrapper`,
 * `mdy-control__errors`. The structure is the contract's, and the shipped `@modyra/styles` themes
 * target exactly these classes — a renderer that spells them differently produces a form the themes
 * cannot style.
 *
 * Renderers build the control themselves and insert it into the wrapper.
 */
import { MDY_FIELD_SHELL_CLASSES, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "@modyra/widgets";
import { el, setText } from "./dom.js";

export interface FieldShell {
  readonly root: HTMLDivElement;
  readonly label: HTMLLabelElement;
  /** Holds the control, between the prefix and suffix when the field supplies them. */
  readonly wrapper: HTMLDivElement;
  readonly description: HTMLParagraphElement;
  readonly errorList: HTMLUListElement;
  /** Reflects state the themes key off: touched on the root, disabled/error on the wrapper. */
  syncState(state: { touched?: boolean; disabled?: boolean; hasError?: boolean; filled?: boolean; required?: boolean }): void;
}

export interface FieldShellAffixes {
  readonly prefix?: string;
  readonly suffix?: string;
}

export function buildFieldShell(
  labelText: string | undefined,
  kind: MdyWidgetKind,
  affixes: FieldShellAffixes = {},
): FieldShell {
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
  // Only when there is something to put in them: an empty affix is a gap the theme still spaces.
  if (affixes.prefix) {
    const prefix = el("div", MDY_FIELD_SHELL_CLASSES.prefix);
    setText(prefix, affixes.prefix);
    wrapper.appendChild(prefix);
  }
  wrapper.appendChild(inliner);
  if (affixes.suffix) {
    const suffix = el("div", MDY_FIELD_SHELL_CLASSES.suffix);
    setText(suffix, affixes.suffix);
    wrapper.appendChild(suffix);
  }
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
