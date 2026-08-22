import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { CalendarDate, isMonthOutOfRange } from "@modyra/core/datetime";
import { projectCalendarPeriodCellA11y, projectCalendarViewA11y } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MDY_DATE_LOCALE } from "../../core/date-locale";

@Component({
  selector: "mdy-month-picker",
  standalone: true,
  imports: [MdyPartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "view().classes.join(' ')",
    "[attr.role]": "view().attributes['role']",
    // The id and the name, from the same projection as the role. Bound without them, a view that
    // announced itself as a grid was a grid of nothing, and the header pointing at it by id pointed
    // at no element at all.
    "[attr.id]": "view().id || null",
    "[attr.aria-labelledby]": "view().attributes['aria-labelledby']",
  },
  template: `
    @for (monthName of months(); track $index) {
      <button type="button" [mdyPart]="cell($index + 1)" (click)="monthSelected.emit($index + 1)">
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
  readonly widgetId = input<string>("");
  readonly monthSelected = output<number>();

  private readonly locale = inject(MDY_DATE_LOCALE);

  protected readonly months = computed(() => this.locale.monthNamesShort);

  /** Classes, role and chosen state, all the contract's. */
  protected readonly view = computed(() =>
    projectCalendarViewA11y("months", { kind: "datepicker", widgetId: this.widgetId() })!,
  );

  protected cell(month: number) {
    return projectCalendarPeriodCellA11y("months", {
      value: month,
      label: this.months()[month - 1] ?? String(month),
      selected: this.currentMonth() === month,
      disabled: isMonthOutOfRange(this.viewYear(), month, this.minDate(), this.maxDate()),
    }, { kind: "datepicker", widgetId: this.widgetId() });
  }
}
