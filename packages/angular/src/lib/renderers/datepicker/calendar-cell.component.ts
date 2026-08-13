import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from "@angular/core";
import { CalendarCell, CalendarDate } from "@modyra/core/datetime";

@Component({
  selector: "mdy-calendar-cell",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-datepicker__cell",
    "[class.mdy-datepicker__cell--outside]": "!cell().inMonth",
    "[class.mdy-datepicker__cell--today]": "isToday()",
    "[class.mdy-datepicker__cell--selected]": "isSelected()",
    "[class.mdy-datepicker__cell--focused]": "isFocused()",
    "[class.mdy-datepicker__cell--disabled]": "isDisabled()",
    role: "gridcell",
    "[attr.aria-selected]": "isSelected()",
    "[attr.aria-disabled]": "isDisabled()",
    "[attr.aria-current]": "isToday() ? 'date' : null",
    "[attr.tabindex]": "isFocused() ? 0 : -1",
    "(click)": "onSelect()",
  },
  template: `{{ cell().date.day }}`,
})
export class MdyCalendarCellComponent {
  readonly cell = input.required<CalendarCell>();
  readonly isSelected = input<boolean>(false);
  readonly isToday = input<boolean>(false);
  readonly isFocused = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);

  readonly picked = output<CalendarDate>();

  private readonly elementRef = inject(ElementRef);

  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  protected onSelect(): void {
    if (!this.isDisabled()) {
      this.picked.emit(this.cell().date);
    }
  }
}
