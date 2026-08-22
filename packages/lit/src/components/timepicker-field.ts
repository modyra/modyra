import { mdyPart } from "../mdy-part.js";
import {
  projectTimepickerFieldA11y,
  type MdyPartContract,
  MDY_WIDGET_CONTRACTS,
  createPointerDrag,
  dragPointOf,
  keyBindingFor,
  overlayControlledId,
  MDY_TIMEPICKER_DEFAULT_FORMAT,
  MDY_TIMEPICKER_INITIAL_VIEW,
  type MdyTimepickerViewMode,
  timepickerPlaceholder,
  type MdyUiCommand,
  timepickerEntryText,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { observerFor, type MdyFieldHandle } from "@modyra/core";
import { buildTimeString, formatTimeAs, hourToAngle, minuteToAngle, parseAnyTime, pointerAngle, to24Hour, type MdyTimeFormat } from "@modyra/core/datetime";
import {
  acceptTimeField,
  createTimepickerFieldController,
  stepTimeField,
  subscribeController,
  timeFieldBounds,
  timepickerDialAria,
  timepickerDialKeyIntent,
  timepickerDialNumbers,
  timepickerDialRing,
  dialHandLength,
  timepickerDialGhost,
  timepickerDialPick,
  timepickerDialTolerance,
  timepickerDialUnavailableArcs,
  MDY_TIMEPICKER_INNER_RING,
  timepickerSelectedRing,
  timepickerPartSelector,
  timepickerTabOrder,
  timepickerTabTarget,
  timeStepsAt,
  stateClass,
  MDY_EVERY_TIME,
  type MdyTimeSteps,
  timepickerSelectedDialValue,
  type MdyTimeGranularity,
  type MdyTimepickerFieldController,
  type MdyTimepickerFieldIntent,
  type MdyTimepickerFieldState,
} from "@modyra/widgets";
import { applyWidgetCommands, bindOutsidePointer, closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";
import { MdyFieldElement, mdyIcon } from "../base.js";
import {
  MdyLitOverlayController,
  POPUP_ANCHOR_STYLE,
  renderOverlayPanel,
} from "./popup-styles.js";
// ─── Time picker ─────────────────────────────────────────────────────────────

type TimeField = "hour" | "minute";

/**
 * Time picker renderer — M3-style input with clock overlay.
 * Supports 12h/24h formats, a dial clock face with drag/click selection,
 * and a keyboard-input mode toggle.
 */
/** What the component shows before a handle reaches it — a clock on the hour, nothing confirmed. */
const RESTING: MdyTimepickerFieldState = Object.freeze({
  value: null,
  draft: { hour: 12, minute: 0, period: "AM" as const },
  open: false,
  focusedField: "hour",
  viewMode: MDY_TIMEPICKER_INITIAL_VIEW,
  format: "24h",
  granularity: undefined,
  animateHand: false,
  _handLength: 0,
  showUnavailable: false,
  invalid: false,
  disabled: false,
  interactivity: "enabled",
  readonly: false,
  required: false,
  touched: false,
  dirty: false,
  pending: false,
  entryText: null,
  entryUnreadable: false,
  display: "",
});

export class MdyTimepickerFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    format: { type: String },
    viewMode: { type: String },
    granularity: { type: Object },
    animateHand: { type: Boolean },
    showUnavailable: { type: Boolean },
    compact: { type: Boolean },
    _open: { state: true },
    _isDragging: { state: true },
    _dragAngle: { state: true },
    _handLength: { state: true },
  };
  declare placeholder: string;
  /** `"12h"` or `"24h"`. */
  declare format: MdyTimeFormat;
  /** `"dial"` or `"input"` — the view this picker opens in, and returns to when it closes. */
  declare viewMode: MdyTimepickerViewMode;
  /**
   * Which times this field offers. Absent offers every one.
   *
   * An object rather than an attribute string, because a granularity has windows in it. A host
   * setting it as a property is the ordinary Lit route; an attribute would need a parser here and a
   * second answer to what the engine already validates.
   */
  declare granularity: MdyTimeGranularity | undefined;
  /** Whether the hand moves rather than jumps. Off by default: today's behaviour exactly. */
  declare animateHand: boolean;
  /** Whether the dial shows which stretches of its ring carry no selectable time. Off by default. */
  declare showUnavailable: boolean;
  /** Compact period-toggle layout. */
  declare compact: boolean;
  declare _open: boolean;
  declare _isDragging: boolean;
  declare _dragAngle: number | null;
  /** The face's drawn hand length. State, so measuring it schedules the render that uses it. */
  declare _handLength: number;
  private unbindOutside?: () => void;
  protected override readonly widgetKind = "timepicker" as const;

  private fieldController?: MdyTimepickerFieldController;
  private unsubscribe?: () => void;

  /** What the controller is holding, or the resting shape before a handle exists. */
  private get view(): MdyTimepickerFieldState {
    return this.fieldController?.state() ?? RESTING;
  }

  /** Carries out what the controller asks of the DOM, which is the only half this renderer owns. */
  /**
   * Carries out what the controller asked for, whether it was asked or decided on its own.
   *
   * The handover has no call to return commands to: the controller's timer hands the hour to the
   * minute, and the `focus` that goes with it arrives here through `emit` instead.
   */
  private runDispatched(commands: readonly MdyUiCommand[]): void {
    const handle = this.field;
    if (!handle) return;
    applyWidgetCommands(this, commands, {
      open: () => this.overlay.open(),
      close: () => this.overlay.close(),
      disabled: handle.disabled(),
      control: ".mdy-timepicker__input",
      kind: "timepicker",
    });
  }

  private send(intent: MdyTimepickerFieldIntent): void {
    const handle = this.field;
    if (!this.fieldController || !handle) return;
    this.runDispatched(this.fieldController.dispatch(intent));
    // Said to the form rather than kept here: an entry this control could not read leaves the form
    // holding nothing while the person looks at text they believe was taken, and a message the
    // element painted on its own escaped every rule the form applies to its errors — it was still
    // announced after the field went out of play, and never marked the control as invalid.
    handle.reportEntry(this.view.entryUnreadable ? this.messages.entryUnreadable : null);
  }

  /**
   * What the box being edited is showing, while it is being edited.
   *
   * The binding cannot simply be skipped: `nothing` on a property binding still writes, setting
   * `value` to `undefined` and emptying the box under the caret — so a stepped or half-typed number
   * disappeared on the next render. The partial is held here and bound, which keeps the box and the
   * draft two views of one thing rather than two owners of one field.
   */
  private _editingText: string | null = null;
  private _dragRing: "outer" | "inner" = "outer";
  /** Whether `_dragRing` is an answer from this gesture or the default it starts at. */
  private _ringDecided = false;
  /** Which segment the user is inside, so a render does not write over what they are typing. */
  private editing: "hour" | "minute" | null = null;
  private _dragHandLength = 0;
  /** How far the pointer is from the centre — the ghost ends there. */
  private _dragReach = 0;

  /**
   * The faint hand under the pointer, when the pointer is not on the number that was chosen.
   *
   * Both members are the pointer's: it answers "what happens if I release now", while the real hand
   * answers "what is chosen". A picker offering every time never draws one.
   */
  private ghost(): { angle: number; ring: "outer" | "inner"; reach: number } | null {
    if (!this._isDragging || this._dragAngle === null) return null;
    const draft = this.fieldController?.state().draft;
    const steps = draft ? timeStepsAt(this.granularity, to24Hour(draft)) : MDY_EVERY_TIME;
    const pick = timepickerDialPick(this._dragAngle, this.dragField, this.format, this._dragRing, steps, draft ? timepickerSelectedDialValue(this.dragField, draft, this.format) : undefined);
    if (!pick) return null;
    return timepickerDialGhost(this._dragAngle, pick, {
      ring: this._dragRing,
      within: timepickerDialTolerance(this._dragRing, this._dragHandLength),
      pointerReach: this._dragReach,
      handLength: this._dragHandLength,
    });
  }
  private dragField: TimeField = "hour";

  private readonly overlay = new MdyLitOverlayController(
    this,
    // The control, not the whole field: anchoring on the host measures the label and the
    // supporting text too, which opened the popup a row low and a couple of hundred pixels off.
    () => this.querySelector<HTMLElement>(".mdy-input-wrapper") ?? this,
    {
    widthMode: "auto-content",
  });
  constructor() {
    super();
    this.placeholder = "";
    // Read from the contract, not written again: a default that differs between adapters means one
    // document renders a different clock in each of them. Set `format="12h"` for the other.
    this.format = MDY_TIMEPICKER_DEFAULT_FORMAT;
    this.viewMode = MDY_TIMEPICKER_INITIAL_VIEW;
    this.compact = false;
    this._open = false;
    this._isDragging = false;
    this._dragAngle = null;
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (handle && !this.fieldController) {
      this.fieldController = createTimepickerFieldController({
        widgetId: this.fieldId,
        handle,
        format: this.format,
        ...(this.granularity !== undefined && { granularity: this.granularity }),
        viewMode: this.viewMode,
        // Where the controller's own decisions land — the handover moves the face and the caret
        // together, or an arrow edits the field nobody is looking at.
        emit: (commands) => this.runDispatched(commands),
        // The reading is this element's; the judgement is the controller's, so a typed entry means
        // the same thing here as in every other renderer.
        parseEntry: (text) => {
          const parsed = parseAnyTime(text.trim().toUpperCase(), this.format);
          // Canonical, as the dial commits: a time is `HH:mm` wherever it is held, and the notation
          // on screen is this control's own.
          return parsed ? formatTimeAs(parsed, "24h") : null;
        },
      });
      this.unsubscribe = subscribeController(
        this.fieldController as never,
        observerFor(handle),
        () => this.requestUpdate(),
      );
    }
    this.unbindOutside = bindOutsidePointer(this, () => {
      const handle = this.field;
      if (handle) this.closePopup(handle);
    });
  }

  /** Closed when the keyboard moves on, which this kind's contract asks for. */
  protected override focusLeft(): void {
    if (!this._open) return;
    if (!MDY_WIDGET_CONTRACTS.timepicker.capabilities.dismissOnFocusOutside) return;
    const handle = this.field;
    if (handle) this.closePopup(handle);
  }

  override disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.fieldController = undefined;
    this.unbindOutside?.();
    this.overlay.close();
    super.disconnectedCallback();
    this.drag.stop();
  }

  private get effectivePlaceholder(): string {
    return this.placeholder || timepickerPlaceholder(this.format);
  }

  private openPopup(_handle: MdyTimepickerFieldElement["field"], event?: Event): void {
    void event;
    this.send({ type: "open" });
  }

  private closePopup(_handle: MdyFieldHandle<string | null>): void {
    if (!this._open) return;
    this.send({ type: "close", restoreFocus: true });
  }

  /** Confirming is the contract's: this kind's value contract says `confirm`, and it owns the draft. */
  private confirm(_handle: MdyFieldHandle<string | null>): void {
    this.send({ type: "confirm" });
  }

  /**
   * A time chosen on the dial, handed over whole.
   *
   * The dial builds a string because that is what a clock face reads back, and the controller reads
   * it in the picker's own format — taking it apart here read every string with the twelve-hour
   * parser, so a 24-hour face could not report an afternoon hour at all.
   */
  private onTimePicked(time: string): void {
    this.send({ type: "set-time", time });
  }

  /** The draft the controller is editing, which is what the dial draws. */
  /**
   * The hand, turned from the keyboard.
   *
   * The keys and what they land on are `timepickerDialKeyIntent`, which is the same rule the segment
   * arrows follow — written a second time here, the two answered differently the moment a field
   * offered only some of its values.
   */
  private onDialKeydown(event: KeyboardEvent): void {
    const field = this.view.focusedField;
    const parsed = this.parsed() ?? { hour: this.numericHour(), minute: this.numericMinute(), period: this.periodDisplay() };
    const moved = timepickerDialKeyIntent(
      event.key, field, this.format,
      timepickerSelectedDialValue(field, parsed, this.format),
      this.stepsNow(),
    );
    if (moved === null) return;
    event.preventDefault();
    // Kept on the face: the dialog answers Enter and Escape, and an arrow reaching its handler would
    // be read a second time.
    event.stopPropagation();
    this.send(moved.field === "hour"
      ? { type: "set-hour", hour: moved.value }
      : { type: "set-minute", minute: moved.value });
  }

  private parsed(): import("@modyra/core/datetime").ParsedTime | null {
    return this.fieldController?.state().draft ?? null;
  }

  private numericHour(): number {
    return this.parsed()?.hour ?? 12;
  }

  private numericMinute(): number {
    return this.parsed()?.minute ?? 0;
  }

  private hourDisplay(): string {
    if (this.format === "24h") {
      const p = this.parsed();
      return String(p ? to24Hour(p) : 0).padStart(2, "0");
    }
    return String(this.numericHour()).padStart(2, "0");
  }

  private minuteDisplay(): string {
    return String(this.numericMinute()).padStart(2, "0");
  }

  private periodDisplay(): "AM" | "PM" {
    return this.parsed()?.period ?? "AM";
  }

  /**
   * The real hand points at the value, including while a finger is moving.
   *
   * It used to follow the pointer, which on a face offering every time is the same thing. On one
   * that snaps it is not: the hand sat between two numbers and jumped on release, so the one thing
   * saying what is chosen spent the gesture saying something else. The pointer gets its own hand.
   */
  private handRotation(): number {
    const p = this.parsed();
    if (!p) return 0;
    return this.view.focusedField === "minute" ? minuteToAngle(p.minute) : hourToAngle(p.hour);
  }



  /**
   * Arrow keys step the segment, wrapping at the range's ends.
   *
   * The bounds come from `timeFieldBounds`, not from literals beside each input — the hour's two
   * variants are easy to keep straight and the minute's 0–59 is the one that gets lost. A step also
   * pulls an out-of-range segment back inside, because stepping is how a user leaves a bad value.
   */
  /**
   * The steps in force for the time being edited.
   *
   * Read per interaction, not captured: a windowed granularity's minute step depends on the hour the
   * draft is on, so a step resolved once would answer for the hour the popup opened at.
   */
  private stepsNow(): MdyTimeSteps {
    const draft = this.fieldController?.state().draft;
    return draft ? timeStepsAt(this.granularity, to24Hour(draft)) : MDY_EVERY_TIME;
  }

  private stepSegment(event: KeyboardEvent, field: "hour" | "minute"): boolean {
    const delta = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (delta === 0) return false;
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const steps = this.stepsNow();
    const entry = acceptTimeField(field, this.format, input.value, steps);
    const from = entry.type === "accepted" ? entry.value : timeFieldBounds(field, this.format, steps).min;
    const next = stepTimeField(field, this.format, from, delta, steps);
    // An arrow is not typing: it names a whole value, so the box shows the canonical form of it and
    // the field never enters the half-typed state. Reported as the value it is rather than as text
    // through the input path, which left the box holding `4` where the field writes `04`.
    input.value = timepickerEntryText(next);
    input.removeAttribute("aria-invalid");
    this.editing = null;
    this._editingText = null;
    this.send(field === "hour" ? { type: "set-hour", hour: next } : { type: "set-minute", minute: next });
    return true;
  }

  /** Mark a segment whose contents are outside the range it advertises. */
  private markSegment(input: HTMLInputElement, field: "hour" | "minute"): void {
    const steps = this.stepsNow();
    const bounds = timeFieldBounds(field, this.format, steps);
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    // The native attribute for exactly this, so the platform's own spinner offers what the field
    // offers rather than every value between.
    input.step = String(bounds.step);
    // An empty box is being cleared, not asserted.
    const bad = input.value.trim().length > 0
      && acceptTimeField(field, this.format, input.value, steps).type === "rejected";
    if (bad) {
      input.setAttribute("aria-invalid", "true");
      input.title = `${bounds.min}–${bounds.max}`;
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("title");
    }
  }

  /**
   * What a person typed into a box, reported as they typed it.
   *
   * This element used to read the box itself, refuse anything it could not take, and write the
   * canonical value straight back — with `.value` bound to the draft, every keystroke triggered a
   * render that overwrote what had just been typed. Backspacing an hour from `09` produced `12`.
   *
   * The contract decides what a half-typed number is; this reports the text and leaves the box
   * alone until the person leaves it.
   */
  private onSegmentInput(event: Event, field: "hour" | "minute"): void {
    const target = event.target as HTMLInputElement;
    this.editing = field;
    this._editingText = target.value;
    this.markSegment(target, field);
    this.send({ type: "focus-field", field });
    this.send({ type: "type-segment", field, text: target.value });
  }

  /** What the box settles to when it stops being edited: the canonical form of what the draft holds. */
  private onSegmentBlur(): void {
    // Only the box settling. Leaving a segment is not leaving the *field* — the control owns that,
    // and marking the field touched here made Escape leave a picker somebody had never answered
    // looking as though they had.
    this.editing = null;
    this._editingText = null;
    this.requestUpdate();
  }

  private togglePeriod(period: "AM" | "PM"): void {
    if (this.format !== "12h") return;
    const p = this.parsed();
    this.onTimePicked(buildTimeString(p?.hour ?? 12, p?.minute ?? 0, period));
  }

  private setViewMode(mode: MdyTimepickerViewMode): void {
    this.send({ type: "set-view-mode", mode });
  }

  // ── Drag interaction ────────────────────────────────────────────────────────

  /**
   * The gesture's plumbing, which is not this renderer's to write.
   *
   * A drag cannot be tracked on the element it starts on — the pointer leaves the dial at once — so
   * it belongs to the document, and every renderer that binds it there binds the same four
   * listeners. What the angle *becomes* stays here.
   */
  private readonly drag = createPointerDrag({
    onMove: (_point: unknown, event: MouseEvent | TouchEvent) => this.onDragMove(event),
    onEnd: () => this.onDragEnd(),
  });

  private onDragStart(event: MouseEvent | TouchEvent): void {
    if (this.view.viewMode !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.dragField = this.view.focusedField;
    this._isDragging = true;
    this.drag.start();
    this.updateAngle(event);
    // A press is already a choice. Without this a tap sets nothing — on a mouse the pointer jitters
    // and a move arrives to cover it, but a finger that lands and lifts produces no movement at all,
    // which is the entire interaction on a phone.
    this.sendPick();
  }

  /** Where the pointer is, as the position it is. Shared so a press and a drag cannot differ. */
  /**
   * Tab walks the popup's own controls instead of leaving it.
   *
   * The popup holds a confirm button, and a Tab that dismissed left it unreachable — so the widget's
   * only way to commit was a pointer. The order is the contract's rather than DOM order, because the
   * three renderers do not build this dialog in the same order; it wraps, and `Escape` is the exit.
   */
  private moveByTab(event: KeyboardEvent): void {
    if (!this._open) return;
    event.preventDefault();
    // The part's *first* class names it; `partClass` answers with every class the part carries, and
    // a part with two of them matched nothing when asked as a single token.
    const active = this.querySelector(":focus");
    const from = timepickerTabOrder(this.format)
      .find((part) => active?.matches(timepickerPartSelector(part) ?? "\0"));
    const next = timepickerTabTarget(from ?? "", this.format, event.shiftKey ? -1 : 1);
    if (next === "hourControl" || next === "minuteControl") {
      this.send({ type: "focus-field", field: next === "hourControl" ? "hour" : "minute" });
      return;
    }
    this.querySelector<HTMLElement>(timepickerPartSelector(next) ?? "\0")?.focus();
  }

  private sendPick(phase?: "move" | "end"): void {
    const angle = this._dragAngle;
    if (angle === null) return;
    // The position, not a time read off it: what this control knows is where the pointer is, and
    // what that means — which of the two hours in this direction — is the controller's to say.
    this.send({ type: "set-from-angle", field: this.dragField, angle, ring: this._dragRing, ...(phase && { phase }) });
  }

  private onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this._isDragging || this.view.viewMode !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.updateAngle(event);
    this.sendPick("move");
  }

  private onDragEnd(): void {
    if (!this._isDragging) return;
    this.drag.stop();
    this.sendPick("end");
    this._isDragging = false;
    this._dragAngle = null;
    // The gesture is over: the next one decides from where it lands.
    this._ringDecided = false;
  }

  /**
   * The face's own hand length, measured from the drawn element.
   *
   * The dimmed stretches are angles at a radius, so unlike the ghost they need this before anybody
   * has touched the dial — a drag is the only thing that used to measure it.
   */
  /**
   * Measures the face after it has been drawn, and renders again if the answer moved.
   *
   * The arcs are angles at a radius, and the render that *creates* the dial cannot measure it — the
   * face does not exist yet, so the length read as zero and `timepickerDialUnavailableArcs` answered
   * `[]`, which is also the correct answer for a face with nothing to dim. Nothing scheduled a second
   * pass, so the dimming was permanently absent and every unit test agreed with it.
   */
  protected override updated(changed: Map<string, unknown>): void {
    super.updated?.(changed);
    const measured = this.measuredHandLength();
    if (measured > 0 && measured !== this._handLength) this._handLength = measured;
  }

  /** The rule is the contract's: measuring this went wrong twice, both times in three copies. */
  private measuredHandLength(): number {
    const face = this.querySelector<HTMLElement>(".mdy-timepicker-dial__face");
    return face ? dialHandLength(face) : this._dragHandLength;
  }



  private updateAngle(event: MouseEvent | TouchEvent): void {
    const el = this.querySelector<HTMLElement>(".mdy-timepicker-dial__face");
    if (!el) return;
    const coords = dragPointOf(event);
    if (!coords) return;
    const face = el.getBoundingClientRect();
    this._dragAngle = pointerAngle(face, coords.clientX, coords.clientY);
    // A 24-hour face draws `00` and 13–23 on an inner ring at the same twelve positions, so `3` and
    // `15` lie in exactly the same direction and the angle alone cannot say which is under the
    // pointer. Which ring the pointer is in is decided against the hand's drawn length, so the hit
    // cannot drift from the paint — and the measurement is the contract's, because reading a custom
    // property that resolves to a `calc()` answers `NaN` and falls through to the face's radius,
    // which is a quarter longer than the hand and puts every press inside the inner ring.
    const handLength = this.measuredHandLength();
    const dx = coords.clientX - (face.left + face.width / 2);
    const dy = coords.clientY - (face.top + face.height / 2);
    this._dragReach = Math.sqrt(dx * dx + dy * dy);
    this._dragHandLength = handLength;
    // The ring it last answered goes back in: from position alone, a finger resting on the edge
    // changed the ring four times in a 6px wander, and the edge is where a finger naturally rests.
    this._dragRing = timepickerDialRing(face, coords.clientX, coords.clientY, this.format, handLength, this.view.focusedField, this._ringDecided ? this._dragRing : undefined);
    this._ringDecided = true;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private renderHeader(): unknown {
    const hourActive = this.view.focusedField === "hour";
    const minuteActive = this.view.focusedField === "minute";
    return html`
      <div class="mdy-timepicker-header">
        <div class="mdy-timepicker-fields">
          <div class="${this.partClass("hour")} ${hourActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="${this.partClass("hourControl")} ${this.view.readonly ? stateClass(this.partClass("hourControl"), "readonly") : ""}"
              ${mdyPart(this.segmentPart("hourControl"))}
              .value=${this.editing === "hour" ? this._editingText ?? this.hourDisplay() : this.hourDisplay()}
              ?readonly=${this.view.readonly}
              aria-label=${this.messages.timepickerHourLabel}
              @input=${(e: Event) => this.onSegmentInput(e, "hour")}
              @blur=${() => this.onSegmentBlur()}
              @focus=${() => this.send({ type: "focus-field", field: "hour" })}
              @click=${() => {
                if (this.view.viewMode === "dial") this.send({ type: "focus-field", field: "hour" });
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (this.stepSegment(e, "hour")) return;
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
              }}
              @paste=${(e: ClipboardEvent) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (!/^\d+$/.test(text)) e.preventDefault();
              }}
            />
            <span class="mdy-timepicker-segment-label">Hour</span>
          </div>
          <span class="mdy-timepicker-separator">:</span>
          <div class="${this.partClass("minute")} ${minuteActive ? "mdy-timepicker-segment--active" : ""}">
            <input
              type="number"
              class="${this.partClass("minuteControl")} ${this.view.readonly ? stateClass(this.partClass("minuteControl"), "readonly") : ""}"
              ${mdyPart(this.segmentPart("minuteControl"))}
              .value=${this.editing === "minute" ? this._editingText ?? this.minuteDisplay() : this.minuteDisplay()}
              ?readonly=${this.view.readonly}
              aria-label=${this.messages.timepickerMinuteLabel}
              @input=${(e: Event) => this.onSegmentInput(e, "minute")}
              @blur=${() => this.onSegmentBlur()}
              @focus=${() => this.send({ type: "focus-field", field: "minute" })}
              @click=${() => {
                if (this.view.viewMode === "dial") this.send({ type: "focus-field", field: "minute" });
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (this.stepSegment(e, "minute")) return;
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
              }}
              @paste=${(e: ClipboardEvent) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (!/^\d+$/.test(text)) e.preventDefault();
              }}
            />
            <span class="mdy-timepicker-segment-label">Minute</span>
          </div>
        </div>
        ${this.format === "12h"
          ? html`
              <div
                class="mdy-timepicker-period-toggle ${this.compact
                  ? "mdy-timepicker-period-toggle--compact"
                  : ""}"
              >
                <button
                  type="button"
                  class="${this.partClass("periodOption")} ${this.periodDisplay() === "AM" ? "mdy-timepicker-period-btn--selected" : ""}"
                  @click=${() => this.togglePeriod("AM")}
                >
                  AM
                </button>
                <button
                  type="button"
                  class="${this.partClass("periodOption")} ${this.periodDisplay() === "PM" ? "mdy-timepicker-period-btn--selected" : ""}"
                  @click=${() => this.togglePeriod("PM")}
                >
                  PM
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderDial(): unknown {
    const field = this.view.focusedField;
    // Which numbers the face carries, where each one sits and which is selected are the contract's:
    // minute 0 belongs at the top of the face and a draft of 07 marks the 05 nearest it, and those
    // are exactly the details three renderers would each get slightly differently.
    // The face the format has: 1–12 with a period beside them, or 0–23 with none.
    const numbers = timepickerDialNumbers(field, this.format, this.stepsNow());
    const parsed = this.parsed() ?? { hour: this.numericHour(), minute: this.numericMinute(), period: this.periodDisplay() };
    // In the units the face shows: on a 24-hour face this marks 14, not the 2 the draft holds.
    const selected = timepickerSelectedDialValue(field, parsed, this.format);
    // A dial is a slider around a circle, and only the three values make a slider mean anything.
    const dialAria = timepickerDialAria(field, this.format, selected);
    return html`
      <div class="mdy-timepicker-dial-variant">
        <div class="${this.partClass("clock")} ${this.animateHand ? stateClass(this.partClass("clock"), "animated") : ""}">
          <div
            class="mdy-timepicker-dial__face"
            tabindex="0"
            role=${dialAria.role}
            aria-valuemin=${dialAria.valueMin}
            aria-valuemax=${dialAria.valueMax}
            aria-valuenow=${dialAria.valueNow}
            aria-valuetext=${dialAria.valueText}
            aria-label=${field === "hour" ? this.messages.timepickerHourLabel : this.messages.timepickerMinuteLabel}
            @keydown=${(e: KeyboardEvent) => this.onDialKeydown(e)}
            @mousedown=${this.onDragStart}
            @touchstart=${this.onDragStart}
          >
            <!-- The hand reaches only as far as the ring it points into: a 24-hour face puts two
                 hours at one direction, so one length leaves the two selections identical. -->
            <!-- Which stretches of the ring offer nothing, behind everything else on the face. -->
            ${this.showUnavailable
              ? html`<div class="mdy-timepicker-dial__unavailable-layer" aria-hidden="true">
                  ${(this.showUnavailable ? timepickerDialUnavailableArcs(field, this.format, this.stepsNow(), this.measuredHandLength()) : []).map((arc) => html`<div
                    class="mdy-timepicker-dial__unavailable"
                    style="--tp-arc-from: ${arc.from}deg; --tp-arc-span: ${arc.span}deg${arc.ring === "inner"
                      ? `; scale: ${MDY_TIMEPICKER_INNER_RING}`
                      : ""}"
                  ></div>`)}
                </div>`
              : nothing}
            <div
              class="${this.partClass("dialHand")} ${timepickerSelectedRing(field, parsed, this.format) === "inner"
                ? stateClass(this.partClass("dialHand"), "inner")
                : ""}"
              style="transform: rotate(${this.handRotation()}deg)"
            ></div>
            <!-- Where the pointer is, when that is not where the value went. Drawn only then. -->
            ${(() => {
              const under = this.ghost();
              return under
                ? html`<div
                    class="${this.partClass("dialHand")} ${stateClass(this.partClass("dialHand"), "ghost")}"
                    style="transform: rotate(${under.angle}deg); --tp-ghost-reach: ${under.reach}"
                    aria-hidden="true"
                  ></div>`
                : nothing;
            })()}
            ${numbers.map(
              (number) => html`
                <div
                  class="mdy-timepicker-dial__number ${number.value === selected
                    ? "mdy-timepicker-dial__number--selected"
                    : ""} ${number.ring === "inner" ? "mdy-timepicker-dial__number--inner" : ""}"
                  style="--index: ${number.index}"
                >
                  ${number.label}
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * What the popup announces itself as, from the projection.
   *
   * The role, the name and `aria-modal` belong to the element the opener names — one element the
   * page can point at and walk into. Split across two, `aria-controls` resolved to a wrapper with no
   * role while the thing carrying the role had nothing pointing at it.
   */
  private dialogPart(): MdyPartContract {
    const dialog = projectTimepickerFieldA11y(this.view, this.field?.errors() ?? [], {
      widgetId: this.fieldId,
    }).dialog;
    // The id stays the one the opener names: this is the popup part as well as the dialog, and two
    // ids on one element is not a thing an element can have.
    return { ...dialog, id: overlayControlledId("timepicker", this.fieldId) ?? dialog.id };
  }

  /**
   * What one segment announces: the spinbutton role, its bounds and the number it holds.
   *
   * From the projection rather than written here, because the bounds are the clock's — a 24-hour
   * face whose reader is told the maximum is 12 states one of two ranges falsely, and a reader has
   * no way to see which.
   */
  private segmentPart(part: "hourControl" | "minuteControl"): MdyPartContract {
    return projectTimepickerFieldA11y(this.view, this.field?.errors() ?? [], {
      widgetId: this.fieldId,
    })[part];
  }

  private renderPopup(handle: MdyFieldHandle<string | null>): unknown {
    return html`
      <div
        class="mdy-timepicker-container ${this.view.viewMode === "dial" ? "mdy-timepicker--dial" : ""}"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            this.closePopup(handle);
            return;
          }
          // Enter commits the draft, which is what the table says a dialog's Enter does. A focused
          // button answers it for itself — the platform turns Enter there into a click, and
          // cancelling would otherwise also confirm — so this speaks for the rest of the dialog,
          // which is where somebody setting the time from the keyboard stands.
          if (
            e.key === "Enter"
            && !e.defaultPrevented
            && (e.target as Element | null)?.closest?.("button") == null
            && keyBindingFor("timepicker", "Enter", true)?.intent === "commit"
          ) {
            e.preventDefault();
            // Kept inside the dialog: the element's own handler opens the picker on Enter, and the
            // same press that committed would arrive there with the popup already closed and open it
            // again.
            e.stopPropagation();
            this.confirm(handle);
            return;
          }
          if (e.key === "Tab") this.moveByTab(e);
        }}
      >
        <div class="mdy-timepicker-content">
          ${this.renderHeader()}
          ${this.view.viewMode === "dial" ? this.renderDial() : nothing}
        </div>
        <div class="mdy-timepicker-actions">
          <button
            type="button"
            class="mdy-timepicker-mode-toggle"
            aria-label=${this.view.viewMode === "input" ? "Switch to dial" : "Switch to input"}
            @click=${() => this.setViewMode(this.view.viewMode === "input" ? "dial" : "input")}
          >
            ${this.view.viewMode === "input"
              ? html`<svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"
                    fill="currentColor"
                  />
                </svg>`
              : html`<svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm10 0H7v-2h10v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 6h-2v-2h2v2z"
                    fill="currentColor"
                  />
                </svg>`}
          </button>
          <div class="mdy-timepicker-spacer"></div>
          <button
            type="button"
            class="mdy-timepicker-action-btn"
            @click=${() => this.closePopup(handle)}
          >
            Cancel
          </button>
          <button
            type="button"
            class="mdy-timepicker-action-btn mdy-timepicker-action-btn--confirm"
            @click=${() => this.confirm(handle)}
          >
            OK
          </button>
        </div>
      </div>
    `;
  }

  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    this.classList.toggle("mdy-renderer--open", this._open);
    return html`
      <div
        class="mdy-timepicker"
        @keydown=${(e: KeyboardEvent) => {
          // The popup handles Escape inside itself, but it does not take focus when it opens — so
          // from the control, which is where the keyboard actually is, the picker could be opened
          // and not dismissed.
          if (e.key === "Escape" && this._open) {
            e.preventDefault();
            this.closePopup(handle);
          }
          // And the way in, from the table the contract already publishes rather than from a key
          // written here. The control is this kind's declared opener and the toggle beside it is
          // not a tab stop, so a control that answers no key is a picker no keyboard can open —
          // the value can still be typed, by someone who knows the format the field wants.
          if (!this._open && keyBindingFor("timepicker", e.key, false)?.intent === "open") {
            e.preventDefault();
            this.openPopup(handle, e);
          }
        }}
      >
        <div class="${this.wrapperClass(handle)}">
          <input
            id=${this.fieldId}
            type="text"
            class="mdy-timepicker__input"
            placeholder=${this.effectivePlaceholder}
            .value=${this.view.display}
            ?disabled=${handle.disabled()}
            ?readonly=${handle.readonly()}
            role="combobox"
            aria-haspopup=${this.popupPromise}
            aria-expanded=${this._open ? "true" : "false"}
            aria-controls=${this._open ? overlayControlledId("timepicker", this.fieldId) ?? nothing : nothing}
            ${mdyPart(this.controlPart(handle))}
            autocomplete="off"
            @change=${(e: Event) => {
              // The text goes over as text. Parsing here and writing the value back was the erasure:
              // `14:30` in a 12-hour control left nothing on screen to correct.
              this.send({ type: "type", text: (e.target as HTMLInputElement).value });
            }}
            @blur=${() => handle.markAsTouched()}
            @click=${() => { if (!this._open) this.send({ type: "open" }); }}
            @keydown=${(e: KeyboardEvent) => {
              // The keys this kind declares, read from the table rather than listed here. The
              // contract names the *control* as the opener, and a control that only opens under a
              // pointer is one a keyboard cannot reach the clock through at all.
              if (this._open || keyBindingFor("timepicker", e.key, false)?.intent !== "open") return;
              e.preventDefault();
              this.send({ type: "open" });
            }}
          />
          <div class="mdy-input-suffix">
            <button
              type="button"
              class="mdy-timepicker__toggle"
              ?disabled=${handle.disabled()}
              aria-label=${this.messages.timepickerOpenLabel}
              aria-expanded=${this._open ? "true" : "false"}
              tabindex="-1"
              @click=${(e: Event) => (this._open ? this.closePopup(handle) : this.openPopup(handle, e))}
            >
              ${mdyIcon("CLOCK", "mdy-timepicker__icon")}
            </button>
          </div>
        </div>
        ${renderOverlayPanel(
          // Wrapped in the contract's `popup` part: every overlay in the catalog is the same
          // container, and only its content differs. Without it these two pickers were the
          // only popups drawn straight into the panel, with a container of their own.
          html`<div
            class="${this.popupClass(this.overlay.state.position)} mdy-overlay"
            id=${overlayControlledId("timepicker", this.fieldId) ?? nothing}
            ${mdyPart(this.dialogPart())}
          >${this.renderPopup(handle)}</div>`,
          this._open,
          {
            position: this.overlay.state.position,
          alignment: this.overlay.state.alignment,
          modal: this.overlay.state.position === "overlay",
          panelStyle: this.overlay.state.panelStyle,
        })}
      </div>
    `;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    return html`<div style=${POPUP_ANCHOR_STYLE}>${super.render()}</div>`;
  }
}
