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
  // A container, not a `<label>`. A native label forwards a click from anywhere inside it, so the
  // whole row — including its empty remainder — was a target, and a person aiming at nothing toggled
  // the field. The contract says `container` for this part on this kind, and the words beside the
  // box carry the association instead.
  const wrapper = el("div") as HTMLDivElement;
  applyPart(wrapper, definition.parts.inputWrapper);
  const input = el("input") as HTMLInputElement;
  input.type = "checkbox";
  // The id the words point at. A boolean's control had no id while its wrapper was the label and
  // forwarded the click; naming it is what lets the association survive the wrapper becoming inert.

  // Set as the element's own class rather than through applyPart: the controller applies its input
  // part to this same element later, and applyPart replaces everything but the base class.
  input.className = definition.parts.control.classes.join(" ");
  // The words are the label, which is what makes them part of the target without the row being one.
  const labelText = el("label") as HTMLLabelElement;
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

  // The false half of the value. HTML leaves an unchecked box out of the payload altogether, so
  // without this a person who said no and a form that never carried the question arrive identical.
  //
  // **After** the box, not before: a hidden input ahead of the visible control changes what
  // `querySelector("input")` and `.first()` mean for everyone reading the field, and that is the
  // most obvious selector anybody writes.
  const submitFalse = el("input") as HTMLInputElement;
  wrapper.append(input, submitFalse);
  // The drawn box goes *inside* the words' label, and that is what keeps it a pointer target: the
  // native input is visually hidden, so with the wrapper inert the only thing forwarding a click is
  // the `<label>`. Left outside it, the box a person actually aims at stopped working — measured,
  // and worse than the row being a target in the first place.
  if (isToggle) {
    const track = el("span", MDY_WIDGET_CONTRACTS.toggle.parts.track.classes.join(" "));
    const thumb = el("span", MDY_WIDGET_CONTRACTS.toggle.parts.thumb.classes.join(" "));
    track.setAttribute("aria-hidden", "true");
    track.appendChild(thumb);
    labelText.prepend(track);
  } else {
    // The drawn box: a real element so the theme centres the tick inside it.
    const indicator = el("span", MDY_WIDGET_CONTRACTS.checkbox.parts.indicator.classes.join(" "));
    indicator.setAttribute("aria-hidden", "true");
    labelText.prepend(indicator);
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
    applyPart(submitFalse, view.parts.submitFalse);
    applyPart(input, view.parts.input);
    // After the control has been named, not before: the id is the contract's, minted from the widget
    // id by `applyPart`, and reading it back is what keeps the words and the box associated now that
    // the wrapper is inert.
    if (input.id) labelText.htmlFor = input.id;
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
