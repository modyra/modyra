import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { acceptTimeField, MDY_EVERY_TIME, MDY_WIDGET_CONTRACTS, stateClass, stepTimeField, timeFieldBounds, type MdyTimeSteps } from "@modyra/widgets";
import type { MdyTimeFormat } from "@modyra/core/datetime";

@Component({
  selector: "mdy-timepicker-segment",
  standalone: true,
  template: `
    <div
      class="mdy-timepicker-segment"
      [class.mdy-timepicker-segment--hour]="unit() === 'hour'"
      [class.mdy-timepicker-segment--minute]="unit() === 'minute'"
      [class.mdy-timepicker-segment--active]="active()"
    >
      <input
        #box
        type="number"
        [attr.id]="controlId() || null"
        class="mdy-timepicker-segment-input"
        [min]="bounds().min"
        [max]="bounds().max"
        [step]="bounds().step"
        [attr.aria-invalid]="outOfRange() ? 'true' : null"
        [attr.title]="outOfRange() ? bounds().min + '–' + bounds().max : null"
        [class]="readonly() ? readonlyClass : ''"
        [value]="value()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        (input)="inputChange.emit($event)"
        (keydown)="handleKeydown($event)"
        (paste)="handlePaste($event)"
        (focus)="handleFocus()"
        (click)="handleClick()"
        [attr.aria-label]="label()"
        [attr.role]="'spinbutton'"
        [attr.aria-valuemin]="bounds().min"
        [attr.aria-valuemax]="bounds().max"
        [attr.aria-valuenow]="value()"
      />
      @if (showLabel()) {
        <span class="mdy-timepicker-segment-label">{{ label() }}</span>
      }
    </div>
  `,
  styleUrls: ["./timepicker-renderer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyTimepickerSegmentComponent {
  /** The id the projection gives this segment's control, passed in rather than rebuilt here. */
  readonly controlId = input<string>("");

  readonly value    = input.required<string>();
  /** Which segment this is. The contract names the two separately so a theme, a test or a
   *  screen reader can tell the hour from the minute without counting siblings. */
  readonly unit     = input<"hour" | "minute">("hour");
  readonly label    = input<string>("");
  readonly active   = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly showLabel = input<boolean>(false);
  /** Which clock this segment belongs to. The hour's range depends on it; the minute's never does. */
  readonly format = input<MdyTimeFormat>("12h");
  /**
   * Which values this segment offers, resolved by the renderer for the time being edited.
   *
   * Given rather than derived: a windowed granularity's minute step depends on the hour the draft is
   * on, and a segment that resolved it here would need the whole draft to do it — and would be a
   * second answer to a question the controller already answers.
   */
  readonly steps = input<MdyTimeSteps>(MDY_EVERY_TIME);

  /** The state class the catalogue declares for a segment that refuses edits. */
  protected readonly readonlyClass = stateClass(
    MDY_WIDGET_CONTRACTS.timepicker.parts.hourControl.classes[0]!,
    "readonly",
  );

  /**
   * The range the contract states for this segment, rather than a literal beside the template.
   *
   * It answers the native `min`/`max` and the spoken `aria-valuemin`/`aria-valuemax` from one place:
   * a 24-hour face whose reader is told the maximum is 12 states one of two ranges falsely, and a
   * reader has no way to see which. The segment is declared a spinbutton by the catalogue, and a
   * control that carries neither the role nor the number is announced as an edit box holding
   * nothing.
   */
  protected readonly bounds = computed(() => timeFieldBounds(this.unit(), this.format(), this.steps()));

  /**
   * Whether what is in the box is outside that range.
   *
   * An empty box is being cleared, not asserted, so it is not an error until it is left.
   */
  protected readonly outOfRange = computed(() => {
    const raw = this.value();
    if (raw.trim().length === 0) return false;
    return acceptTimeField(this.unit(), this.format(), raw, this.steps()).type === "rejected";
  });

  readonly clicked     = output<void>();
  readonly focused     = output<void>();
  readonly inputChange = output<Event>();
  /** The value an arrow key asks for. A value rather than an event: nothing here writes the DOM. */
  readonly stepped = output<number>();

  protected handleClick(): void {
    if (this.readonly()) {
      this.clicked.emit();
    }
  }

  protected handleFocus(): void {
    if (!this.readonly()) {
      this.focused.emit();
    }
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;

    // Stepping wraps: an arrow key scans the range rather than asserting a value, so 12 + 1 is 1
    // and 0 − 1 is 23. A step also pulls an out-of-range segment back inside, because stepping is
    // how a user leaves a bad value.
    const delta = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (delta !== 0) {
      event.preventDefault();
      const entry = acceptTimeField(this.unit(), this.format(), this.value(), this.steps());
      const from = entry.type === "accepted" ? entry.value : this.bounds().min;
      // Reported, not written. The template binds `[value]="value()"`, so this DOM property has an
      // owner; a handler that also assigns it gives one value two owners, and which of them wins is
      // a matter of timing — the bound value was written back over the stepped one before the frame
      // painted, which is what "the arrows do nothing" was. The step goes out as a value and comes
      // back as a render, the same way a typed character does.
      this.stepped.emit(stepTimeField(this.unit(), this.format(), from, delta, this.steps()));
      return;
    }

    const invalidChars = ['e', 'E', '+', '-', '.', ','];
    if (invalidChars.includes(event.key)) {
      event.preventDefault();
    }
  }

  protected handlePaste(event: ClipboardEvent): void {
    if (this.readonly()) return;
    const text = event.clipboardData?.getData('text') || '';
    if (!/^\d+$/.test(text)) {
      event.preventDefault();
    }
  }
}
