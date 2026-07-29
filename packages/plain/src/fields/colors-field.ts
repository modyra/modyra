/**
 * Renders the "colors" kind: a native colour input behind a preview swatch, a hex field beside it,
 * and a preset palette in a popup.
 *
 * What counts as a colour, and whether picking one should close the popup, is
 * `colorValueTransition` in `@modyra/widgets` — this renderer asks and obeys.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicColorsField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, colorValueEquals, colorValueTransition, overlayAnchoringFor, type MdyColorValueIntent } from "@modyra/widgets";
import { applyPart, el, setErrors } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnOutsidePointer, positionOverlay, trackOverlay } from "../overlay.js";

const DEFAULT_PRESETS = ["#7067ff", "#0e0f16", "#f8fafc", "#94a3b8", "#22c55e", "#ef4444", "#f59e0b", "#3b82f6"];

export function renderColorsField(
  container: HTMLElement,
  f: MdyDynamicColorsField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("colors");
  const definition = MDY_WIDGET_CONTRACTS.colors;
  const presets = f.presets && f.presets.length > 0 ? f.presets : DEFAULT_PRESETS;
  const open = reactivity.signal(false);

  const shell = buildFieldShell(f.label, "colors");
  // The themes lay this control out from the outside in — `.mdy-colors` *contains* the input
  // wrapper (`.mdy-colors .mdy-input-wrapper` is a flex row with no padding), which is how the
  // Angular renderer nests it too. Building it the other way round collapses the row to nothing.
  const wrapper = el("div", "mdy-colors mdy-plain-colors") as HTMLDivElement;
  shell.root.insertBefore(wrapper, shell.wrapper);
  wrapper.append(shell.wrapper);

  const picker = el("label") as HTMLLabelElement;
  applyPart(picker, definition.parts.nativePicker);
  const preview = el("span") as HTMLSpanElement;
  applyPart(preview, definition.parts.preview);
  const control = el("input") as HTMLInputElement;
  control.type = "color";
  applyPart(control, definition.parts.control);
  picker.append(preview, control);

  const hexInput = el("input") as HTMLInputElement;
  hexInput.type = "text";
  hexInput.spellcheck = false;
  hexInput.setAttribute("aria-label", `${f.label ?? "Colour"} — hex value`);
  applyPart(hexInput, definition.parts.hexInput);

  const toggle = el("button") as HTMLButtonElement;
  toggle.type = "button";
  applyPart(toggle, definition.parts.toggle);
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-label", "Show the preset colours");
  // The themes draw the caret on `.mdy-select__arrow`, exactly as the Angular renderer nests it
  // inside this toggle — an empty button would have no size at all.
  const toggleArrow = el("span", "mdy-select__arrow");
  toggleArrow.setAttribute("aria-hidden", "true");
  toggle.append(toggleArrow);

  // `mdy-overlay` is the portal variant of the shared container: positioned from the
  // `--mdy-overlay-*` properties `positionOverlay` writes, exactly as the select's popup is.
  const popup = el("div", "mdy-overlay") as HTMLDivElement;
  applyPart(popup, definition.parts.popup);
  const presetList = el("div") as HTMLDivElement;
  applyPart(presetList, definition.parts.presets);
  presetList.setAttribute("role", "listbox");
  popup.append(presetList);

  const swatches = presets.map((preset) => {
    const swatch = el("button") as HTMLButtonElement;
    swatch.type = "button";
    applyPart(swatch, definition.parts.swatch);
    swatch.setAttribute("role", "option");
    swatch.setAttribute("aria-label", preset);
    swatch.style.setProperty("background-color", preset);
    presetList.appendChild(swatch);
    return { preset, swatch };
  });

  insertControl(shell, picker);
  insertControl(shell, hexInput);
  const suffix = el("div", "mdy-input-suffix") as HTMLDivElement;
  suffix.append(toggle);
  shell.wrapper.append(suffix);
  wrapper.append(popup);
  container.appendChild(shell.root);

  function commit(intent: MdyColorValueIntent): void {
    const transition = colorValueTransition(intent);
    if (transition.value === undefined) return;
    handle.set(transition.value);
    handle.markAsDirty();
    if (transition.touched) handle.markAsTouched();
    // The policy decides this, not the renderer: choosing a preset answers the question the popup
    // was opened to ask, typing a hex value does not.
    if (transition.close) open.set(false);
  }

  control.addEventListener("input", () => commit({ type: "native", value: control.value }));
  hexInput.addEventListener("change", () => commit({ type: "text", value: hexInput.value }));
  hexInput.addEventListener("blur", () => handle.markAsTouched());
  toggle.addEventListener("click", () => open.set(!open()));
  for (const { preset, swatch } of swatches) {
    swatch.addEventListener("click", () => commit({ type: "preset", value: preset }));
  }
  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { open.set(false); toggle.focus(); }
  });

  const effectRef = reactivity.effect(() => {
    const value = typeof handle.value() === "string" ? (handle.value() as string) : "";
    const isOpen = open();
    if (document.activeElement !== hexInput) hexInput.value = value;
    if (value) control.value = value;
    preview.style.setProperty("background-color", value || "transparent");
    for (const { preset, swatch } of swatches) {
      const selected = colorValueEquals(value || null, preset);
      swatch.classList.toggle("mdy-color-swatch--selected", selected);
      swatch.setAttribute("aria-selected", String(selected));
    }
    control.disabled = handle.disabled();
    hexInput.disabled = handle.disabled();
    toggle.disabled = handle.disabled();
    toggle.setAttribute("aria-expanded", String(isOpen));
    popup.hidden = !isOpen;
    wrapper.classList.toggle("mdy-colors--open", isOpen);
    // The themes place the panel from `--mdy-overlay-*`; the widget policy decides them.
    if (isOpen) queueMicrotask(() => positionOverlay(popup, shell.wrapper, anchoring));
    toggleArrow.classList.toggle("mdy-select__arrow--open", isOpen);
    setErrors(shell.errorList, handle.errors().map((error) => error.message));
    shell.syncState({
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: !handle.valid(), filled: Boolean(value), required: handle.required(),
    });
  });

  const untrack = trackOverlay(popup, shell.wrapper, () => open(), anchoring);
  const undismiss = dismissOnOutsidePointer([wrapper, popup], () => open(), () => open.set(false));

  return () => {
    undismiss();
    untrack();
    effectRef.destroy();
    shell.root.remove();
  };
}
