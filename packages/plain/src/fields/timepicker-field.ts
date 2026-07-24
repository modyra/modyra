/**
 * Renders the "timepicker" kind via createTimepickerFieldController — a
 * trigger button opening a draft/commit popup with hour/minute number
 * inputs and an AM/PM toggle (the "input mode" from Angular's own real
 * timepicker; the analog dial's pointer-drag interaction is deliberately
 * not ported here, see the controller's own doc comment for why — the
 * controller still exposes a "set-from-angle" intent for a host that
 * wants to build one).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDateField } from "@modyra/core";
import { createTimepickerFieldController, type MdyElementLookup } from "@modyra/widgets";
import type { MdyTimeFormat } from "@modyra/core/time-utils";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";

export function renderTimepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity: MdyReactivity = vanillaReactivity(),
  format: MdyTimeFormat = "12h",
): () => void {
  const controller = createTimepickerFieldController({ widgetId: f.name, handle, format }, reactivity);

  const shell = buildFieldShell(f.label);
  const trigger = el("button") as HTMLButtonElement;
  trigger.type = "button";
  const dialog = el("div") as HTMLDivElement;
  const hourInput = el("input") as HTMLInputElement;
  hourInput.type = "number";
  const minuteInput = el("input") as HTMLInputElement;
  minuteInput.type = "number";
  const periodButton = el("button") as HTMLButtonElement;
  periodButton.type = "button";
  const confirmButton = el("button") as HTMLButtonElement;
  confirmButton.type = "button";
  setText(confirmButton, "Confirm");
  const cancelButton = el("button") as HTMLButtonElement;
  cancelButton.type = "button";
  setText(cancelButton, "Cancel");
  dialog.append(hourInput, minuteInput, periodButton, confirmButton, cancelButton);

  const wrapper = el("div", "mdy-plain-timepicker");
  wrapper.append(trigger, dialog);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  const lookup: MdyElementLookup = (part) => (part === "trigger" ? trigger : undefined);
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch(controller.state().open ? { type: "close", restoreFocus: false } : { type: "open" }));
  hourInput.addEventListener("input", () => {
    const hour = Number(hourInput.value);
    if (Number.isFinite(hour)) dispatch({ type: "set-hour", hour });
  });
  hourInput.addEventListener("focus", () => dispatch({ type: "focus-field", field: "hour" }));
  minuteInput.addEventListener("input", () => {
    const minute = Number(minuteInput.value);
    if (Number.isFinite(minute)) dispatch({ type: "set-minute", minute });
  });
  minuteInput.addEventListener("focus", () => dispatch({ type: "focus-field", field: "minute" }));
  periodButton.addEventListener("click", () => dispatch({ type: "set-period", period: controller.state().draft.period === "AM" ? "PM" : "AM" }));
  confirmButton.addEventListener("click", () => dispatch({ type: "confirm" }));
  cancelButton.addEventListener("click", () => dispatch({ type: "cancel" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(trigger, view.parts.trigger);
    applyPart(dialog, view.parts.dialog);
    applyPart(hourInput, view.parts.hour);
    applyPart(minuteInput, view.parts.minute);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    setText(trigger, state.value ?? f.placeholder ?? "Select a time");
    dialog.hidden = !state.open;
    const hourString = String(state.draft.hour);
    if (hourInput.value !== hourString) hourInput.value = hourString;
    const minuteString = String(state.draft.minute).padStart(2, "0");
    if (minuteInput.value !== minuteString) minuteInput.value = minuteString;
    setText(periodButton, state.draft.period);
    periodButton.hidden = format === "24h";
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
