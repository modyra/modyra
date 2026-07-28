import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

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
        type="number"
        class="mdy-timepicker-segment-input"
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
