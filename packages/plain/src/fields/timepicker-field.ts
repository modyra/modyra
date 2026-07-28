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
import { parseAnyTime, type MdyTimeFormat } from "@modyra/core/time-utils";
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

  const shell = buildFieldShell(f.label, "timepicker");
  // Same anatomy as the Angular renderer: a typeable input plus a toggle button opening the
  // dialog, rather than one button doing both jobs.
  const control = el("input", "mdy-timepicker__input") as HTMLInputElement;
  control.type = "text";
  if (f.placeholder) control.placeholder = f.placeholder;
  const toggle = el("button", "mdy-timepicker__toggle") as HTMLButtonElement;
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open the clock");
  // `mdy-timepicker__popup` is the class the themes position and frame; the controller only
  // names the dialog, the hour and the minute.
  const dialog = el("div", "mdy-timepicker__popup") as HTMLDivElement;
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

  const wrapper = el("div", "mdy-timepicker mdy-plain-timepicker");
  wrapper.append(control, toggle, dialog);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  const lookup: MdyElementLookup = (part) => (part === "trigger" ? control : undefined);
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  // Same reasoning as the datepicker: confirming restores focus to the input, so the sync is
  // guarded by whether the user is typing, not by where focus happens to be.
  let typing = false;
  const toggleOverlay = () => dispatch(controller.state().open ? { type: "close", restoreFocus: false } : { type: "open" });
  toggle.addEventListener("click", toggleOverlay);
  control.addEventListener("click", toggleOverlay);
  control.addEventListener("input", () => { typing = true; });
  control.addEventListener("blur", () => { typing = false; dispatch({ type: "blur" }); });
  // A typed time goes through the draft the dialog edits, then commits — one path, one policy.
  control.addEventListener("change", () => {
    typing = false;
    const parsed = parseAnyTime(control.value, format);
    if (!parsed) {
      if (!control.value) dispatch({ type: "clear" });
      return;
    }
    dispatch({ type: "set-hour", hour: parsed.hour });
    dispatch({ type: "set-minute", minute: parsed.minute });
    if (parsed.period) dispatch({ type: "set-period", period: parsed.period });
    dispatch({ type: "confirm" });
  });
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
    applyPart(control, view.parts.trigger);
    toggle.disabled = state.disabled;
    applyPart(dialog, view.parts.dialog);
    applyPart(hourInput, view.parts.hour);
    applyPart(minuteInput, view.parts.minute);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    // The input mirrors the committed value; while it has focus the user's own text wins.
    const display = state.value || "";
    if (!typing && control.value !== display) control.value = display;
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
