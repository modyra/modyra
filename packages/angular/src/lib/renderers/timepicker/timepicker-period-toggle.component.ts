import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

@Component({
  selector: "mdy-timepicker-period-toggle",
  standalone: true,
  template: `
    <div class="mdy-timepicker-period-toggle" [class.mdy-timepicker-period-toggle--compact]="compact()">
      <button
        type="button"
        [class]="optionClass"
        [class.mdy-timepicker-period-btn--selected]="period() === 'AM'"
        [disabled]="disabled()"
        (click)="periodChange.emit('AM')"
      >
        AM
      </button>
      <button
        type="button"
        [class]="optionClass"
        [class.mdy-timepicker-period-btn--selected]="period() === 'PM'"
        [disabled]="disabled()"
        (click)="periodChange.emit('PM')"
      >
        PM
      </button>
    </div>
  `,
  styleUrls: ["./timepicker-renderer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdyTimepickerPeriodToggleComponent {
  /** The catalogue's, not a literal: `periodOption` is a declared part with a `selected` state. */
  protected readonly optionClass = MDY_WIDGET_CONTRACTS.timepicker.parts.periodOption.classes.join(" ");

  readonly period   = input.required<'AM' | 'PM'>();
  readonly disabled = input<boolean>(false);
  readonly compact  = input<boolean>(false);
  readonly periodChange = output<'AM' | 'PM'>();
}
