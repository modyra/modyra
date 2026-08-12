import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { CalendarDate, isMonthOutOfRange } from "@modyra/core/datetime";
import { MDY_DATE_LOCALE } from "../../core/date-locale";

@Component({
  selector: "mdy-month-picker",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-datepicker__month-picker" },
  template: `
    @for (monthName of months(); track $index) {
      <button
        type="button"
        class="mdy-datepicker__month-cell"
        [class.mdy-datepicker__month-cell--selected]="currentMonth() === $index + 1"
        [disabled]="isMonthDisabled($index + 1)"
        (click)="monthSelected.emit($index + 1)"
      >
        {{ monthName }}
      </button>
    }
  `,
})
export class MdyMonthPickerComponent {
  readonly currentMonth = input.required<number>();
  readonly viewYear = input.required<number>();
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly monthSelected = output<number>();

  private readonly locale = inject(MDY_DATE_LOCALE);

  protected readonly months = computed(() => this.locale.monthNamesShort);

  protected isMonthDisabled(month: number): boolean {
    return isMonthOutOfRange(this.viewYear(), month, this.minDate(), this.maxDate());
  }
}
