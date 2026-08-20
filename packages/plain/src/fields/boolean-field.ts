/**
 * Renders checkbox/toggle kinds via createBooleanFieldController.
 *
 * A boolean control does not use the shared field shell: its anatomy is one clickable wrapper
 * holding the input, the drawn track/thumb for a switch, and the text — the contract puts the
 * label *inside* the wrapper, after the control, and the themes style `.mdy-checkbox` /
 * `.mdy-toggle` as that wrapper.
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicBooleanField } from "@modyra/core";
import { MDY_FIELD_STATE_CLASSES, MDY_WIDGET_CONTRACTS, createBooleanFieldController, fieldAccessibleName, shownErrorsOf, showsAsInvalid } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";

export function renderBooleanField(
  container: HTMLElement,
  f: MdyDynamicBooleanField,
  handle: MdyFieldHandle<boolean>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
): () => void {
  reactivity = observerFor(handle, reactivity);
  const isToggle = f.kind === "toggle";
  const controller = createBooleanFieldController({ widgetId: widgetId, handle, variant: isToggle ? "switch" : "checkbox" }, reactivity);
  const definition = f.kind === "toggle" ? MDY_WIDGET_CONTRACTS.toggle : MDY_WIDGET_CONTRACTS.checkbox;

  const root = el("div") as HTMLDivElement;
  root.classList.add(...definition.rootClasses);
  const wrapper = el("label") as HTMLLabelElement;
  applyPart(wrapper, definition.parts.inputWrapper);
  const input = el("input") as HTMLInputElement;
  input.type = "checkbox";
  // Set as the element's own class rather than through applyPart: the controller applies its input
  // part to this same element later, and applyPart replaces everything but the base class.
  input.className = definition.parts.control.classes.join(" ");
  const labelText = el("span") as HTMLSpanElement;
  if (f.label) setText(labelText, f.label);
  const requiredMark = el("span", definition.parts.requiredMarker.classes.join(" "));
  setText(requiredMark, "*");
  requiredMark.hidden = true;
  labelText.appendChild(requiredMark);

  // A boolean's visible words sit beside the box rather than in a `<label for>`, so the control is
  // named here. A label is optional in a document by design, and the field's own name is what is
  // left to say — `fieldAccessibleName` holds the order, so every renderer answers the same.
  const accessibleName = fieldAccessibleName({ ariaLabel: f.ariaLabel, label: f.label, name: f.name });
  if (accessibleName) input.setAttribute("aria-label", accessibleName);

  wrapper.append(input);
  if (isToggle) {
    const track = el("span", MDY_WIDGET_CONTRACTS.toggle.parts.track.classes.join(" "));
    const thumb = el("span", MDY_WIDGET_CONTRACTS.toggle.parts.thumb.classes.join(" "));
    track.setAttribute("aria-hidden", "true");
    track.appendChild(thumb);
    wrapper.append(track);
  } else {
    // The drawn box: a real element so the theme centres the tick inside it.
    const indicator = el("span", MDY_WIDGET_CONTRACTS.checkbox.parts.indicator.classes.join(" "));
    indicator.setAttribute("aria-hidden", "true");
    wrapper.append(indicator);
  }
  wrapper.append(labelText);

  const description = el("p") as HTMLParagraphElement;
  const errorList = el("ul") as HTMLUListElement;
  root.append(wrapper, description, errorList);
  container.appendChild(root);

  input.addEventListener("change", () => controller.dispatch({ type: input.checked ? "check" : "uncheck" }));
  input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    // `view.root` still carries the controller's own `mdy-field--*` state vocabulary, which no
    // adapter emits; the canonical state class on a renderer root is `mdy-renderer--touched`.
    root.classList.toggle("mdy-renderer--touched", state.touched);
    applyPart(labelText, view.parts.label);
    // After `applyPart`, which replaces everything but the base class: the label's error state is
    // the shared shell's vocabulary, and a boolean has no shared shell to apply it. The control says
    // it is wrong with `aria-invalid`, and the words beside it said nothing.
    labelText.classList.toggle(
      MDY_FIELD_STATE_CLASSES.label + "--has-error",
      showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    );
    applyPart(input, view.parts.input);
    applyPart(description, view.parts.description);
    applyPart(errorList, view.parts.error);
    setErrors(errorList, shownErrorsOf(handle).map((e) => e.message));
    requiredMark.hidden = !state.required;
    // The "checked" content attribute (set by applyPart above) only sets the initial
    // state; the live IDL property is what the browser actually renders/toggles after
    // the first user interaction, so it needs setting explicitly, same reasoning as
    // text-field.ts's separate `input.value` sync.
    if (input.checked !== state.checked) input.checked = state.checked;
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    root.remove();
  };
}
