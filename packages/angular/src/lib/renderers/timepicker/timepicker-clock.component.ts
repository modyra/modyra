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
  getPointerCoords,
  hourToAngle,
  MdyTimeFormat,
  minuteToAngle,
  parseTime,
  pointerAngle,
  to24Hour,
} from "@modyra/core/datetime";
import { timeClockTransition, timepickerDialAria, timepickerDialKeyIntent, timepickerDialNumbers, timepickerSelectedDialValue } from "@modyra/widgets";
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
  /**
   * Whether the picker is showing. The clock is always in the DOM — the panel projects it rather
   * than creating it — so this is the only way it can know it has just been opened, and the dial
   * needs to know in order to take focus.
   */
  readonly open = input<boolean>(false);
  readonly timePicked = output<string>();
  readonly cancelClicked = output<void>();
  readonly confirmClicked = output<void>();

  // The clock is the picker: `MdyTimepickerFieldState.viewMode` in @modyra/widgets says a timepicker
  // opens on it, and the mode toggle is how a user asks for the number fields instead.
  protected readonly viewMode = signal<"input" | "dial">("dial");
  protected readonly focusedField = signal<"hour" | "minute">("hour");
  protected readonly isDragging = signal(false);
  protected readonly dragAngle = signal<number | null>(null);

  private dragField: "hour" | "minute" = "hour";

  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly dialFaceRef = viewChild<ElementRef<HTMLElement>>("dialFace");

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.switchTimer !== null) clearTimeout(this.switchTimer);
      this.teardownDragListeners();
    });
    // Opening is when the dial should take focus, and the clock is never destroyed — the panel
    // projects it rather than creating it — so an effect on `open` is what "it has just been
    // shown" looks like here.
    effect(() => {
      if (this.open() && this.viewMode() === "dial") this.focusDial();
    });
  }

  private readonly handleDocMove = (event: MouseEvent | TouchEvent): void =>
    this.onDragMove(event);
  private readonly handleDocEnd = (): void => this.onDragEnd();

  private setupDragListeners(): void {
    document.addEventListener("mousemove", this.handleDocMove);
    document.addEventListener("touchmove", this.handleDocMove, { passive: false });
    document.addEventListener("mouseup", this.handleDocEnd);
    document.addEventListener("touchend", this.handleDocEnd);
  }

  private teardownDragListeners(): void {
    if (typeof document === "undefined") return;
    document.removeEventListener("mousemove", this.handleDocMove);
    document.removeEventListener("touchmove", this.handleDocMove);
    document.removeEventListener("mouseup", this.handleDocEnd);
    document.removeEventListener("touchend", this.handleDocEnd);
  }

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
  protected readonly dialNumbers = computed(() => timepickerDialNumbers(this.focusedField(), this.format()));

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
    this.setupDragListeners();
    this.updateAngle(event);
  }

  protected onDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging() || this.viewMode() !== "dial") return;
    if (event.cancelable) event.preventDefault();
    this.updateAngle(event);

    const angle = this.dragAngle();
    if (angle === null) return;

    const next = timeClockTransition(this.value(), { type: "dial", field: this.dragField, angle });
    if (next !== null) this.timePicked.emit(next);
  }

  protected onDragEnd(): void {
    if (!this.isDragging()) return;
    this.teardownDragListeners();

    const angle = this.dragAngle();
    if (angle !== null) {
      const next = timeClockTransition(this.value(), { type: "dial", field: this.dragField, angle });
      if (this.dragField === "hour") this.scheduleMinuteSwitch(300);
      if (next !== null) this.timePicked.emit(next);
    }

    this.isDragging.set(false);
    this.dragAngle.set(null);
  }

  private updateAngle(event: MouseEvent | TouchEvent): void {
    const el = this.dialFaceRef()?.nativeElement;
    if (!el) return;
    const coords = getPointerCoords(event);
    if (!coords) return;
    this.dragAngle.set(pointerAngle(el.getBoundingClientRect(), coords.clientX, coords.clientY));
  }
}
