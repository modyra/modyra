import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { MDY_EVERY_TIME, type MdyTimeSteps } from "@modyra/widgets";
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
          unit="hour"
          [format]="format()"
          [steps]="steps()"
          [value]="hour()"
          [label]="i18n.timepickerHourLabel"
          [active]="focusedField() === 'hour'"
          [disabled]="disabled()"
          [showLabel]="viewMode() === 'input'"
          (inputChange)="hourInput.emit($event)"
          (stepped)="hourStep.emit($event)"
          (focused)="fieldFocus.emit('hour')"
          (clicked)="fieldClick.emit('hour')"
        />

        <span class="mdy-timepicker-separator">:</span>

        <mdy-timepicker-segment
          unit="minute"
          [format]="format()"
          [steps]="steps()"
          [value]="minute()"
          [label]="i18n.timepickerMinuteLabel"
          [active]="focusedField() === 'minute'"
          [disabled]="disabled()"
          [showLabel]="viewMode() === 'input'"
          (inputChange)="minuteInput.emit($event)"
          (stepped)="minuteStep.emit($event)"
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
  readonly format = input<'12h' | '24h'>('12h');
  /** Which values the segments offer, resolved once by the renderer for the time being edited. */
  readonly steps = input<MdyTimeSteps>(MDY_EVERY_TIME);
  readonly focusedField = input.required<'hour' | 'minute'>();
  readonly viewMode = input.required<'input' | 'dial'>();
  readonly disabled = input<boolean>(false);

  readonly hourInput = output<Event>();
  /** What an arrow key on the hour asks for, as a value. */
  readonly hourStep = output<number>();
  readonly minuteInput = output<Event>();
  /** What an arrow key on the minute asks for, as a value. */
  readonly minuteStep = output<number>();
  readonly fieldFocus = output<'hour' | 'minute'>();
  readonly fieldClick = output<'hour' | 'minute'>();
  readonly periodChange = output<'AM' | 'PM'>();
}
