/**
 * Every field kind shares the same outer shell: `mdy-renderer`, `mdy-label`, `mdy-input-wrapper`,
 * `mdy-control__errors`. The structure is the contract's, and the shipped `@modyra/styles` themes
 * target exactly these classes — a renderer that spells them differently produces a form the themes
 * cannot style.
 *
 * Renderers build the control themselves and insert it into the wrapper.
 */
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES, MDY_WIDGET_CONTRACTS, fieldAccessibleName, type MdyWidgetKind } from "@modyra/widgets";
import { el, setText } from "./dom.js";

export interface FieldShell {
  readonly root: HTMLDivElement;
  readonly label: HTMLLabelElement;
  /** Holds the control, between the prefix and suffix when the field supplies them. */
  readonly wrapper: HTMLDivElement;
  readonly description: HTMLParagraphElement;
  readonly errorList: HTMLUListElement;
  /** The name for a control that has no visible label; see {@link insertControl}. */
  readonly ariaLabel?: string;
  /** The visible label's text, which names the control when no explicit name is given. */
  readonly labelText?: string;
  /** The field's own name — the last thing left to name a control with. */
  readonly fieldName?: string;
  /** Reflects state the themes key off: touched on the root, disabled/error on the wrapper. */
  syncState(state: { touched?: boolean; disabled?: boolean; hasError?: boolean; filled?: boolean; required?: boolean; open?: boolean }): void;
}

export interface FieldShellAffixes {
  readonly prefix?: string;
  readonly suffix?: string;
}

export function buildFieldShell(
  labelText: string | undefined,
  kind: MdyWidgetKind,
  affixes: FieldShellAffixes = {},
  ariaLabel?: string,
  /** The field's own name, which names the control when nothing written for a person does. */
  fieldName?: string,
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
    ariaLabel,
    labelText,
    fieldName,
    root,
    label,
    wrapper,
    description,
    errorList,
    syncState({ touched, disabled, hasError, filled, required, open }) {
      root.classList.toggle("mdy-renderer--touched", Boolean(touched));
      // The other state a renderer root carries, and the one nothing was applying. The contract
      // lists `open` beside `touched` in `MDY_FIELD_STATE_CLASSES.fieldStates` and names the class
      // it takes, so a theme can style a field while its popup is showing — and a field whose popup
      // was open looked exactly like one whose popup was not.
      root.classList.toggle(MDY_FIELD_STATE_CLASSES.rendererOpen, Boolean(open));
      wrapper.classList.toggle("mdy-input-wrapper--disabled", Boolean(disabled));
      wrapper.classList.toggle("mdy-input-wrapper--error", Boolean(hasError));
      label.classList.toggle("mdy-label--filled", Boolean(filled));
      label.classList.toggle("mdy-label--has-error", Boolean(hasError));
      requiredMark.hidden = !required;
    },
  };
}

/**
 * Puts the control inside the input wrapper, where every renderer and every theme expects it.
 *
 * This is also where the control gets its name: the explicit one when given, the label's own text
 * otherwise. Naming it here as well as through `for` is redundant on paper and load-bearing in
 * practice — the label element also holds the required marker, so a name read from its content
 * carries an asterisk the user's word does not, and anything matching the name exactly then misses
 * the control the user is asking for.
 */
export function insertControl(shell: FieldShell, control: HTMLElement): void {
  // A control with no accessible name is announced as its role and nothing else. A label is optional
  // in a document by design, so the field's own name is what is left to say — see
  // `fieldAccessibleName`, which is where the order lives so both renderers answer the same.
  const name = fieldAccessibleName({
    ariaLabel: shell.ariaLabel,
    label: shell.labelText,
    name: shell.fieldName,
  });
  // On the element a person operates, which is not always the one handed over: a slider arrives
  // wrapped in its track, and a name on the wrapper is a name the control does not carry.
  const operated = control.matches("input, select, textarea, [role], button")
    ? control
    : control.querySelector<HTMLElement>("input, select, textarea, [role], button") ?? control;
  if (name) operated.setAttribute("aria-label", name);
  (shell.wrapper.querySelector(`.${MDY_FIELD_SHELL_CLASSES.control}`) ?? shell.wrapper).appendChild(control);
}

