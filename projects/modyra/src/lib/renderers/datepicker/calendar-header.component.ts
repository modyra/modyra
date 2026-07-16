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

/**
 * Calendar header — displays the current month/year label and
 * navigation arrows (prev/next month).
 *
 * ```html
 * <mdy-calendar-header
 *   [year]="2026"
 *   [month]="3"
 *   (previousMonth)="goPrev()"
 *   (nextMonth)="goNext()"
 * />
 * ```
 */
@Component({
  selector: "mdy-calendar-header",
  standalone: true,
  imports: [MdyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-datepicker__header" },
  template: `
    <div class="mdy-datepicker__header-label">
      <button
        type="button"
        class="mdy-datepicker__view-toggle"
        (click)="toggleView.emit()"
        [attr.aria-label]="i18n.datepickerChangeView(monthLabel() + ' ' + year())"
      >
        <span class="mdy-datepicker__title">
          {{ monthLabel() }} {{ year() }}
        </span>
        <mdy-icon name="CHEVRON_DOWN" class="mdy-datepicker__view-icon" />
      </button>
    </div>

    <div class="mdy-datepicker__header-nav">
      <button
        type="button"
        class="mdy-datepicker__nav-btn"
        [attr.aria-label]="i18n.datepickerPreviousMonth"
        (click)="previousMonth.emit()"
      >
        <mdy-icon name="CHEVRON_LEFT" />
      </button>

      <button
        type="button"
        class="mdy-datepicker__nav-btn"
        [attr.aria-label]="i18n.datepickerNextMonth"
        (click)="nextMonth.emit()"
      >
        <mdy-icon name="CHEVRON_RIGHT" />
      </button>
    </div>
  `,
})
export class MdyCalendarHeaderComponent {
  readonly year = input.required<number>();
  /** 1-based month (1 = January). */
  readonly month = input.required<number>();

  readonly previousMonth = output<void>();
  readonly nextMonth = output<void>();
  readonly toggleView = output<void>();

  private readonly locale = inject(MDY_DATE_LOCALE);
  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  /** Localized month name (e.g. "March", "Marzo"). */
  protected readonly monthLabel = computed(
    (): string => this.locale.monthNamesLong[this.month() - 1] ?? "",
  );
}
