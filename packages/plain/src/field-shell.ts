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
  syncState(state: { touched?: boolean; disabled?: boolean; hasError?: boolean; filled?: boolean; required?: boolean; open?: boolean; readonly?: boolean }): void;
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
  /** The line under the control, when the field declares one. */
  supportingText?: string,
): FieldShell {
  const root = el("div") as HTMLDivElement;
  root.classList.add(...MDY_WIDGET_CONTRACTS[kind].rootClasses);

  const label = el("label", MDY_FIELD_SHELL_CLASSES.label) as HTMLLabelElement;
  // A label a document did not write still has to say something, because everything inside this
  // shell is named by pointing at it: a `radiogroup`, a `grid`, a `dialog` whose `aria-labelledby`
  // resolves to an empty element is announced as its role and nothing else. The words are the ones
  // `fieldAccessibleName` chooses, and where they are the field's own name rather than a person's,
  // the label is kept out of sight — a name is owed to a screen reader, a heading is not.
  const written = fieldAccessibleName({ ariaLabel, label: labelText, name: fieldName });
  if (labelText) setText(label, labelText);
  else if (written) {
    setText(label, written);
    label.classList.add("mdy-label--unwritten");
  }
  // Built once and attached only while the field is required: `syncState` is what puts it in the
  // label and what takes it out.
  const requiredMark = el("span", MDY_FIELD_SHELL_CLASSES.requiredMarker);
  setText(requiredMark, "*");

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
  // Empty until a field declares words for it. Hidden while it is, because a slot with nothing in it
  // is height a person cannot read, and `aria-describedby` naming an empty element sends a screen
  // reader somewhere and gives it nothing to say.
  if (supportingText) setText(description, supportingText);
  description.hidden = !supportingText;
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
    syncState({ touched, disabled, hasError, filled, required, open, readonly }) {
      root.classList.toggle("mdy-renderer--touched", Boolean(touched));
      // The other state a renderer root carries, and the one nothing was applying. The contract
      // lists `open` beside `touched` in `MDY_FIELD_STATE_CLASSES.fieldStates` and names the class
      // it takes, so a theme can style a field while its popup is showing — and a field whose popup
      // was open looked exactly like one whose popup was not.
      root.classList.toggle(MDY_FIELD_STATE_CLASSES.rendererOpen, Boolean(open));
      wrapper.classList.toggle("mdy-input-wrapper--disabled", Boolean(disabled));
      // A different refusal from `disabled` and it has to look like one: the field is in play,
      // focusable and submitted, and locked. Unpainted, a form held for review was indistinguishable
      // from one waiting to be filled in.
      wrapper.classList.toggle("mdy-input-wrapper--readonly", Boolean(readonly));
      wrapper.classList.toggle("mdy-input-wrapper--error", Boolean(hasError));
      label.classList.toggle("mdy-label--filled", Boolean(filled));
      label.classList.toggle("mdy-label--has-error", Boolean(hasError));
      // Present only where it applies. Hidden was not enough: the element was still in the label
      // for anything asking whether this field is marked — a test, a tool, a stylesheet — so an
      // optional field carried the marker of a required one and only `display: none` said otherwise.
      if (required) {
        if (requiredMark.parentElement === null) label.appendChild(requiredMark);
      } else {
        requiredMark.remove();
      }
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
  //
  // A real control before a bare `[role]`, and that order is the whole of it. Asked for either at
  // once, a multiselect handed over its box and the first match was the **chip strip** — a
  // `role="list"`, structure rather than control — so the field's name was announced on the list of
  // chosen values while the combobox beside it carried the same word. One name, two things, and the
  // renderer that did it was the only one of three that did.
  const operable = "input, select, textarea, button";
  const operated = control.matches(`${operable}, [role]`)
    ? control
    : control.querySelector<HTMLElement>(operable)
      ?? control.querySelector<HTMLElement>("[role]")
      ?? control;
  if (name) operated.setAttribute("aria-label", name);
  (shell.wrapper.querySelector(`.${MDY_FIELD_SHELL_CLASSES.control}`) ?? shell.wrapper).appendChild(control);
}

