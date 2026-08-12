import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from "@angular/core";
import { acceptTimeField, stepTimeField, timeFieldBounds } from "@modyra/widgets";
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
        class="mdy-timepicker-segment-input"
        [min]="bounds().min"
        [max]="bounds().max"
        [attr.aria-invalid]="outOfRange() ? 'true' : null"
        [attr.title]="outOfRange() ? bounds().min + '–' + bounds().max : null"
        [class.mdy-timepicker-segment-input--readonly]="readonly()"
        [value]="value()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        (input)="inputChange.emit($event)"
        (keydown)="handleKeydown($event)"
        (paste)="handlePaste($event)"
        (focus)="handleFocus()"
        (click)="handleClick()"
        [attr.aria-label]="label()"
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

  private readonly box = viewChild<ElementRef<HTMLInputElement>>("box");

  /** The range the contract states for this segment, rather than a literal beside the template. */
  protected readonly bounds = computed(() => timeFieldBounds(this.unit(), this.format()));

  /**
   * Whether what is in the box is outside that range.
   *
   * An empty box is being cleared, not asserted, so it is not an error until it is left.
   */
  protected readonly outOfRange = computed(() => {
    const raw = this.value();
    if (raw.trim().length === 0) return false;
    return acceptTimeField(this.unit(), this.format(), raw).type === "rejected";
  });

  readonly clicked     = output<void>();
  readonly focused     = output<void>();
  readonly inputChange = output<Event>();

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
      const entry = acceptTimeField(this.unit(), this.format(), this.value());
      const from = entry.type === "accepted" ? entry.value : this.bounds().min;
      const input = this.box()?.nativeElement;
      if (!input) return;
      input.value = String(stepTimeField(this.unit(), this.format(), from, delta));
      // Through the same channel a keystroke uses, so the parent has one path to maintain.
      input.dispatchEvent(new Event("input", { bubbles: true }));
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
