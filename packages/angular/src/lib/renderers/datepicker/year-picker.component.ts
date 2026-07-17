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
import { CalendarDate } from "@modyra/core/date-utils";

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
    // Scroll to the current year after the view renders
    afterNextRender(() => {
      const btns = this.yearButtons();
      const years = this.years();
      const selectedIndex = years.findIndex(y => y === this.currentYear());
      if (selectedIndex !== -1 && btns[selectedIndex]) {
        btns[selectedIndex].nativeElement.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  }


  protected readonly years = computed(() => {

    const min = this.minDate()?.year ?? 1920;
    const max = this.maxDate()?.year ?? 2120;

    // Ensure we at least show a decent range around the current year
    const cur = this.currentYear();
    const startYear = Math.min(min, cur - 100, 1920);
    const endYear = Math.max(max, cur + 100, 2120);

    const result: number[] = [];
    for (let i = startYear; i <= endYear; i++) {
      result.push(i);
    }
    return result;
  });


  protected isYearDisabled(year: number): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && year < min.year) return true;
    if (max && year > max.year) return true;
    return false;
  }
}

