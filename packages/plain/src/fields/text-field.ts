/**
 * Renders text/textarea/email/password/number/slider kinds — all of these
 * map to the same headless createTextFieldController from @modyra/widgets
 * (per this session's own finding while designing the datepicker/timepicker
 * controllers: "slider" is structurally just a numeric field with
 * <input type=range> markup, not a distinct controller).
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicNumberField, MdyDynamicTextField } from "@modyra/core";
import {
  MDY_CSS_PROPERTIES,
  MDY_WIDGET_CONTRACTS,
  createTextFieldController,
  narrowConstraints,
  shownErrorsOf,
  sliderFillRatio,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

const NATIVE_INPUT_TYPE: Record<string, string> = {
  text: "text",
  email: "email",
  password: "password",
  number: "number",
  slider: "range",
};

export function renderTextField(
  container: HTMLElement,
  f: MdyDynamicTextField | MdyDynamicNumberField,
  handle: MdyFieldHandle<string | number>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
): () => void {
  reactivity = observerFor(handle, reactivity);
  const isTextarea = f.kind === "textarea";
  const isNumeric = f.kind === "number" || f.kind === "slider";

  // What this control asks for on top of the field's rules. The projection composes the two and
  // puts the attributes on the control part, so nothing here places them on the element.
  const ranged = f.kind === "number" || f.kind === "slider" ? f : null;
  const narrowing = ranged
    ? { min: ranged.min ?? null, max: ranged.max ?? null, step: ranged.step ?? null }
    : undefined;

  const controller = createTextFieldController(
    {
      widgetId: widgetId,
      handle,
      inputType: isTextarea ? undefined : NATIVE_INPUT_TYPE[f.kind],
      kind: f.kind,
      constraints: () => narrowing ?? {},
    },
    reactivity,
  );

  const shell = buildFieldShell(f.label, f.kind, { prefix: f.prefix, suffix: f.suffix }, f.ariaLabel);
  const input = (isTextarea ? el("textarea") : el("input")) as HTMLInputElement | HTMLTextAreaElement;
  if (f.placeholder) input.placeholder = f.placeholder;
  // A slider is not a bare input: the contract gives it a container and a displayed value, and
  // the themes lay both out. Every class here comes from the catalog, none from this file.
  const slider = f.kind === "slider" ? MDY_WIDGET_CONTRACTS.slider : null;
  // The same range the attributes carry, so the painted fill and the handle agree about where the
  // track starts and ends. A slider must span something to be drawn at all, so where neither the
  // config nor the field's rules say, it is what a bare `<input type="range">` assumes.
  const offered = () => narrowConstraints(handle.constraints(), narrowing);
  const sliderMin = f.kind === "slider" ? offered().min ?? 0 : 0;
  const sliderMax = f.kind === "slider" ? offered().max ?? 100 : 100;
  let sliderValue: HTMLSpanElement | null = null;
  if (slider) {
    const track = el("div") as HTMLDivElement;
    applyPart(track, slider.parts.track);
    sliderValue = el("span") as HTMLSpanElement;
    applyPart(sliderValue, slider.parts.value);
    input.className = slider.parts.control.classes.join(" ");
    track.append(input, sliderValue);
    insertControl(shell, track);
  } else {
    insertControl(shell, input);
  }
  container.appendChild(shell.root);

  input.addEventListener("input", () => {
    const raw = input.value;
    controller.dispatch({ type: "input", value: isNumeric ? Number(raw) : raw });
  });
  input.addEventListener("focus", () => controller.dispatch({ type: "focus" }));
  input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(input, view.parts.input);
    if (sliderValue) {
      setText(sliderValue, String(state.value ?? ""));
      // On the control, not the track: the gradient is composed on the element that carries the
      // property, or it freezes at the fallback (modyra.css:266-269).
      input.style.setProperty(
        MDY_CSS_PROPERTIES.control.sliderFill,
        String(sliderFillRatio(state.value, sliderMin, sliderMax)),
      );
    }
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, shownErrorsOf(handle).map((e) => e.message));
    // The themes style these state classes, the contract's own base element toggles.
    shell.syncState({
      touched: handle.touched(),
      disabled: handle.disabled(),
      hasError: shownErrorsOf(handle).length > 0,
      filled: Boolean(handle.value()),
      required: handle.required(),
    });
    const stringValue = state.value === undefined || state.value === null ? "" : String(state.value);
    if (input.value !== stringValue) input.value = stringValue;
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
