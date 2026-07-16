import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyTimepickerSegmentComponent } from "./timepicker-segment.component";
import { MdyTimepickerPeriodToggleComponent } from "./timepicker-period-toggle.component";

@Component({
  selector: "mdy-timepicker-header",
  standalone: true,
  imports: [MdyTimepickerSegmentComponent, MdyTimepickerPeriodToggleComponent],
  template: `
    <div class="mdy-timepicker-header">
      <div class="mdy-timepicker-fields">
        <mdy-timepicker-segment
          [value]="hour()"
          [label]="i18n.timepickerHourLabel"
          [active]="focusedField() === 'hour'"
          [disabled]="disabled()"
          [readonly]="viewMode() === 'dial'"
          [showLabel]="viewMode() === 'input'"
          (inputChange)="hourInput.emit($event)"
          (focused)="fieldFocus.emit('hour')"
          (clicked)="fieldClick.emit('hour')"
        />

        <span class="mdy-timepicker-separator">:</span>

        <mdy-timepicker-segment
          [value]="minute()"
          [label]="i18n.timepickerMinuteLabel"
          [active]="focusedField() === 'minute'"
          [disabled]="disabled()"
          [readonly]="viewMode() === 'dial'"
          [showLabel]="viewMode() === 'input'"
          (inputChange)="minuteInput.emit($event)"
          (focused)="fieldFocus.emit('minute')"
          (clicked)="fieldClick.emit('minute')"
        />
      </div>

      @if (format() === '12h') {
        <mdy-timepicker-period-toggle
          [period]="period()"
          [disabled]="disabled()"
          (periodChange)="periodChange.emit($event)"
        />
      }
    </div>
  `,
  styleUrls: ["./timepicker-renderer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyTimepickerHeaderComponent {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly hour = input.required<string>();
  readonly minute = input.required<string>();
  readonly period = input.required<'AM' | 'PM'>();
  /** In 24h mode the AM/PM toggle is hidden (the hour input takes 0-23). */
  readonly format = input<'12h' | '24h'>('12h');
  readonly focusedField = input.required<'hour' | 'minute'>();
  readonly viewMode = input.required<'input' | 'dial'>();
  readonly disabled = input<boolean>(false);

  readonly hourInput = output<Event>();
  readonly minuteInput = output<Event>();
  readonly fieldFocus = output<'hour' | 'minute'>();
  readonly fieldClick = output<'hour' | 'minute'>();
  readonly periodChange = output<'AM' | 'PM'>();
}
