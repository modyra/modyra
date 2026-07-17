import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from "@angular/core";
import {
  CalendarDate,
  formatIsoDate,
  parseIsoDate,
  parseLocalizedDate,
  today,
} from "@modyra/core/date-utils";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyCalendarComponent } from "./calendar.component";

/**
 * Date picker renderer — M3-style docked calendar picker.
 * Integrated with MdyControlLabelComponent.
 */
@Component({
  selector: "mdy-control-datepicker",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyCalendarComponent,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--datepicker",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    <div class="mdy-datepicker" #wrapper>
      <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
        @if (prefix(); as p) {
           <div class="mdy-input-prefix">
             <ng-container [ngTemplateOutlet]="p.template" />
           </div>
        }
        <input
          [id]="fieldId"
          type="text"
          class="mdy-datepicker__input"
          [placeholder]="placeholder()"
          [value]="displayValue()"
          [disabled]="isDisabled()"
          (change)="onInputChange($event)"
          (blur)="onInputBlur($event)"
          [attr.aria-expanded]="open()"
          [attr.aria-haspopup]="'dialog'"
          [attr.aria-invalid]="hasErrors()"
          [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
          [attr.aria-required]="ariaRequired() || isRequired()"
          [attr.aria-disabled]="effectiveAriaDisabled()"
          [attr.aria-label]="label() || null"
        />
        <div class="mdy-input-suffix">
           @if (suffix(); as s) {
             <ng-container [ngTemplateOutlet]="s.template" />
           } @else {
             <button
                type="button"
                class="mdy-datepicker__toggle"
                [disabled]="isDisabled()"
                (click)="toggleOverlay($event)"
                [attr.aria-label]="i18n.datepickerToggleLabel"
              >
                 <mdy-icon name="CALENDAR" class="mdy-datepicker__icon" />
              </button>
           }
        </div>
      </div>

      <mdy-overlay-panel
        [open]="open()"
        [position]="position()"
        [alignment]="alignment()"
        [coords]="coords()"
        [maxHeight]="maxHeight()"
        [hasBackdrop]="variant() === 'modal' || position() === 'overlay'"
        [widthMode]="'auto-content'"
        [panelClass]="'mdy-datepicker__popup'"
        (close)="closeOverlay()"
      >
        @if (variant() === 'modal') {
           <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">{{ label() || i18n.datepickerSelectFallback }}</span>
              <span class="mdy-datepicker__modal-value">{{ modalDisplayValue() }}</span>
           </div>
        }

        <mdy-calendar
          #calendar
          [selectedDate]="variant() === 'modal' ? tempSelectedDate() : parsedSelectedDate()"
          [minDate]="parsedMinDate()"
          [maxDate]="parsedMaxDate()"
          [ariaLabel]="label() || i18n.datepickerChooseDate"
          (datePicked)="onDatePicked($event)"
          (closed)="closeOverlay()"
        />

        @if (variant() === 'modal') {
           <div class="mdy-datepicker__actions">
              <button type="button" class="mdy-datepicker__action-btn" (click)="closeOverlay()">{{ i18n.datepickerCancel }}</button>
              <button type="button" class="mdy-datepicker__action-btn mdy-datepicker__action-btn--primary" (click)="applySelection()">{{ i18n.datepickerConfirm }}</button>
           </div>
        }
      </mdy-overlay-panel>
    </div>

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyDatePickerComponent extends MdyOverlayControl<string | null> {
  readonly placeholder = input<string>("YYYY-MM-DD");
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  readonly variant = input<"docked" | "modal">("docked");
  /**
   * How the selected date is rendered in the input:
   * `"localized"` uses `Intl` with the active MDY_DATE_LOCALE,
   * `"iso"` shows the raw `YYYY-MM-DD` value. Typing accepts ISO in both modes.
   */
  readonly displayFormat = input<"iso" | "localized">("localized");

  protected override readonly minSpace = 450;

  protected readonly fieldId = `mdy-control-datepicker-${MdyBaseControl.nextId()}`;

  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  private readonly calendarRef = viewChild<MdyCalendarComponent>("calendar");
  private readonly locale = inject(MDY_DATE_LOCALE);
  private readonly injector = inject(Injector);

  // ── Derived state ───────────────────────────────────────────────────────────

  protected readonly tempSelectedDate = signal<CalendarDate | null>(null);

  protected readonly displayValue = computed((): string => {
    const v = this.value();
    if (!v) return "";
    const iso = v.substring(0, 10);
    if (this.displayFormat() === "iso") return iso;
    const parsed = parseIsoDate(iso);
    if (!parsed) return iso;
    try {
      return new Intl.DateTimeFormat(this.locale.locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(parsed.year, parsed.month - 1, parsed.day));
    } catch {
      return iso;
    }
  });

  protected readonly modalDisplayValue = computed((): string => {
    try {
      const d = this.tempSelectedDate() ?? this.parsedSelectedDate() ?? today();
      const date = new Date(d.year, d.month - 1, d.day);
      return new Intl.DateTimeFormat(this.locale.locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return this.i18n.datepickerSelectFallback;
    }
  });

  protected readonly parsedSelectedDate = computed((): CalendarDate | null =>
    parseIsoDate(this.value()),
  );

  protected readonly parsedMinDate = computed((): CalendarDate | null =>
    parseIsoDate(this.minDate()),
  );

  protected readonly parsedMaxDate = computed((): CalendarDate | null =>
    parseIsoDate(this.maxDate()),
  );

  protected override onBeforeOpen(): void {
    this.tempSelectedDate.set(this.parsedSelectedDate());
    afterNextRender(() => {
      const cal = this.calendarRef();
      if (!cal) return;
      cal.syncView(this.tempSelectedDate());
      cal.focusFocusedDate();
    }, { injector: this.injector });
  }

  protected applySelection(): void {
    const d = this.tempSelectedDate();
    if (d) {
      this.onDatePicked(d, true);
    } else {
      this.closeOverlay();
    }
  }

  protected onDatePicked(date: CalendarDate, forceApply = false): void {
    if (this.variant() === "modal" && !forceApply) {
      this.tempSelectedDate.set(date);
      return;
    }
    const isoString = formatIsoDate(date);
    this.setValue(isoString);
    this.markAsDirty();
    this.closeOverlay();
  }

  protected onInputChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    if (!raw) {
      this.setValue(null);
      this.markAsDirty();
      return;
    }
    // Localized display also accepts the locale's numeric format
    // (31/12/2026, 12/31/2026, 31.12.2026); ISO works in both modes.
    const parsed =
      this.displayFormat() === "localized"
        ? parseLocalizedDate(raw, this.locale.locale)
        : parseIsoDate(raw);
    if (parsed && this.isWithinRange(parsed)) {
      const isoString = formatIsoDate(parsed);
      this.setValue(isoString);
      this.markAsDirty();
    }
  }

  protected onInputBlur(event: FocusEvent): void {
    // Revert any unparsed/rejected text to the canonical display value.
    (event.target as HTMLInputElement).value = this.displayValue();
    this.markAsTouched();
  }

  /** Manual input honours [minDate]/[maxDate] like the calendar does. */
  private isWithinRange(date: CalendarDate): boolean {
    const iso = formatIsoDate(date);
    const min = this.parsedMinDate();
    const max = this.parsedMaxDate();
    if (min && iso < formatIsoDate(min)) return false;
    if (max && iso > formatIsoDate(max)) return false;
    return true;
  }
}
