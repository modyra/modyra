/**
 * Every field kind shares the same outer shell: `mdy-renderer`, `mdy-label`, `mdy-input-wrapper`,
 * `mdy-control__errors`. The structure is the contract's, and the shipped `@modyra/styles` themes
 * target exactly these classes — a renderer that spells them differently produces a form the themes
 * cannot style.
 *
 * Renderers build the control themselves and insert it into the wrapper.
 */
import { MDY_FIELD_SHELL_CLASSES, MDY_WIDGET_CONTRACTS, fieldAccessibleName, type MdyWidgetKind, shellStateClasses } from "@modyra/widgets";
import type { MdyFieldConstraints } from "@modyra/core";
import { fieldCanBeInvalid } from "@modyra/widgets";
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
  /** The kind, so the shell can ask the catalogue which element is this field's control. */
  readonly kind: MdyWidgetKind;
  /** Reflects state the themes key off: touched on the root, disabled/error on the wrapper. */
  syncState(state: {
    touched?: boolean; disabled?: boolean; hasError?: boolean; filled?: boolean;
    required?: boolean; open?: boolean; readonly?: boolean;
    /** The field's rules, so the shell can tell a field that can fail from one that cannot. */
    constraints?: MdyFieldConstraints | null;
  }): void;
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

  /**
   * The box, on the kinds whose value is read inside one.
   *
   * Given to every field, it framed a slider's track and a radio group's dots — controls whose slot
   * *is* the value, with nothing to look into. The three renderers then disagreed about which of them
   * wore it, because each decided separately what the shell handed out unconditionally.
   *
   * Asked of the contract, so no renderer decides: `valueSlot` says whether this kind is read by
   * looking inside a surface. The wrapper element stays either way — it is the row the shell lays
   * out — and what it stops carrying is the treatment.
   */
  const readsInsideASurface = MDY_WIDGET_CONTRACTS[kind].valueSlot === "container";
  const wrapper = el("div", readsInsideASurface ? MDY_FIELD_SHELL_CLASSES.inputWrapper : "") as HTMLDivElement;
  // The themes lay the wrapper out as a flex row and expect the control inside an inliner —
  // without it the control is a flex item with no basis and collapses to nothing.
  const inliner = el("div", MDY_FIELD_SHELL_CLASSES.control);
  /**
   * A press that lands on the box rather than on the control still reaches the control.
   *
   * The inliner is inset from the field it sits in, so there is a strip along each edge that looks
   * like the field and is not the control: a press there put focus nowhere at all — measured, the
   * document's body kept it — while the same press in the other two renderers lands on the control,
   * because neither of them draws this element.
   *
   * Forwarded rather than removed: the themes lay the wrapper out as a flex row and expect this box,
   * and a control that is a flex item with no basis collapses to nothing. Only a press on the box
   * *itself* is forwarded — one on a prefix, a suffix or a button inside it is that element's.
   */
  inliner.addEventListener("mousedown", (event) => {
    if (event.target !== inliner) return;
    const control = inliner.querySelector<HTMLElement>("input, textarea, select, button");
    if (control === null || control.hasAttribute("disabled")) return;
    event.preventDefault();
    control.focus();
  });
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
    kind,
    root,
    label,
    wrapper,
    description,
    errorList,
    syncState({ touched, disabled, hasError, filled, required, constraints, open, readonly }) {
      // Two questions, and only one of them is about the field's rules.
      //
      // The container **holds its place** under any field that can fail a rule of its own, so a
      // message arriving does not push down the field somebody is already reaching for. Under a field
      // with no rule that is a line of scrolling bought for nothing.
      //
      // But a field with no local rule can still be told it is wrong: a server answers about a value
      // it alone can judge, and that refusal has to land somewhere. Reserved-or-not decides whether
      // the box waits empty; **having something to say decides whether the box exists at all**, and
      // reading only the first hid a message the form was holding.
      errorList.hidden = !hasError && !fieldCanBeInvalid({ required, constraints, disabled });
      // Which class a state puts on is the contract's answer, not this file's — including that a
      // failing field is `--error` on its wrapper and `--has-error` on its label, two spellings a
      // reader had to know were one state. `readonly` is a different refusal from `disabled` and has
      // to look like one, or a form held for review reads as one waiting to be filled in.
      // `unwritten` among them, and it is not cosmetic: the caption a document did not write carries
      // the field's own key, and the class is what keeps that key out of sight while leaving it where
      // a reader can follow a reference to it. Left out of this call, the toggle below turned off the
      // class the shell had just switched on — so a page showed `rows.0.code` in the position and
      // styling of a caption somebody meant, which is worse than showing nothing at all.
      const shell = shellStateClasses({
        touched, open, disabled, readonly, error: hasError, filled, unwritten: !labelText,
      });
      for (const [element, wanted] of [[root, shell.field], [wrapper, shell.control], [label, shell.label]] as const) {
        for (const [className, isOn] of Object.entries(wanted)) element.classList.toggle(className, isOn);
      }
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
  // **The element the contract calls this kind's control**, not the first one that happens to match.
  // A file field hands over a container whose first control is the hidden picker — which is the
  // control — and a radio group hands over a container whose first control is an arbitrary option,
  // where the caption was announced as the name of "Small" and every other option had none. Counting
  // them does not tell the two apart; the catalogue does, because a kind that has a `control` part
  // says which element it is and a kind that has none is named as a whole.
  const declared = MDY_WIDGET_CONTRACTS[shell.kind].parts as Record<string, { classes: readonly string[] } | undefined>;
  const controlClass = declared.control?.classes[0];
  // No `CSS.escape`: it is absent in some of the environments this runs in, and these class names
  // are the catalogue's own — a fixed vocabulary with nothing in it a selector has to be protected
  // from.
  const named = controlClass ? control.querySelector<HTMLElement>(`.${controlClass}`) : null;
  const operated = control.matches(`${operable}, [role]`)
    ? control
    : named
      ?? control.querySelector<HTMLElement>("[role]")
      ?? (control.querySelectorAll(operable).length === 1
        ? control.querySelector<HTMLElement>(operable)!
        : control);
  // The field's name goes on the element that stands for the field — unless that element has
  // already said what it is. A door into a panel is named for the act it performs, from the
  // dictionary, and writing the field's label over it produces "T, button": the caption repeated,
  // saying nothing about what pressing it does, and in English on a translated page.
  if (name && !operated.hasAttribute("aria-label")) operated.setAttribute("aria-label", name);
  (shell.wrapper.querySelector(`.${MDY_FIELD_SHELL_CLASSES.control}`) ?? shell.wrapper).appendChild(control);
}

