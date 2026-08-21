/**
 * Renders the "timepicker" kind via createTimepickerFieldController: a typeable input and a toggle
 * opening the draft/commit dialog the contract describes — the clock face, the two number
 * fields behind the mode toggle, and the AM/PM pair.
 *
 * The clock is the picker. Where the pointer is on the face is all this renderer works out; what
 * time that is, which numbers the face carries and which one is selected are the contract's
 * (`set-from-angle`, `timepickerDialNumbers`, `timepickerSelectedDialValue`), so the gesture means
 * the same thing here as it does anywhere else.
 */
import type { MdyDynamicDateField } from "@modyra/core";
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import { formatTimeAs, hourToAngle, minuteToAngle, parseAnyTime, pointerAngle, to24Hour, type MdyTimeFormat } from "@modyra/core/datetime";
import {
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_WIDGET_CONTRACTS,
  acceptTimeField,
  createTimepickerFieldController,
  overlayAnchoringFor,
  overlayControlledId,
  shownErrorsOf,
  showsAsInvalid,
  stepTimeField,
  timeFieldBounds,
  timepickerDialGhost,
  timepickerDialNumbers,
  timepickerDialPick,
  timepickerDialTolerance,
  timepickerDialUnavailableArcs,
  MDY_TIMEPICKER_INNER_RING,
  timepickerSelectedRing,
  timeStepsAt,
  timepickerDialRing,
  timepickerSelectedDialValue,
  type MdyElementLookup,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { runCommands } from "../command-runtime.js";
import { applyPart, el, setErrors, setIcon, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnOutsidePointer, positionOverlay, reflectOverlayOpen, releaseOverlayPlacement, trackOverlay } from "../overlay.js";

export function renderTimepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity?: MdyReactivity,
  format: MdyTimeFormat = "24h",
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): () => void {
  reactivity = observerFor(handle, reactivity);
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("timepicker");
  const controller = createTimepickerFieldController({
    widgetId: widgetId,
    handle,
    format,
    // Declared on the field, so a document can ask for it. A capability no document can reach is a
    // capability nobody has.
    ...(f.granularity !== undefined && { granularity: f.granularity }),
    // The reading is this renderer's — it knows the notation on screen; the judgement is the
    // controller's, so both renderers answer a typed entry the same way.
    parseEntry: (text) => {
      const parsed = parseAnyTime(text, format);
      // Canonical, which is what the dial commits too: a time is `HH:mm` wherever it is held, and
      // the notation on screen is this control's own. Committing what was typed made the value the
      // spelling a person happened to use.
      return parsed ? formatTimeAs(parsed, "24h") : null;
    },
  }, reactivity);

  const parts = MDY_WIDGET_CONTRACTS.timepicker.parts;

  const shell = buildFieldShell(f.label, "timepicker", {}, f.ariaLabel, f.name);
  // The catalogue's timepicker anatomy: a typeable input plus a toggle button opening the
  // dialog, rather than one button doing both jobs.
  const control = el("input", parts.control.classes.join(" ")) as HTMLInputElement;
  control.type = "text";
  if (f.placeholder) control.placeholder = f.placeholder;
  const toggle = el("button", parts.toggle.classes.join(" ")) as HTMLButtonElement;
  setIcon(toggle, "CLOCK");
  toggle.type = "button";
  toggle.setAttribute("aria-label", messages.timepickerOpenLabel);
  // `mdy-timepicker__popup` is the class the themes position and frame; the controller only
  // names the dialog, the hour and the minute.
  const dialog = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  // The id the opener names. The relation points at the popup rather than the dialog inside it,
  // because a renderer whose panel is not modal has no dialog to name.
  dialog.id = overlayControlledId("timepicker", widgetId) ?? "";
  // The popup's anatomy is the contract's, and its classes are the ones the shipped themes already
  // style — which is what makes every renderer look alike rather than merely
  // behave alike.
  const header = el("div", parts.header.classes.join(" "));
  const fields = el("div", "mdy-timepicker-fields");
  const hourSegment = el("div", parts.hour.classes.join(" "));
  const hourInput = el("input", parts.hourControl.classes.join(" ")) as HTMLInputElement;
  hourInput.type = "number";
  hourInput.setAttribute("aria-label", messages.timepickerHourLabel);
  hourSegment.appendChild(hourInput);
  const separator = el("span", "mdy-timepicker-separator");
  setText(separator, ":");
  const minuteSegment = el("div", parts.minute.classes.join(" "));
  const minuteInput = el("input", parts.hourControl.classes.join(" ")) as HTMLInputElement;
  minuteInput.type = "number";
  minuteInput.setAttribute("aria-label", messages.timepickerMinuteLabel);
  minuteSegment.appendChild(minuteInput);
  fields.append(hourSegment, separator, minuteSegment);
  const period = el("div", parts.period.classes.join(" "));
  // Both halves of the day, each its own button, one of them marked. This used to be a single button
  // whose text was the current period and which toggled on click: the value was only readable as the
  // label of the control that changes it, nothing was ever marked selected, and the target was half
  // the size. The catalogue names the option and the state that says which one — the anatomy is the
  // contract's rather than each renderer's.
  const periodOptions = (["AM", "PM"] as const).map((half) => {
    const button = el("button", parts.periodOption.classes.join(" ")) as HTMLButtonElement;
    button.type = "button";
    button.dataset.period = half;
    setText(button, half);
    period.appendChild(button);
    return button;
  });
  header.append(fields, period);

  // The clock face. Its numbers are placed by the foundation from the `--index` each one carries,
  // and which numbers those are is `timepickerDialNumbers` — the hours, or the minutes in fives with
  // 0 at the top. A renderer working that out for itself is a renderer with its own clock.
  const clock = el("div", parts.clock.classes.join(" "));
  // A hand that moves rather than jumps, when the document asks for it. Off by default: a hand that
  // animates is briefly not where the value is, and on a face that snaps the two would disagree for
  // the length of the transition.
  if (f.animateHand === true) clock.classList.add("mdy-timepicker-dial--animated");
  const dialFace = el("div", parts.dialFace.classes.join(" "));
  // The stretches of the ring that offer nothing, when the document asks to show them. Rebuilt with
  // the face, because which they are depends on the field being picked and on the hour the draft is
  // on — and drawn behind everything, since it is the surface the numbers sit on.
  const unavailableLayer = el("div", parts.dialUnavailable.classes.join(" "));
  unavailableLayer.setAttribute("aria-hidden", "true");
  dialFace.appendChild(unavailableLayer);

  const dialHand = el("div", parts.dialHand.classes.join(" "));
  dialFace.appendChild(dialHand);
  // Where the pointer is, when that is not where the value went. Hidden unless a gesture is putting
  // the two in different places, because a second hand permanently under the first says nothing.
  const ghostHand = el("div", `${parts.dialHand.classes.join(" ")} mdy-timepicker-dial__hand--ghost`);
  ghostHand.setAttribute("aria-hidden", "true");
  ghostHand.hidden = true;
  dialFace.appendChild(ghostHand);
  clock.appendChild(dialFace);

  const content = el("div", parts.content.classes.join(" "));
  content.append(header, clock);

  const actions = el("div", parts.actions.classes.join(" "));
  const modeToggle = el("button", parts.modeToggle.classes.join(" ")) as HTMLButtonElement;
  modeToggle.type = "button";
  const spacer = el("div", "mdy-timepicker-spacer");
  const confirmButton = el("button", `${parts.action.classes.join(" ")} mdy-timepicker-action-btn--confirm`) as HTMLButtonElement;
  confirmButton.type = "button";
  setText(confirmButton, messages.timepickerConfirm);
  const cancelButton = el("button", parts.action.classes.join(" ")) as HTMLButtonElement;
  cancelButton.type = "button";
  setText(cancelButton, messages.timepickerCancel);
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
  // The control opens the overlay and never closes it: it is the field the user types into, so a
  // click there is the caret being placed, not a switch being flipped. The toggle button is the
  // switch. `MDY_POPUP_OPENERS[kind].typeable` is where the contract says so.
  control.addEventListener("click", () => { if (!controller.state().open) dispatch({ type: "open" }); });
  control.addEventListener("input", () => { typing = true; });
  control.addEventListener("blur", () => { typing = false; dispatch({ type: "blur" }); });
  // The text goes to the controller as text. Parsing here and dispatching only on success is what
  // made `14:30` vanish from a 12-hour control: nothing was dispatched, and the sync below rewrote
  // the input from a value that had not changed.
  control.addEventListener("change", () => {
    typing = false;
    dispatch({ type: "type", text: control.value });
  });
  /**
   * A typed segment, judged against the range the contract states for it.
   *
   * `Number.isFinite` accepted `25` and `61` and handed them on, so an impossible time was dropped
   * somewhere downstream with nothing on screen to say the entry was wrong. The rejection carries
   * its reason and its bounds, so the box can say what it expected.
   */
  const bindSegment = (
    input: HTMLInputElement,
    field: "hour" | "minute",
    apply: (value: number) => void,
  ): void => {
    // Read per interaction, not captured: a windowed granularity's minute step depends on the hour
    // the draft is on, so a step resolved once would answer for the hour the popup opened at.
    const stepsNow = () => timeStepsAt(f.granularity, to24Hour(controller.state().draft));
    const bounds = () => timeFieldBounds(field, format, stepsNow());
    input.min = String(bounds().min);
    input.max = String(bounds().max);
    // The native attribute for exactly this, so the platform's own spinner offers what the field
    // offers rather than every value between.
    input.step = String(bounds().step);

    input.addEventListener("input", () => {
      const entry = acceptTimeField(field, format, input.value, stepsNow());
      if (entry.type === "accepted") {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("title");
        apply(entry.value);
        return;
      }
      // An empty box is being cleared, not asserted: it is not an error until it is left.
      if (input.value.trim().length === 0) {
        input.removeAttribute("aria-invalid");
        return;
      }
      input.setAttribute("aria-invalid", "true");
      input.title = `${bounds().min}–${bounds().max}`;
    });

    // Stepping wraps, which is the other half of the same contract: an arrow key scans the range
    // rather than asserting a value, so the end of it is not a wall.
    input.addEventListener("keydown", (event) => {
      const delta = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      const current = acceptTimeField(field, format, input.value, stepsNow());
      const from = current.type === "accepted" ? current.value : bounds().min;
      const next = stepTimeField(field, format, from, delta, stepsNow());
      input.value = String(next);
      input.removeAttribute("aria-invalid");
      apply(next);
    });

    input.addEventListener("focus", () => dispatch({ type: "focus-field", field }));
  };

  bindSegment(hourInput, "hour", (hour) => dispatch({ type: "set-hour", hour }));
  bindSegment(minuteInput, "minute", (minute) => dispatch({ type: "set-minute", minute }));
  for (const button of periodOptions) {
    // Each button asks for its own half rather than for "the other one": a control that says AM and
    // means "switch" is a control whose label describes what it is not.
    button.addEventListener("click", () => dispatch({ type: "set-period", period: button.dataset.period as "AM" | "PM" }));
  }
  confirmButton.addEventListener("click", () => dispatch({ type: "confirm" }));
  cancelButton.addEventListener("click", () => dispatch({ type: "cancel" }));
  // Escape is the same intent as Cancel, from wherever the user is: the picker edits a draft, and
  // dismissing it has to discard that draft rather than leave it half-applied. Bound on both the
  // control and the popup because this overlay does not take focus when it opens.
  // Escape cancels and Tab lets go: an overlay whose focus has moved on to the next field is a
  // panel floating over a control the user has already left. Both dismiss, and they differ in where
  // focus lands — Escape hands it back to the opener, Tab leaves it where the key was taking it.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" || event.key === "Tab") dispatch({ type: "cancel" });
  };
  wrapper.addEventListener("keydown", onEscape);
  dialog.addEventListener("keydown", onEscape);
  modeToggle.addEventListener("click", () =>
    dispatch({ type: "set-view-mode", mode: controller.state().viewMode === "dial" ? "input" : "dial" }));

  /**
   * Picking on the face. The angle-to-time arithmetic is the contract's `set-from-angle`, which
   * calls the shared snapping — this only reports where the pointer is.
   */
  /**
   * The radius the outer digits are drawn at, read from the stylesheet that draws them.
   *
   * `--tp-hand-length` is `dialSize / 2 − numSize / 2 − 8px`, and all three of those numbers belong
   * to the drawing. Measured rather than recomputed here: a copy of them in this file is a copy that
   * drifts from the paint, and the hit test then sends a pointer to the number beside the one under
   * the finger.
   */
  function handLength(): number {
    // The hand's own height, not `--tp-hand-length`: a custom property resolves at use, so reading it
    // back gives the token stream — `calc(256px/2 - 40px/2 - 8px)` — which no `parseFloat` reads.
    // That branch never succeeded and the fallback ran instead: half the *face*, 128 where the hand
    // is 100, so every angle-at-a-radius here was computed against a circle 28% too large.
    const drawn = Number.parseFloat(getComputedStyle(dialHand).height);
    // Falls back to the face's own radius when the stylesheet is not loaded — a face with no CSS has
    // no rings drawn on it either, so the answer cannot be wrong about where they are.
    return Number.isFinite(drawn) && drawn > 0 ? drawn : dialFace.getBoundingClientRect().width / 2;
  }

  /**
   * Draws the faint hand where the pointer is, when the value went somewhere else.
   *
   * Both its angle and its ring are the pointer's: it answers "what happens if I release now", while
   * the real hand answers "what is chosen". The two agreeing is the ordinary case and draws nothing.
   */
  function showGhost(angle: number, ring: "outer" | "inner", reach: number, state: { format: MdyTimeFormat; focusedField: "hour" | "minute"; draft: { hour: number; minute: number; period: "AM" | "PM" } }): void {
    const steps = timeStepsAt(f.granularity, to24Hour(state.draft));
    const pick = timepickerDialPick(angle, state.focusedField, state.format, ring, steps);
    const ghost = pick && timepickerDialGhost(angle, pick, {
      ring,
      within: timepickerDialTolerance(ring, handLength()),
      pointerReach: reach,
      handLength: handLength(),
    });
    ghostHand.hidden = ghost === null;
    if (!ghost) return;
    ghostHand.style.transform = `rotate(${ghost.angle}deg)`;
    // Its length is the pointer's own distance from the centre, not either ring's radius: the end
    // of it is under the finger, which is the whole of what it says.
    ghostHand.style.setProperty("--tp-ghost-reach", String(ghost.reach));
  }

  /** Redraws the dimmed stretches for the field and the hour the draft is on. */
  function drawUnavailable(field: "hour" | "minute", state: { format: MdyTimeFormat; draft: { hour: number; minute: number; period: "AM" | "PM" } }): void {
    unavailableLayer.replaceChildren();
    if (f.showUnavailable !== true) return;
    const steps = timeStepsAt(f.granularity, to24Hour(state.draft));
    const rings = state.format === "24h" && field === "hour" ? (["outer", "inner"] as const) : (["outer"] as const);
    for (const ring of rings) {
      for (const arc of timepickerDialUnavailableArcs(field, state.format, steps, handLength(), ring)) {
        const slice = el("div", parts.dialUnavailableArc.classes.join(" "));
        slice.style.setProperty("--tp-arc-from", `${arc.from}deg`);
        slice.style.setProperty("--tp-arc-span", `${((arc.to - arc.from) + 360) % 360}deg`);
        if (ring === "inner") slice.style.scale = String(MDY_TIMEPICKER_INNER_RING);
        unavailableLayer.appendChild(slice);
      }
    }
  }

  function pickFromPointer(event: PointerEvent): void {
    const state = controller.state();
    if (state.viewMode !== "dial") return;
    const face = dialFace.getBoundingClientRect();
    const angle = pointerAngle(face, event.clientX, event.clientY);
    // A 24-hour face draws twelve more numbers on a shorter radius, so the direction alone does not
    // say which hour is under the pointer. Which ring it is belongs to the contract, like which
    // numbers there are: a renderer deciding for itself is a renderer that can disagree with its own
    // drawing.
    const ring = timepickerDialRing(face, event.clientX, event.clientY, state.format, handLength(), state.focusedField);
    const dx = event.clientX - (face.left + face.width / 2);
    const dy = event.clientY - (face.top + face.height / 2);
    showGhost(angle, ring, Math.sqrt(dx * dx + dy * dy), state);
    dispatch({ type: "set-from-angle", field: state.focusedField, angle, ring });
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
    // The gesture is over, so there is no pointer to be somewhere else than the value.
    ghostHand.hidden = true;
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
    applyPart(dialog, { ...view.parts.dialog, id: overlayControlledId("timepicker", widgetId) ?? undefined });
    applyPart(hourSegment, view.parts.hour);
    applyPart(hourInput, view.parts.hourControl);
    applyPart(minuteSegment, view.parts.minute);
    applyPart(minuteInput, view.parts.minuteControl);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    // An entry the field could not read is this control's own verdict: the form holds nothing, so it
    // has no error to give, and saying nothing leaves the person looking at their own text believing
    // it was taken.

    // Said to the form as well as to the page: the field holds a value its own rules accept — `null`,
    // which nothing objects to — while the person is looking at text this control could not read, so
    // without this the submit went out holding nothing where they had typed something.
    // Reported to the form first, so the entry is one of the field's errors like any other — and read
    // back through `shownErrorsOf`, which is where "out of play, no verdict" lives. Painting from
    // `entryUnreadable` directly kept announcing a control nobody could touch.
    handle.reportEntry(state.entryUnreadable ? messages.entryUnreadable : null);
    setErrors(shell.errorList, shownErrorsOf(handle).map((e) => e.message));
    control.setAttribute("aria-invalid", String(showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() })));
    shell.syncState({
      open: state.open,
      touched: handle.touched(), disabled: handle.disabled(),
      hasError: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }), filled: (state.value || "") !== "", required: handle.required(),
    });

    // The input mirrors the committed value, except while the person is typing — and except while it
    // holds an entry the field could not read, which stays where they can correct it.
    // The control's own notation, projected by the controller: the value is canonical `HH:mm`, and a
    // twelve-hour control showing it directly would read `14:30` to a person who typed `2:30 PM`.
    const display = state.display;
    if (!typing && control.value !== display) control.value = display;
    reflectOverlayOpen(dialog, state.open, messages);
    // Anchored by the contract, like every other overlay: the placement, the size and the
    // coordinates are `anchorOverlay`'s, and this only measures and applies them.
    if (state.open) positionOverlay(dialog, shell.wrapper, anchoring);
    else releaseOverlayPlacement(dialog);
    const hourString = String(state.draft.hour);
    if (hourInput.value !== hourString) hourInput.value = hourString;
    const minuteString = String(state.draft.minute).padStart(2, "0");
    if (minuteInput.value !== minuteString) minuteInput.value = minuteString;
    for (const button of periodOptions) {
      button.classList.toggle(
        `${parts.periodOption.classes[0]}--selected`,
        button.dataset.period === state.draft.period,
      );
    }
    period.hidden = format === "24h";

    // ── The clock face ──────────────────────────────────────────────────────────────────────
    const onDial = state.viewMode === "dial";
    dialogContainer.classList.toggle("mdy-timepicker--dial", onDial);
    clock.hidden = !onDial;
    modeToggle.setAttribute("aria-label", onDial ? "Enter the time" : "Pick on the clock");
    // Geometry, not a character: an emoji renders in the reader's emoji font, at its size and its
    // colours, matching nothing around it and changing shape between platforms.
    setIcon(modeToggle, onDial ? "KEYBOARD" : "CLOCK");

    const field = state.focusedField;
    hourSegment.classList.toggle("mdy-timepicker-segment--active", field === "hour");
    minuteSegment.classList.toggle("mdy-timepicker-segment--active", field === "minute");
    // The hand points at the draft, through the same angle helpers the numbers are placed by.
    dialHand.style.transform = `rotate(${field === "minute" ? minuteToAngle(state.draft.minute) : hourToAngle(state.draft.hour)}deg)`;
    // And reaches only as far as the ring it points into. A 24-hour face puts two hours at one
    // direction, so a hand of one length leaves the two selections identical on screen.
    dialHand.classList.toggle(
      "mdy-timepicker-dial__hand--inner",
      timepickerSelectedRing(field, state.draft, state.format) === "inner",
    );

    drawUnavailable(field, state);

    // The face the format has, so a 24-hour picker can be pointed at its afternoon hours.
    const numbers = timepickerDialNumbers(field, state.format, timeStepsAt(f.granularity, to24Hour(state.draft)));
    // Same units as the numbers above, so the mark cannot land on a different hour than the face.
    const selected = timepickerSelectedDialValue(field, state.draft, state.format);
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
