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
import { keyMeans, applySubmissionNames,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_WIDGET_CONTRACTS,
  acceptTimeField,
  createTimepickerFieldController,
  overlayAnchoringFor,
  overlayControlledId,
  visibleErrorsOf,
  stepTimeField,
  timeFieldBounds,
  dialHandLength,
  timepickerDialGhost,
  timepickerDialNumbers,
  timepickerDialPick,
  timepickerDialTolerance,
  timepickerDialUnavailableArcs,
  MDY_TIMEPICKER_INNER_RING,
  timepickerDialRing,
  timepickerSelectedRing,
  timeStepsAt,
  stateClass,
  timepickerEntry,
  timepickerEntryText,
  timepickerSelectedDialValue,
  timepickerTabTarget,
  type MdyElementLookup,
  type MdyI18nMessages,
  MDY_TIMEPICKER_DEFAULT_FORMAT,
  timepickerPlaceholder,
  type MdyUiCommand,
} from "@modyra/widgets";
import { runCommands } from "../command-runtime.js";
import { applyPart, el, setErrors, setIcon, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnFocusOutside } from "../overlay.js";
import { dismissOnOutsidePointer, positionOverlay, reflectOverlayOpen, releaseOverlayPlacement, trackOverlay } from "../overlay.js";

export function renderTimepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity?: MdyReactivity,
  format: MdyTimeFormat = MDY_TIMEPICKER_DEFAULT_FORMAT,
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
  // Not supplied by this renderer today, and named once so the box and the controller cannot end up
  // reading a typed numeral differently.
  const parseSegment: ((text: string) => number | null) | undefined = undefined;
  const controller = createTimepickerFieldController({
    widgetId: widgetId,
    handle,
    format,
    ...(parseSegment !== undefined && { parseSegment }),
    // Declared on the field, so a document can ask for it. A capability no document can reach is a
    // capability nobody has.
    ...(f.granularity !== undefined && { granularity: f.granularity }),
    // Which view it opens in, declared the same way and restored on close, so the document names
    // the view the field *has* rather than the one it happened to start on.
    ...(f.viewMode !== undefined && { viewMode: f.viewMode }),
    // Where the controller's own decisions land. Without it the dial drew the minutes while the
    // caret stayed in the hour box, so an arrow moved the field nobody was looking at.
    emit: (commands) => runDispatched(commands),
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

  const shell = buildFieldShell(f.label, "timepicker", {}, f.ariaLabel, f.name, f.supportingText);
  // The catalogue's timepicker anatomy: a typeable input plus a toggle button opening the
  // dialog, rather than one button doing both jobs.
  const control = el("input", parts.control.classes.join(" ")) as HTMLInputElement;
  control.type = "text";
  // The notation this control reads, when the field does not name its own. Absent here entirely,
  // the same document told a person what to type in two adapters and nothing in the third.
  control.placeholder = f.placeholder || timepickerPlaceholder(format);
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
  if (f.animateHand === true) clock.classList.add(stateClass(parts.clock.classes[0]!, "animated"));
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
  const ghostHand = el("div", `${parts.dialHand.classes.join(" ")} ${stateClass(parts.dialHand.classes[0]!, "ghost")}`);
  ghostHand.setAttribute("aria-hidden", "true");
  ghostHand.hidden = true;
  dialFace.appendChild(ghostHand);
  // The dial sets nothing the hour and minute boxes cannot set, and they are on screen beside it, so
  // it is a pointer surface and nothing else: hidden from assistive technology, with no role and no
  // tab stop. A `slider` a Tab walk skips is found anyway in browse mode, announces a value, answers
  // none of the keys it promises, and says the hour a second time after the box already has.
  // ADR 0145.
  dialFace.setAttribute("aria-hidden", "true");
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

  const wrapper = el("div", "mdy-timepicker");
  wrapper.append(control, toggle, dialog);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  // Every part the contract can name in a command. `hourControl` and `minuteControl` are here
  // because focus is now the contract's to place: a renderer choosing its own selector is a renderer
  // that can disagree with the state about where focus went.
  const focusable: Readonly<Record<string, HTMLElement>> = {
    hourControl: hourInput,
    minuteControl: minuteInput,
    modeToggle,
    // `action` names two buttons and the order names both: a single stop reached whichever was drawn
    // first, so tabbing to the end and pressing Enter discarded the draft instead of committing it.
    action: cancelButton,
    "action--confirm": confirmButton,
    periodOption: periodOptions[0]!,
  };
  const lookup: MdyElementLookup = (part) => (part === "trigger" ? control : focusable[part]);
  /**
   * Carries out what the controller asked for, whether it was asked or decided on its own.
   *
   * Named because the handover has no call to return commands to: the controller's timer hands the
   * hour to the minute, and the `focus` that goes with it arrives here through `emit` instead.
   */
  function runDispatched(commands: readonly MdyUiCommand[]): void {
    runCommands(commands, lookup, {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    runDispatched(controller.dispatch(intent));
  }

  // Same reasoning as the datepicker: confirming restores focus to the input, so the sync is
  // guarded by whether the user is typing, not by where focus happens to be.
  let typing = false;
  /** Which segment the user is inside, so the sync does not write over what they are typing. */
  let editing: "hour" | "minute" | null = null;
  /** The last text each box was allowed to show, so a refused keystroke has somewhere to go back to. */
  const lastText: Record<"hour" | "minute", string> = { hour: "", minute: "" };
  const toggleOverlay = () => dispatch(controller.state().open ? { type: "close", restoreFocus: false } : { type: "open" });
  toggle.addEventListener("click", toggleOverlay);
  // The control opens the overlay and never closes it: it is the field the user types into, so a
  // click there is the caret being placed, not a switch being flipped. The toggle button is the
  // switch. `MDY_POPUP_OPENERS[kind].typeable` is where the contract says so.
  control.addEventListener("click", () => { if (!controller.state().open) dispatch({ type: "open" }); });
  // And from the keyboard, on whichever keys the contract says open this kind. Asked of the table
  // rather than listed here: a popup only a pointer can reach is closed to anyone who does not use
  // one, and a renderer choosing its own keys is how the three of them come to answer differently.
  control.addEventListener("keydown", (event) => {
    const open = controller.state().open;
    if (open || !keyMeans("timepicker", event.key, "open", open)) return;
    event.preventDefault();
    dispatch({ type: "open" });
  });
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
      // Reported as typed, not parsed here. This renderer used to read the box itself and hand over
      // a number, so the draft moved and the sync below wrote the canonical form straight back —
      // `0` became `00` with the caret after it, and the next key landed third: `001` in a
      // two-digit field, with `01` unreachable by the route a person takes.
      // The same reading the controller does, with the same reader — this renderer supplies none,
      // so both are the digits every locale shares. A host that localises supplies one to the
      // controller and this call has to take it from the same place, or the box would mark as
      // unusable a numeral the draft had just accepted.
      const read = timepickerEntry(field, format, input.value, stepsNow(), parseSegment);
      if (read === null) {
        // Refused outright — a third character in a two-digit box, or something no further typing
        // rescues. The rule allows a box *narrower* than canonical and never wider, so the keystroke
        // is undone rather than left showing what the field could not hold.
        input.value = lastText[field];
        return;
      }
      lastText[field] = read.text;
      editing = field;
      dispatch({ type: "type-segment", field, text: input.value });
      // Marked while it is being edited, not judged: a partial the field cannot take yet is a
      // half-typed number, and an empty box is being cleared rather than asserted.
      const unusable = read !== null && read.value === null && input.value.trim().length > 0;
      if (unusable) input.title = `${bounds().min}–${bounds().max}`;
      else input.removeAttribute("title");
      // `"true"`, not a bare attribute: `aria-invalid` is an enumerated value and an empty one is
      // not the same claim.
      if (unusable) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    });

    // What the box settles to when it stops being edited: the canonical form of what the draft
    // holds, which is the contract's answer rather than this renderer's padding.
    input.addEventListener("blur", () => {
      editing = null;
      lastText[field] = "";
      input.value = timepickerEntryText(
        field === "hour"
          ? timepickerSelectedDialValue("hour", controller.state().draft, format)
          : controller.state().draft.minute,
      );
      input.removeAttribute("aria-invalid");
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
    if (event.key === "Escape") dispatch({ type: "cancel" });
    // Enter commits the draft, which is what the table says a dialog's Enter does. A button answers
    // it for itself — the platform turns Enter on a focused button into a click, and cancelling
    // would then also confirm — so this speaks only for the rest of the dialog, which is where a
    // person setting the time with the keyboard actually stands.
    if (
      event.key === "Enter"
      && controller.state().open
      && !event.defaultPrevented
      // Asked of the element rather than of its constructor: `instanceof` answers false across the
      // document boundaries some test environments render in, and the guard would then be off
      // exactly where a button is focused.
      && (event.target as Element | null)?.closest?.("button") == null
      && keyMeans("timepicker", "Enter", "commit", true)
    ) {
      event.preventDefault();
      dispatch({ type: "confirm" });
      return;
    }
    // The dialog sits inside the wrapper and this handler is on both, so a key pressed in the popup
    // arrives twice. Escape does not care — cancelling twice cancels once — but a Tab handled twice
    // moves two stops and silently skips the minute box.
    if (event.key !== "Tab" || event.defaultPrevented || !controller.state().open) return;
    // Tab moves inside the dialog rather than dismissing it. The popup holds a confirm button, and
    // a Tab that closed the picker left that button unreachable — so the widget's only way to
    // commit was a pointer. The order is the contract's, and it wraps: `Escape` is the way out.
    event.preventDefault();
    const from = Object.keys(focusable).find((part) => focusable[part] === document.activeElement);
    const next = timepickerTabTarget(from ?? "", format, event.shiftKey ? -1 : 1);
    if (next === "hourControl" || next === "minuteControl") {
      dispatch({ type: "focus-field", field: next === "hourControl" ? "hour" : "minute" });
    } else {
      focusable[next]?.focus();
    }
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
  /** The rule is the contract's: measuring this went wrong twice, both times in three copies. */
  const handLength = (): number => dialHandLength(dialFace);



  /**
   * Draws the faint hand where the pointer is, when the value went somewhere else.
   *
   * Both its angle and its ring are the pointer's: it answers "what happens if I release now", while
   * the real hand answers "what is chosen". The two agreeing is the ordinary case and draws nothing.
   */
  function showGhost(angle: number, ring: "outer" | "inner", reach: number, state: { format: MdyTimeFormat; focusedField: "hour" | "minute"; draft: { hour: number; minute: number; period: "AM" | "PM" } }): void {
    const steps = timeStepsAt(f.granularity, to24Hour(state.draft));
    const pick = timepickerDialPick(angle, state.focusedField, state.format, ring, steps, timepickerSelectedDialValue(state.focusedField, state.draft, state.format));
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
    // Present only when it has something in it. An empty layer is a part of the anatomy that is
    // there without being anything, which a conformance reading correctly calls an extra part.
    unavailableLayer.hidden = f.showUnavailable !== true;
    if (f.showUnavailable !== true) {
      unavailableLayer.remove();
      return;
    }
    if (!unavailableLayer.isConnected) dialFace.prepend(unavailableLayer);
    const steps = timeStepsAt(f.granularity, to24Hour(state.draft));
    for (const arc of timepickerDialUnavailableArcs(field, state.format, steps, handLength())) {
      const slice = el("div", parts.dialUnavailableArc.classes.join(" "));
      slice.style.setProperty("--tp-arc-from", `${arc.from}deg`);
      slice.style.setProperty("--tp-arc-span", `${arc.span}deg`);
      if (arc.ring === "inner") slice.style.scale = String(MDY_TIMEPICKER_INNER_RING);
      unavailableLayer.appendChild(slice);
    }
  }

  function pickFromPointer(event: PointerEvent, phase?: "move" | "end"): void {
    const state = controller.state();
    if (state.viewMode !== "dial") return;
    const face = dialFace.getBoundingClientRect();
    const angle = pointerAngle(face, event.clientX, event.clientY);
    // A 24-hour face draws twelve more numbers on a shorter radius, so the direction alone does not
    // say which hour is under the pointer. Which ring it is belongs to the contract, like which
    // numbers there are: a renderer deciding for itself is a renderer that can disagree with its own
    // drawing.
    // The ring it last answered goes back in: from position alone, a finger resting on the edge
    // changed the ring four times in a 6px wander, and the edge is where a finger naturally rests.
    const ring = timepickerDialRing(face, event.clientX, event.clientY, state.format, handLength(), state.focusedField, lastRing);
    lastRing = ring;
    const dx = event.clientX - (face.left + face.width / 2);
    const dy = event.clientY - (face.top + face.height / 2);
    showGhost(angle, ring, Math.sqrt(dx * dx + dy * dy), state);
    dispatch({ type: "set-from-angle", field: state.focusedField, angle, ring, ...(phase && { phase }) });
  }
  let dragging = false;
  /** What the ring last answered, so a wander at the edge does not keep changing it. */
  let lastRing: "outer" | "inner" | undefined;
  dialFace.addEventListener("pointerdown", (event) => {
    if (controller.state().viewMode !== "dial") return;
    event.preventDefault();
    dragging = true;
    dialFace.setPointerCapture(event.pointerId);
    pickFromPointer(event);
  });
  dialFace.addEventListener("pointermove", (event) => { if (dragging) pickFromPointer(event, "move"); });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    pickFromPointer(event, "end");
    // The gesture is over: the next one decides from where it lands.
    lastRing = undefined;
    // The gesture is over, so there is no pointer to be somewhere else than the value.
    ghostHand.hidden = true;
    // Whether the hour hands over to the minute is the contract's, and it turns on whether this
    // gesture travelled — which is why the release reports itself as the end rather than as one more
    // position.
  };
  dialFace.addEventListener("pointerup", endDrag);
  dialFace.addEventListener("pointercancel", endDrag);

  const undismiss = dismissOnOutsidePointer(
    [wrapper],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );
  // The other half of how this kind says it is dismissed. A dial left open behind a field somebody
  // has tabbed away from covers the next question and answers to a keyboard that has gone.
  const unfocusout = dismissOnFocusOutside("timepicker", [wrapper, shell.root, dialog],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
    { pointer: undismiss, markVisited: () => handle.markAsTouched() });

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
    // back through `visibleErrorsOf`, which is where "out of play, no verdict" lives. Painting from
    // `entryUnreadable` directly kept announcing a control nobody could touch.
    handle.reportEntry(state.entryUnreadable ? messages.entryUnreadable : null);
    setErrors(shell.errorList, visibleErrorsOf(handle).map((e) => e.message));
    // The same question the projection already answered. Asked as *is this field invalid* it is true
    // from the moment a required field is drawn empty, so the control announced a refusal about a
    // rule nobody had been given a turn at — over the contract's own answer, which said otherwise.
    control.setAttribute("aria-invalid", String(visibleErrorsOf(handle, "timepicker").length > 0));
    shell.syncState({
      open: state.open,
      touched: handle.touched(), disabled: handle.disabled(), readonly: handle.readonly(),
      hasError: visibleErrorsOf(handle).length > 0, filled: (state.value || "") !== "", required: handle.required(), constraints: handle.constraints?.() ?? null,
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
    // In the picker's own notation. The draft holds the hour canonically as 1–12 with a period
    // beside it whatever the format, so printing it raw showed `2` on a 24-hour picker holding
    // 14:00 — the one number on screen that says what is selected, saying something else.
    // In the picker's own notation, and never over what somebody is typing. Writing the canonical
    // form back after every keystroke is what made a half-typed minute unreachable.
    if (editing !== "hour") {
      const hourString = timepickerEntryText(timepickerSelectedDialValue("hour", state.draft, format));
      if (hourInput.value !== hourString) hourInput.value = hourString;
    }
    if (editing !== "minute") {
      const minuteString = timepickerEntryText(state.draft.minute);
      if (minuteInput.value !== minuteString) minuteInput.value = minuteString;
    }
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
      stateClass(parts.dialHand.classes[0]!, "inner"),
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
    // The key a native submit reads this control's value under, after the parts are applied: the
    // shared control projection writes `name: null` for a field it was not given a name for, and a
    // part carrying `null` removes the attribute.
    applySubmissionNames(shell.root, "timepicker", f.name);
  });

  return () => {
    untrack();
    undismiss();
    unfocusout();
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
