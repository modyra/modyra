/**
 * Renders radio/segmented kinds via createOptionFieldController — real
 * native <input type=radio> per option (segmented is the same semantics,
 * a CSS-only visual variant, as the catalogue's segmented anatomy declares — a button
 * reusing the radiogroup pattern).
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { groupSubmitName,
  MDY_WIDGET_CONTRACTS,
  createOptionFieldController,
  shownErrorsOf,
  visibleErrorsOf,
  defaultOptionKey,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";

export function renderOptionField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<unknown>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
): MdyMountedField {
  reactivity = observerFor(handle, reactivity);
  const variant = f.kind === "segmented" ? "segmented" : "radio";
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  /**
   * The key the contract derives, not `String()`.
   *
   * Every plain object renders as `[object Object]` through it, so an object-valued list gave every
   * option one key: two different choices became one, and a group holding one value marked all of
   * them. `defaultOptionKey` is what the controller derives its own keys with, and for a primitive
   * the two agree exactly — which is why every fixture here concurred and none could see it.
   */
  const keyFor = (option: MdySelectOption<unknown>) => defaultOptionKey(option.value);
  const controller = createOptionFieldController(
    { widgetId: widgetId, handle, options, variant, keyFor, label: f.label ?? null, ariaLabel: f.ariaLabel ?? null, fieldName: f.name },
    reactivity,
  );

  // Both variants are one radio group semantically, but each names its parts its own way in the
  // contract; picking the definition per variant keeps every class in the catalog.
  const parts = f.kind === "segmented"
    ? { group: MDY_WIDGET_CONTRACTS.segmented.parts.group, option: MDY_WIDGET_CONTRACTS.segmented.parts.option, radio: MDY_WIDGET_CONTRACTS.segmented.parts.optionControl, control: MDY_WIDGET_CONTRACTS.segmented.parts.optionCheck, text: MDY_WIDGET_CONTRACTS.segmented.parts.optionText }
    : { group: MDY_WIDGET_CONTRACTS.radio.parts.group, option: MDY_WIDGET_CONTRACTS.radio.parts.option, radio: MDY_WIDGET_CONTRACTS.radio.parts.optionControl, control: MDY_WIDGET_CONTRACTS.radio.parts.optionCheck, text: MDY_WIDGET_CONTRACTS.radio.parts.optionLabel };
  const shell = buildFieldShell(f.label, f.kind, {}, f.ariaLabel, f.name, f.supportingText);
  const group = el("div") as HTMLDivElement;
  group.className = parts.group.classes.join(" ");
  /**
   * One row per option, rebuilt when the list is replaced.
   *
   * Built once at mount, the DOM outlived the list it was built from: a chooser told about new
   * options showed the old ones, which is the same shape of defect as reading state a controller
   * owns.
   */
  let rows: ReadonlyArray<{ key: string; input: HTMLInputElement; row: HTMLLabelElement }> = [];
  const buildRows = (list: ReadonlyArray<MdySelectOption<unknown>>): void => {
    group.replaceChildren();
    rows = list.map((option) => {
    const key = keyFor(option);
    const row = el("label") as HTMLLabelElement;
    row.className = parts.option.classes.join(" ");
    const input = el("input") as HTMLInputElement;
    input.type = "radio";
    // The name does two jobs — it groups the set, and it is the key the answer arrives under — and
    // which one is at stake depends on whether this set has a form to belong to.
    input.name = groupSubmitName(group, f.name, widgetId);
    input.value = key;
    // The choice itself, named by the contract where the kind declares it. `radio` reaches its
    // native input through the label instead, so there is nothing to name there.
    if (parts.radio) input.className = parts.radio.classes.join(" ");
    row.appendChild(input);
    // The drawn control is its own element — the radio's circle, the segment's checkmark — exactly
    // as every renderer emits it. Putting that class on the native input instead made
    // the input answer to `.mdy-segmented__button`, so every segment appeared twice in the DOM.
    const control = el("span") as HTMLSpanElement;
    control.className = parts.control.classes.join(" ");
    control.setAttribute("aria-hidden", "true");
    row.appendChild(control);
    const text = el("span") as HTMLSpanElement;
    text.className = parts.text.classes.join(" ");
    // The theme reserves the selected weight's width up front so selecting does not reflow the bar.
    text.dataset.text = option.label;
    setText(text, option.label);
    row.appendChild(text);
    group.appendChild(row);
    return { key, input, row };
    });
    for (const { key, input } of rows) {
      input.addEventListener("change", () => controller.dispatch({ type: "select", optionKey: key }));
      input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));
    }
  };
  buildRows(options);
  insertControl(shell, group);
  container.appendChild(shell.root);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    // The shell's own state, which every other kind here reflects and this one did not: the themes
    // key the touched and error treatments off the renderer root and the wrapper.
    shell.syncState({
      touched: handle.touched(),
      disabled: handle.disabled(),
      hasError: shownErrorsOf(handle).length > 0,
      // Locked against change, which is not the same refusal as disabled and must not look like
      // it: the field is still focusable, still submitted, and a person can select what it holds.
      readonly: handle.readonly(),

      filled: handle.value() !== null && handle.value() !== undefined,
      required: handle.required(), constraints: handle.constraints?.() ?? null,
    });
    applyPart(shell.label, view.parts.label);
    applyPart(group, view.parts.group);
    // Recomputed here rather than settled when the rows were built: at build time the group is not
    // in the document yet, so the question "is there a form around this" has no answer. It has one
    // by the time anything is painted, and it can change afterwards if the field is moved.
    const grouped = groupSubmitName(group, f.name, widgetId);
    for (const { input } of rows) input.name = grouped;
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, visibleErrorsOf(handle).map((e) => e.message));
    for (const { key, input, row } of rows) {
      const part = view.parts[key];
      // Classes go to the option element the contract names; the ARIA the part carries belongs to
      // the native input, which already conveys `checked`/`disabled` to assistive tech. Copying
      // `role="radio"` onto the label as well would announce two radios for one choice.
      if (part) {
        applyPart(row, { classes: part.classes, attributes: {} });
        input.disabled = part.attributes.disabled === true;
      }
      const checked = state.selectedKey === key;
      if (input.checked !== checked) input.checked = checked;
    }
  });

  return withControls(
    () => {
      effectRef.destroy();
      controller.destroy();
      shell.root.remove();
    },
    // The list can arrive after the field is on screen — a fetch, a sibling that narrows it — and
    // the controller is told rather than the field remounted, which would forget the roving focus.
    {
      setOptions: (next) => {
        const list = next as ReadonlyArray<MdySelectOption<unknown>>;
        controller.setOptions(list);
        buildRows(list);
      },
    },
  );
}
