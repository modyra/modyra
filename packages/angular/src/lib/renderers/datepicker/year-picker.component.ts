import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChildren,
} from "@angular/core";
import { CalendarDate, calendarYearRange, isYearOutOfRange } from "@modyra/core/datetime";
import { projectCalendarPeriodCellA11y, projectCalendarViewA11y } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";

@Component({
  selector: "mdy-year-picker",
  standalone: true,
  imports: [MdyPartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "view().classes.join(' ')",
    "[attr.role]": "view().attributes['role']",
  },
  template: `
    <div class="mdy-datepicker__year-grid">
      @for (yearNum of years(); track $index) {
        <button #yearBtn type="button" [mdyPart]="cell(yearNum)" (click)="yearSelected.emit(yearNum)">
          {{ yearNum }}
        </button>
      }
    </div>
  `,
})
export class MdyYearPickerComponent {
  readonly currentYear = input.required<number>();
  readonly minDate = input<CalendarDate | null>(null);
  readonly maxDate = input<CalendarDate | null>(null);
  readonly widgetId = input<string>("");
  readonly yearSelected = output<number>();

  private readonly yearButtons = viewChildren<ElementRef<HTMLButtonElement>>("yearBtn");

  constructor() {
    afterNextRender(() => {
      const btns = this.yearButtons();
      const years = this.years();
      const selectedIndex = years.findIndex(y => y === this.currentYear());
      if (selectedIndex !== -1 && btns[selectedIndex]) {
        btns[selectedIndex].nativeElement.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  }

  /** The years on offer, from the contract: two renderers each choosing a span is two pickers. */
  protected readonly years = computed(() =>
    calendarYearRange(this.currentYear(), this.minDate(), this.maxDate()),
  );

  /** Classes, role and chosen state, all the contract's. */
  protected readonly view = computed(() =>
    projectCalendarViewA11y("years", { kind: "datepicker", widgetId: this.widgetId() })!,
  );

  protected cell(year: number) {
    return projectCalendarPeriodCellA11y("years", {
      value: year,
      label: String(year),
      selected: this.currentYear() === year,
      disabled: isYearOutOfRange(year, this.minDate(), this.maxDate()),
    }, { kind: "datepicker", widgetId: this.widgetId() });
  }
}
