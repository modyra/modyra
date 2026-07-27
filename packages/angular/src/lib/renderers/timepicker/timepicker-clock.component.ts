import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
} from "@modyra/core/time-utils";
import { timeClockTransition } from "@modyra/widgets";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyTimepickerHeaderComponent } from "./timepicker-header.component";

/**
 * Dumb UI component for the Material 3 Timepicker Clock/Input.
 * Emits `timePicked` on every change, but does NOT commit until the parent
 * calls `confirmClicked`.
 */
@Component({
  selector: "mdy-timepicker-clock",
  standalone: true,
  imports: [MdyTimepickerHeaderComponent],
  templateUrl: "./timepicker-clock.component.html",
  styleUrls: ["./timepicker-renderer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyTimepickerClockComponent {
  protected readonly Math = Math;
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly value = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  /**
   * Header display format. The clock's internal model and the emitted
   * `timePicked` strings stay canonical 12h — the renderer converts at
   * the value boundary.
   */
  readonly format = input<MdyTimeFormat>("12h");
  readonly timePicked = output<string>();
  readonly cancelClicked = output<void>();
  readonly confirmClicked = output<void>();

  protected readonly viewMode = signal<"input" | "dial">("input");
  protected readonly focusedField = signal<"hour" | "minute">("hour");
  protected readonly isDragging = signal(false);
  protected readonly dragAngle = signal<number | null>(null);

  /** Tracks the field that was active when drag *started*, so
   *  onDragMove always uses the same field until the drag ends. */
  private dragField: "hour" | "minute" = "hour";

  /** Pending auto-switch timer — cancelled on destroy (B37-style cleanup). */
  private switchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly dialFaceRef = viewChild<ElementRef<HTMLElement>>("dialFace");

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.switchTimer !== null) clearTimeout(this.switchTimer);
      this.teardownDragListeners();
    });
  }

  // Document listeners are registered only while a drag is in progress —
  // an always-on document:mousemove per clock instance is wasteful (R9).
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

  /** Schedules the hour→minute auto-switch, replacing any pending one. */
  private scheduleMinuteSwitch(delayMs: number): void {
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      this.focusedField.set("minute");
    }, delayMs);
  }

  // ── Parsing helpers ────────────────────────────────────────────────────────

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

  // ── Hand rotation ──────────────────────────────────────────────────────────

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

  // ── Input variant handlers ─────────────────────────────────────────────────

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
  }

  // ── Dial click (tap without drag) ──────────────────────────────────────────

  protected onDialNumberClick(value: number): void {
    if (this.disabled()) return;
    const field = this.focusedField();
    const next = timeClockTransition(this.value(),
      field === "hour"
        ? { type: "hour", value, format: "12h" }
        : { type: "minute", value },
    );
    if (next !== null) this.timePicked.emit(next);
    if (field === "hour") this.scheduleMinuteSwitch(200);
  }

  // ── Drag interaction ───────────────────────────────────────────────────────

  protected onDragStart(event: MouseEvent | TouchEvent): void {
    if (this.disabled() || this.viewMode() !== "dial") return;
    if (event.cancelable) event.preventDefault();
    // Snapshot the current field so the whole drag uses a consistent mode
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

    // Snap to nearest value and emit final position
    const angle = this.dragAngle();
    if (angle !== null) {
      const next = timeClockTransition(this.value(), { type: "dial", field: this.dragField, angle });
      if (this.dragField === "hour") this.scheduleMinuteSwitch(300);
      if (next !== null) this.timePicked.emit(next);
    }

    this.isDragging.set(false);
    this.dragAngle.set(null);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private updateAngle(event: MouseEvent | TouchEvent): void {
    const el = this.dialFaceRef()?.nativeElement;
    if (!el) return;
    const coords = getPointerCoords(event);
    if (!coords) return;
    this.dragAngle.set(pointerAngle(el.getBoundingClientRect(), coords.clientX, coords.clientY));
  }
}
