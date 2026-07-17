import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from "@angular/core";
import { CalendarCell, CalendarDate } from "@modyra/core/date-utils";

/**
 * A single day cell in the calendar grid.
 *
 * Handles rendering, selection highlight, today indicator,
 * disabled state, and click/keyboard interaction.
 *
 * ```html
 * <mdy-calendar-cell
 *   [cell]="cell"
 *   [isSelected]="true"
 *   [isToday]="false"
 *   [isFocused]="false"
 *   [isDisabled]="false"
 *   (picked)="onPick($event)"
 * />
 * ```
 */
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
    // Enter/Space are handled once by the calendar container on the focused
    // date — a cell-level handler would double-fire datePicked (R5).
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

  /** Emits the picked date when the cell is activated. */
  readonly picked = output<CalendarDate>();

  private readonly elementRef = inject(ElementRef);

  /** Focuses the host element of this cell. */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  protected onSelect(): void {
    if (!this.isDisabled()) {
      this.picked.emit(this.cell().date);
    }
  }
}
