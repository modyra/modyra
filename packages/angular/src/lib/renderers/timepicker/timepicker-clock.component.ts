import { handLengthOf } from "./hand-length";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import {
  formatTime,
  hourToAngle,
  MdyTimeFormat,
  minuteToAngle,
  parseTime,
  pointerAngle,
  to24Hour,
} from "@modyra/core/datetime";
import {
  createPointerDrag,
  dragPointOf,
  timeClockTransition,
  timepickerDialAria,
  timepickerDialKeyIntent,
  timepickerDialNumbers,
  timepickerDialRing,
  timepickerSelectedRing,
  timeStepsAt,
  MDY_EVERY_TIME,
  type MdyTimeGranularity,
  timepickerSelectedDialValue,
} from "@modyra/widgets";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyTimepickerHeaderComponent } from "./timepicker-header.component";

@Component({
  selector: "mdy-timepicker-clock",
  standalone: true,
  imports: [MdyTimepickerHeaderComponent],
  templateUrl: "./timepicker-clock.component.html",
  styleUrls: ["./timepicker-renderer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyTimepickerClockComponent {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly value = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  readonly format = input<MdyTimeFormat>("12h");
  /** Which times the field offers. Absent offers every one. */
  readonly granularity = input<MdyTimeGranularity | undefined>(undefined);

  /**
   * The steps in force for the time on screen.
   *
   * Resolved once here and handed down, because a windowed granularity's minute step depends on the
   * hour the draft is on — and because two components resolving it separately is two answers to one
   * question.
   */
  protected readonly steps = computed(() => {
    const parsed = this.parsed();
    return parsed ? timeStepsAt(this.granularity(), to24Hour(parsed)) : MDY_EVERY_TIME;
  });
  /**
   * Whether the picker is showing. The clock is always in the DOM — the panel projects it rather
   * than creating it — so this is the only way it can know it has just been opened, and the dial
   * needs to know in order to take focus.
   */
  readonly open = input<boolean>(false);
  readonly timePicked = output<string>();
  /**
   * A position on the face, rather than a time read off it.
   *
   * The dial used to emit a formatted string that the renderer parsed back — with the 12-hour
   * parser, whatever the format — so every pointer landed on the outer ring by construction and a
   * 24-hour picker could only ever name twelve of the twenty-four numbers it draws. What this
   * control knows is where the pointer is; what that means is the controller's to say.
   */
  readonly dialPicked = output<{ readonly field: "hour" | "minute"; readonly angle: number; readonly ring: "outer" | "inner" }>();
  readonly cancelClicked = output<void>();
  readonly confirmClicked = output<void>();

  // The clock is the picker: `MdyTimepickerFieldState.viewMode` in @modyra/widgets says a timepicker
  // opens on it, and the mode toggle is how a user asks for the number fields instead.
  protected readonly viewMode = signal<"input" | "dial">("dial");
  protected readonly focusedField = signal<"hour" | "minute">("hour");
  protected readonly isDragging = signal(false);
  protected readonly dragAngle = signal<number | null>(null);

  private dragField: "hour" | "minute" = "hour";
  /**
   * Which ring of the face the pointer is over.
   *
   * A 24-hour face draws `00` and 13–23 on an inner ring at the same twelve positions, so `3` and
   * `15` lie in exactly the same direction: the angle alone cannot say which one a finger is on.
   * `timepickerDialRing` answers it from the face's own geometry, which is where the question
   * belongs — a renderer working out which ring it drew is a renderer that can disagree with its
   * own drawing.
   */
  private dragRing: "outer" | "inner" = "outer";

  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly dialFaceRef = viewChild<ElementRef<HTMLElement>>("dialFace");

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.switchTimer !== null) clearTimeout(this.switchTimer);
      this.drag.stop();
    });
    // Opening is when the dial should take focus, and the clock is never destroyed — the panel
    // projects it rather than creating it — so an effect on `open` is what "it has just been
    // shown" looks like here.
    effect(() => {
      if (this.open() && this.viewMode() === "dial") this.focusDial();
    });
  }

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

  private scheduleMinuteSwitch(delayMs: number): void {
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      this.focusedField.set("minute");
    }, delayMs);
  }

  protected readonly parsed = computed(() => parseTime(this.value()));

  protected readonly numericHour = computed(() => {
    const p = this.parsed();
    return p ? p.hour : 12;
  });

  protected readonly numericMinute = computed(() => {
    const p = this.parsed();
    return p ? p.minute : 0;
  });

  protected readonly hourDisplay = computed(() => {
    if (this.format() === "24h") {
      const p = this.parsed();
      const hour24 = p ? to24Hour(p) : 0;
      return String(hour24).padStart(2, "0");
    }
    return String(this.numericHour()).padStart(2, "0");
  });

  protected readonly minuteDisplay = computed(() =>
    String(this.numericMinute()).padStart(2, "0"),
  );

  protected readonly periodDisplay = computed(() => {
    const p = this.parsed();
    return p ? p.period : "AM";
  });

  protected readonly timeString = computed(() => {
    const p = this.parsed();
    return p ? formatTime(p) : "00:00 AM";
  });

  /** The numbers on the face, and which one is selected — the contract's, not this component's. */
  protected readonly dialNumbers = computed(() => timepickerDialNumbers(this.focusedField(), this.format(), this.steps()));

  /**
   * The number the hand is on, in the units the face shows: 0–23 on a 24-hour face, 1–12 on a
   * twelve-hour one. The draft is held as 12h with a period whatever the format, so this is the one
   * place that converts — the keyboard and the announced value both read it.
   */
  protected readonly faceValue = computed(() =>
    timepickerSelectedDialValue(this.focusedField(), {
      hour: this.numericHour(), minute: this.numericMinute(), period: this.periodDisplay(),
    }, this.format()),
  );

  /** What a screen reader is told the hand is pointing at — the contract's, with the format's bounds. */
  protected readonly dialAria = computed(() =>
    timepickerDialAria(this.focusedField(), this.format(), this.faceValue()),
  );

  /** Which ring the hand points into, from the contract's own predicate. */
  protected readonly handRing = computed(() => {
    if (this.isDragging() && this.dragRing !== null) return this.dragRing;
    const parsed = this.parsed();
    return parsed ? timepickerSelectedRing(this.focusedField(), parsed, this.format()) : "outer";
  });

  protected readonly handRotation = computed(() => {
    if (this.isDragging() && this.dragAngle() !== null) {
      return this.dragAngle()!;
    }
    const p = this.parsed();
    if (!p) return 0;
    return this.focusedField() === "minute"
      ? minuteToAngle(p.minute)
      : hourToAngle(p.hour);
  });

  protected onHourInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const next = timeClockTransition(this.value(), {
      type: "hour", value: Number.parseInt(target.value, 10), format: this.format(),
    });
    if (next === null) { target.value = this.hourDisplay(); return; }
    this.focusedField.set("hour");
    this.timePicked.emit(next);
  }

  /**
   * An arrow key on a segment, which reports the value it asks for rather than writing it.
   *
   * The segment's input has an owner — the template binds `[value]` — and a handler that also
   * assigned it gave one value two owners: the bound value was written back over the stepped one
   * before the frame painted, so the arrows appeared to do nothing. The step travels the same way a
   * typed character does, and the DOM follows the model rather than racing it.
   */
  protected onHourStep(value: number): void {
    const next = timeClockTransition(this.value(), { type: "hour", value, format: this.format() });
    if (next === null) return;
    this.focusedField.set("hour");
    this.timePicked.emit(next);
  }

  protected onMinuteStep(value: number): void {
    const next = timeClockTransition(this.value(), { type: "minute", value });
    if (next === null) return;
    this.focusedField.set("minute");
    this.timePicked.emit(next);
  }

  protected onMinuteInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const next = timeClockTransition(this.value(), {
      type: "minute", value: target.value === "" ? 0 : Number.parseInt(target.value, 10),
    });
    if (next === null) { target.value = this.minuteDisplay(); return; }
    this.focusedField.set("minute");
    this.timePicked.emit(next);
  }

  protected togglePeriod(period: "AM" | "PM"): void {
    if (this.disabled()) return;
    const next = timeClockTransition(this.value(), { type: "period", value: period });
    if (next !== null) this.timePicked.emit(next);
  }

  protected setViewMode(mode: "input" | "dial"): void {
    this.viewMode.set(mode);
    if (mode === "dial") this.focusDial();
  }

  /**
   * Puts focus on the face, so the arrows have somewhere to arrive.
   *
   * The face has been focusable since it became a slider, and nothing ever focused it: opening the
   * picker left focus on the toggle, outside the popup, so the first arrow went to the page. A
   * control you can only reach by tabbing past Cancel and Confirm, with nothing saying so, is a
   * control most people will never find.
   */
  private focusDial(): void {
    const face = this.dialFaceRef()?.nativeElement;
    if (!face) return;
    // After the view that renders it, not during: on the opening pass the face may not exist yet.
    queueMicrotask(() => this.dialFaceRef()?.nativeElement?.focus());
  }

  protected onDialNumberClick(value: number): void {
    if (this.disabled()) return;
    const field = this.focusedField();
    const next = timeClockTransition(this.value(),
      field === "hour"
        // The face's own format: on a 24-hour face this number is 0–23, and calling it 12h turned
        // every afternoon hour into a morning one.
        ? { type: "hour", value, format: this.format() }
        : { type: "minute", value },
    );
    if (next !== null) this.timePicked.emit(next);
    if (field === "hour") this.scheduleMinuteSwitch(200);
  }

  /**
   * The arrows on the face.
   *
   * Which key does what, and what it may produce, is `timepickerDialKeyIntent` — so the hours a
   * keyboard can reach are the hours the face shows, and neither can drift from the other. This
   * component decides nothing: it reads the key, applies the answer, and stops the page scrolling.
   */
  /**
   * The arrows work while the clock is showing, wherever focus is inside it.
   *
   * Focusing the face on open is not enough on its own: the moment a user tabs to Confirm to commit,
   * the arrows would go dead again — and "the clock has a keyboard" is not "the dial has a keyboard
   * as long as you do not move". A keydown anywhere in the clock turns the hand, except from a text
   * input: the hour and minute boxes in the header are `<input>`s with their own arrow handling, and
   * taking their keys would make them impossible to correct.
   */
  protected onClockKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    this.onDialKeydown(event);
  }

  protected onDialKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.viewMode() !== "dial") return;
    const field = this.focusedField();
    const intent = timepickerDialKeyIntent(event.key, field, this.format(), this.faceValue());
    if (!intent) return;
    event.preventDefault();
    const next = timeClockTransition(this.value(),
      intent.field === "hour"
        ? { type: "hour", value: intent.value, format: this.format() }
        : { type: "minute", value: intent.value },
    );
    if (next !== null) this.timePicked.emit(next);
  }

  protected onDragStart(event: MouseEvent | TouchEvent): void {
    if (this.disabled() || this.viewMode() !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.dragField = this.focusedField();
    this.isDragging.set(true);
    this.drag.start();
    this.updateAngle(event);
  }

  protected onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging() || this.viewMode() !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.updateAngle(event);

    const angle = this.dragAngle();
    if (angle === null) return;

    this.dialPicked.emit({ field: this.dragField, angle, ring: this.dragRing });
  }

  protected onDragEnd(): void {
    if (!this.isDragging()) return;

    const angle = this.dragAngle();
    if (angle !== null) {
      if (this.dragField === "hour") this.scheduleMinuteSwitch(300);
      this.dialPicked.emit({ field: this.dragField, angle, ring: this.dragRing });
    }

    this.isDragging.set(false);
    this.dragAngle.set(null);
  }

  private updateAngle(event: MouseEvent | TouchEvent): void {
    const el = this.dialFaceRef()?.nativeElement;
    if (!el) return;
    const coords = dragPointOf(event);
    if (!coords) return;
    const face = el.getBoundingClientRect();
    this.dragAngle.set(pointerAngle(face, coords.clientX, coords.clientY));
    this.dragRing = timepickerDialRing(face, coords.clientX, coords.clientY, this.format(), handLengthOf(el, face));
  }
}
