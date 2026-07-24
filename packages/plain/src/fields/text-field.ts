/**
 * Renders text/textarea/email/password/number/slider kinds — all of these
 * map to the same headless createFieldController from @modyra/widgets
 * (per this session's own finding while designing the datepicker/timepicker
 * controllers: "slider" is structurally just a numeric field with
 * <input type=range> markup, not a distinct controller).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicNumberField, MdyDynamicTextField } from "@modyra/core";
import { createFieldController } from "@modyra/widgets";
import { applyPart, el, setErrors } from "../dom.js";
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
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  const isTextarea = f.kind === "textarea";
  const isNumeric = f.kind === "number" || f.kind === "slider";

  const controller = createFieldController(
    { widgetId: f.name, handle, inputType: isTextarea ? undefined : NATIVE_INPUT_TYPE[f.kind] },
    reactivity,
  );

  const shell = buildFieldShell(f.label);
  const input = (isTextarea ? el("textarea") : el("input")) as HTMLInputElement | HTMLTextAreaElement;
  if (f.placeholder) input.placeholder = f.placeholder;
  if (!isTextarea && isNumeric) {
    const numberField = f as MdyDynamicNumberField;
    const numberInput = input as HTMLInputElement;
    if (numberField.min !== undefined) numberInput.min = String(numberField.min);
    if (numberField.max !== undefined) numberInput.max = String(numberField.max);
    if (numberField.step !== undefined) numberInput.step = String(numberField.step);
  }
  insertControl(shell, input);
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
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));
    const stringValue = state.value === undefined || state.value === null ? "" : String(state.value);
    if (input.value !== stringValue) input.value = stringValue;
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
