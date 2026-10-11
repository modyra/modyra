import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyIconComponent } from "../../control/mdy-icon.component";

@Component({
  selector: "mdy-calendar-header",
  standalone: true,
  imports: [MdyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-datepicker__header" },
  template: `
    <button
      type="button"
      class="mdy-datepicker__nav-btn mdy-datepicker__nav-btn--previous"
      [attr.aria-label]="i18n.datepickerPreviousMonth"
      (click)="previousMonth.emit()"
    >
      <mdy-icon name="CHEVRON_LEFT" />
    </button>

    <button
      type="button"
      class="mdy-datepicker__view-toggle"
      (click)="toggleView.emit()"
      [attr.aria-label]="i18n.datepickerChangeView(monthLabel() + ' ' + year())"
    >
      <!--
        The month as its own element: the grid is named by referring to it, and this button carries a
        name of its own, so a reference crossing into the button would take that name. ADR 0212.
      -->
      <span class="mdy-datepicker__title" [attr.id]="headingId() || null">
        {{ monthLabel() }} {{ year() }}
      </span>
      <mdy-icon name="CHEVRON_DOWN" class="mdy-datepicker__view-icon" />
    </button>

    <button
      type="button"
      class="mdy-datepicker__nav-btn mdy-datepicker__nav-btn--next"
      [attr.aria-label]="i18n.datepickerNextMonth"
      (click)="nextMonth.emit()"
    >
      <mdy-icon name="CHEVRON_RIGHT" />
    </button>
  `,
})
export class MdyCalendarHeaderComponent {
  readonly year = input.required<number>();
  /** The id the grid points `aria-labelledby` at, so the month names it. ADR 0212. */
  readonly headingId = input<string>("");
  readonly month = input.required<number>();

  readonly previousMonth = output<void>();
  readonly nextMonth = output<void>();
  readonly toggleView = output<void>();

  private readonly locale = inject(MDY_DATE_LOCALE);
  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  protected readonly monthLabel = computed(
    (): string => this.locale.monthNamesLong[this.month() - 1] ?? "",
  );
}
