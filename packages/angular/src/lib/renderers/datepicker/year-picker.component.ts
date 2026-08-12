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

@Component({
  selector: "mdy-year-picker",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-datepicker__year-picker" },
  template: `
    <div class="mdy-datepicker__year-grid">
      @for (yearNum of years(); track $index) {
        <button
          #yearBtn
          type="button"
          class="mdy-datepicker__year-cell"
          [class.mdy-datepicker__year-cell--selected]="currentYear() === yearNum"
          [disabled]="isYearDisabled(yearNum)"
          (click)="yearSelected.emit(yearNum)"
        >
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

  protected isYearDisabled(year: number): boolean {
    return isYearOutOfRange(year, this.minDate(), this.maxDate());
  }
}
