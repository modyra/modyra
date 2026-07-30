/**
 * Renders the "timepicker" kind via createTimepickerFieldController: a typeable input and a toggle
 * opening the same draft/commit dialog Angular's timepicker shows — the clock face, the two number
 * fields behind the mode toggle, and the AM/PM pair.
 *
 * The clock is the picker. Where the pointer is on the face is all this renderer works out; what
 * time that is, which numbers the face carries and which one is selected are the contract's
 * (`set-from-angle`, `timepickerDialNumbers`, `timepickerSelectedDialValue`), so the gesture means
 * the same thing here as it does in Angular.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDateField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, createTimepickerFieldController, overlayAnchoringFor, timepickerDialNumbers, timepickerSelectedDialValue, type MdyElementLookup } from "@modyra/widgets";
import { hourToAngle, minuteToAngle, parseAnyTime, pointerAngle, type MdyTimeFormat } from "@modyra/core/time-utils";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, setOverlayOpen, trackOverlay } from "../overlay.js";

export function renderTimepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity: MdyReactivity = vanillaReactivity(),
  format: MdyTimeFormat = "12h",
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("timepicker");
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
  const parts = MDY_WIDGET_CONTRACTS.timepicker.parts;
  const dialog = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  // The popup's anatomy is the contract's, and its classes are the ones the shipped themes already
  // style for the Angular renderer — which is what makes the three look alike rather than merely
  // behave alike.
  const header = el("div", parts.header.classes.join(" "));
  const fields = el("div", "mdy-timepicker-fields");
  const hourSegment = el("div", parts.hour.classes.join(" "));
  const hourInput = el("input", "mdy-timepicker-segment-input") as HTMLInputElement;
  hourInput.type = "number";
  hourInput.setAttribute("aria-label", "Hour");
  hourSegment.appendChild(hourInput);
  const separator = el("span", "mdy-timepicker-separator");
  setText(separator, ":");
  const minuteSegment = el("div", parts.minute.classes.join(" "));
  const minuteInput = el("input", "mdy-timepicker-segment-input") as HTMLInputElement;
  minuteInput.type = "number";
  minuteInput.setAttribute("aria-label", "Minute");
  minuteSegment.appendChild(minuteInput);
  fields.append(hourSegment, separator, minuteSegment);
  const period = el("div", parts.period.classes.join(" "));
  const periodButton = el("button", "mdy-timepicker-period-btn") as HTMLButtonElement;
  periodButton.type = "button";
  period.appendChild(periodButton);
  header.append(fields, period);

  // The clock face. Its numbers are placed by the foundation from the `--index` each one carries,
  // and which numbers those are is `timepickerDialNumbers` — the hours, or the minutes in fives with
  // 0 at the top. A renderer working that out for itself is a renderer with its own clock.
  const clock = el("div", parts.clock.classes.join(" "));
  const dialFace = el("div", parts.dialFace.classes.join(" "));
  const dialHand = el("div", parts.dialHand.classes.join(" "));
  dialFace.appendChild(dialHand);
  clock.appendChild(dialFace);

  const content = el("div", parts.content.classes.join(" "));
  content.append(header, clock);

  const actions = el("div", parts.actions.classes.join(" "));
  const modeToggle = el("button", parts.modeToggle.classes.join(" ")) as HTMLButtonElement;
  modeToggle.type = "button";
  const spacer = el("div", "mdy-timepicker-spacer");
  const confirmButton = el("button", `${parts.action.classes.join(" ")} mdy-timepicker-action-btn--confirm`) as HTMLButtonElement;
  confirmButton.type = "button";
  setText(confirmButton, "Confirm");
  const cancelButton = el("button", parts.action.classes.join(" ")) as HTMLButtonElement;
  cancelButton.type = "button";
  setText(cancelButton, "Cancel");
  actions.append(modeToggle, spacer, cancelButton, confirmButton);

  // The container is what the popup frames: it carries the padding, the width and the surface, so
  // a popup with no container has no width of its own and stretches to whatever holds it.
  const dialogContainer = el("div", parts.container.classes.join(" "));
  dialogContainer.append(content, actions);
  dialog.appendChild(dialogContainer);

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
  modeToggle.addEventListener("click", () =>
    dispatch({ type: "set-view-mode", mode: controller.state().viewMode === "dial" ? "input" : "dial" }));

  /**
   * Picking on the face. The angle-to-time arithmetic is the contract's `set-from-angle`, which
   * calls the same snapping the Angular clock uses — this only reports where the pointer is.
   */
  function pickFromPointer(event: PointerEvent): void {
    const state = controller.state();
    if (state.viewMode !== "dial") return;
    const angle = pointerAngle(dialFace.getBoundingClientRect(), event.clientX, event.clientY);
    dispatch({ type: "set-from-angle", field: state.focusedField, angle });
  }
  let dragging = false;
  dialFace.addEventListener("pointerdown", (event) => {
    if (controller.state().viewMode !== "dial") return;
    event.preventDefault();
    dragging = true;
    dialFace.setPointerCapture(event.pointerId);
    pickFromPointer(event);
  });
  dialFace.addEventListener("pointermove", (event) => { if (dragging) pickFromPointer(event); });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    pickFromPointer(event);
    // Hours hand over to minutes once picked, so one gesture sets a whole time.
    if (controller.state().focusedField === "hour") dispatch({ type: "focus-field", field: "minute" });
  };
  dialFace.addEventListener("pointerup", endDrag);
  dialFace.addEventListener("pointercancel", endDrag);

  const undismiss = dismissOnOutsidePointer(
    [wrapper],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );

  const untrack = trackOverlay(dialog, shell.wrapper, () => controller.state().open, anchoring);

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
    setOverlayOpen(dialog, state.open);
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(dialog, shell.wrapper, anchoring);
    else releaseOverlayPlacement(dialog);
    const hourString = String(state.draft.hour);
    if (hourInput.value !== hourString) hourInput.value = hourString;
    const minuteString = String(state.draft.minute).padStart(2, "0");
    if (minuteInput.value !== minuteString) minuteInput.value = minuteString;
    setText(periodButton, state.draft.period);
    periodButton.hidden = format === "24h";

    // ── The clock face ──────────────────────────────────────────────────────────────────────
    const onDial = state.viewMode === "dial";
    dialogContainer.classList.toggle("mdy-timepicker--dial", onDial);
    clock.hidden = !onDial;
    modeToggle.setAttribute("aria-label", onDial ? "Enter the time" : "Pick on the clock");
    setText(modeToggle, onDial ? "⌨" : "🕐");

    const field = state.focusedField;
    hourSegment.classList.toggle("mdy-timepicker-segment--active", field === "hour");
    minuteSegment.classList.toggle("mdy-timepicker-segment--active", field === "minute");
    // The hand points at the draft, through the same angle helpers the numbers are placed by.
    dialHand.style.transform = `rotate(${field === "minute" ? minuteToAngle(state.draft.minute) : hourToAngle(state.draft.hour)}deg)`;

    // The face the format has, so a 24-hour picker can be pointed at its afternoon hours.
    const numbers = timepickerDialNumbers(field, state.format);
    const selected = timepickerSelectedDialValue(field, state.draft);
    // The face is rebuilt only when it changes hands: hours and minutes are different numbers, but
    // dragging within one field must not replace the elements under the pointer.
    if (dialFace.dataset.field !== field) {
      dialFace.dataset.field = field;
      for (const stale of Array.from(dialFace.querySelectorAll(`.${parts.dialNumber.classes[0]}`))) stale.remove();
      for (const number of numbers) {
        // Labels, not controls: the foundation makes them `pointer-events: none`, because the face
        // owns the gesture — a number under the pointer is where the angle already points. Typing
        // the time is the keyboard path, and that is what the mode toggle is for.
        const node = el("span", parts.dialNumber.classes.join(" "));
        node.dataset.value = String(number.value);
        node.style.setProperty("--index", String(number.index));
        if (number.ring === "inner") node.classList.add("mdy-timepicker-dial__number--inner");
        node.setAttribute("aria-hidden", "true");
        setText(node, number.label);
        dialFace.appendChild(node);
      }
    }
    for (const node of Array.from(dialFace.querySelectorAll<HTMLElement>(`.${parts.dialNumber.classes[0]}`))) {
      node.classList.toggle("mdy-timepicker-dial__number--selected", Number(node.dataset.value) === selected);
    }
  });

  return () => {
    untrack();
    undismiss();
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
