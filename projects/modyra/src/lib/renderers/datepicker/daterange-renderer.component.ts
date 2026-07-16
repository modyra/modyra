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
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import {
  CalendarDate,
  compareDates,
  formatIsoDate,
  parseIsoDate,
} from "../../core/date-utils";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyDateRange } from "../../core/types";
import { MdyRangeCalendarComponent } from "./range-calendar.component";

/**
 * Date range picker renderer — compact two-input calendar picker
 * for selecting a start and end date. Integrated with MdyControlLabelComponent.
 */
@Component({
  selector: "mdy-control-daterange",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyRangeCalendarComponent,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--datepicker mdy-renderer--daterange",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    @if (label()) {
      <mdy-control-label
        [label]="label()"
        [forId]="fieldId + '-start'"
        [required]="isRequired()"
        [filled]="true"
        [showInlineError]="inlineErrors && touched() && hasErrors()"
        [errorText]="inlineErrorText()"
      />
    }

    <div class="mdy-datepicker" #wrapper>
      <div class="mdy-input-wrapper mdy-daterange__group" [class.mdy-input-wrapper--disabled]="isDisabled()">
        <span class="mdy-daterange__input-sizer" [attr.data-value]="displayStart() || startPlaceholder()">
          <input
            #startInput
            type="text"
            [id]="fieldId + '-start'"
            class="mdy-datepicker__input mdy-daterange__input"
            [value]="displayStart()"
            [disabled]="isDisabled()"
            [placeholder]="startPlaceholder()"
            (input)="onStartInput($event)"
            (blur)="onStartBlur($event)"
            (focus)="lastFocused.set('start')"
            (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-label]="(label() ? label() + ' — ' : '') + i18n.daterangeStartLabel"
            [attr.aria-expanded]="open()"
            [attr.aria-haspopup]="'dialog'"
            autocomplete="off"
          />
        </span>
        <span class="mdy-daterange__sep" aria-hidden="true">–</span>
        <span class="mdy-daterange__input-sizer" [attr.data-value]="displayEnd() || endPlaceholder()">
          <input
            #endInput
            type="text"
            [id]="fieldId + '-end'"
            class="mdy-datepicker__input mdy-daterange__input"
            [value]="displayEnd()"
            [disabled]="isDisabled()"
            [placeholder]="endPlaceholder()"
            (input)="onEndInput($event)"
            (blur)="onEndBlur($event)"
            (focus)="lastFocused.set('end')"
            (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-label]="(label() ? label() + ' — ' : '') + i18n.daterangeEndLabel"
            [attr.aria-expanded]="open()"
            [attr.aria-haspopup]="'dialog'"
            autocomplete="off"
          />
        </span>
        <div class="mdy-input-suffix">
          <button
            type="button"
            class="mdy-datepicker__toggle"
            [disabled]="isDisabled()"
            [attr.aria-label]="i18n.datepickerToggleLabel"
            tabindex="-1"
            (click)="toggleOverlay($event)"
          >
           <mdy-icon name="CALENDAR" class="mdy-datepicker__icon" />
          </button>
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
        [panelClass]="'mdy-datepicker__popup mdy-datepicker__popup--range'"
        (close)="closeOverlay()"
      >
        @if (variant() === 'modal') {
           <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">{{ label() || i18n.daterangeSelectFallback }}</span>
              <span class="mdy-datepicker__modal-value">{{ modalDisplayValue() }}</span>
           </div>
        }

        <mdy-range-calendar
          #calendar
          [rangeStart]="variant() === 'modal' ? tempStart() : parsedStart()"
          [rangeEnd]="variant() === 'modal' ? tempEnd() : parsedEnd()"
          [minDate]="parsedMinDate()"
          [maxDate]="parsedMaxDate()"
          [ariaLabel]="label() || i18n.daterangeChooseRange"
          [dateFilter]="dateFilter()"
          (rangePicked)="onRangePicked($event)"
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
export class MdyDateRangePickerComponent extends MdyOverlayControl<MdyDateRange | null> {
  readonly startPlaceholder = input<string>("Start");
  readonly endPlaceholder = input<string>("End");
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  readonly variant = input<"docked" | "modal">("docked");
  readonly dateFilter = input<((date: string) => boolean) | null>(null);

  protected override readonly minSpace = 450;

  protected readonly fieldId = `mdy-daterange-${MdyBaseControl.nextId()}`;

  /** Which input was last focused — drives calendar sync. */
  protected readonly lastFocused = signal<"start" | "end">("start");

  private readonly calendarRef =
    viewChild<MdyRangeCalendarComponent>("calendar");

  private readonly locale = inject(MDY_DATE_LOCALE);
  private readonly injector = inject(Injector);
  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  // ── Derived state ─────────────────────────────────────────────────────────────

  protected readonly tempStart = signal<CalendarDate | null>(null);
  protected readonly tempEnd = signal<CalendarDate | null>(null);

  protected readonly displayStart = computed((): string => {
    const v = this.value()?.start;
    return v ? v.substring(0, 10) : "";
  });

  protected readonly displayEnd = computed((): string => {
    const v = this.value()?.end;
    return v ? v.substring(0, 10) : "";
  });

  protected readonly modalDisplayValue = computed((): string => {
    const s = this.tempStart() ?? this.parsedStart();
    const e = this.tempEnd() ?? this.parsedEnd();

    if (!s) return this.i18n.daterangeSelectFallback;

    const format = (d: CalendarDate) => {
      try {
        const date = new Date(d.year, d.month - 1, d.day);
        return new Intl.DateTimeFormat(this.locale.locale, {
          month: "short",
          day: "numeric",
        }).format(date);
      } catch {
        return "";
      }
    };

    const startStr = format(s);
    if (!e) return `${startStr} – ...`;
    const endStr = format(e);
    return `${startStr} – ${endStr}`;
  });

  protected readonly parsedStart = computed((): CalendarDate | null =>
    parseIsoDate(this.value()?.start),
  );

  protected readonly parsedEnd = computed((): CalendarDate | null =>
    parseIsoDate(this.value()?.end),
  );

  protected readonly parsedMinDate = computed((): CalendarDate | null =>
    parseIsoDate(this.minDate()),
  );

  protected readonly parsedMaxDate = computed((): CalendarDate | null =>
    parseIsoDate(this.maxDate()),
  );

  /** Sync calendar view to current value after DOM renders. */
  protected override onBeforeOpen(): void {
    this.tempStart.set(this.parsedStart());
    this.tempEnd.set(this.parsedEnd());
    afterNextRender(() => {
      const cal = this.calendarRef();
      if (!cal) return;
      cal.syncView(this.tempStart(), this.tempEnd());
      cal.focusFocusedDate();
    }, { injector: this.injector });
  }

  // ── Range picked from calendar ───────────────────────────────────────────────

  protected applySelection(): void {
    const s = this.tempStart();
    const e = this.tempEnd();
    if (s && e) {
      this.onRangePicked({ start: s, end: e }, true);
    } else {
      this.closeOverlay();
    }
  }

  protected onRangePicked(
    range: {
      readonly start: CalendarDate;
      readonly end: CalendarDate;
    },
    forceApply = false,
  ): void {
    if (this.variant() === "modal" && !forceApply) {
      this.tempStart.set(range.start);
      this.tempEnd.set(range.end);
      return;
    }
    this.setValue({
      start: formatIsoDate(range.start),
      end: formatIsoDate(range.end),
    });
    this.markAsDirty();
    this.closeOverlay();
  }

  // ── Start input handling ─────────────────────────────────────────────────────

  protected onStartInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const current = this.value() ?? { start: null, end: null };
    if (!raw) {
      this.commitRange(null, current.end);
      return;
    }
    const parsed = parseIsoDate(raw);
    if (parsed) {
      const filter = this.dateFilter();
      if (filter !== null && !filter(formatIsoDate(parsed))) return;
      this.commitRange(formatIsoDate(parsed), current.end);
    }
  }

  protected onStartBlur(event: FocusEvent): void {
    this.markAsTouched();
    const el = event.target as HTMLInputElement;
    el.value = this.displayStart();
  }

  // ── End input handling ───────────────────────────────────────────────────────

  protected onEndInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const current = this.value() ?? { start: null, end: null };
    if (!raw) {
      this.commitRange(current.start, null);
      return;
    }
    const parsed = parseIsoDate(raw);
    if (parsed) {
      const filter = this.dateFilter();
      if (filter !== null && !filter(formatIsoDate(parsed))) return;
      this.commitRange(current.start, formatIsoDate(parsed));
    }
  }

  protected onEndBlur(event: FocusEvent): void {
    this.markAsTouched();
    const el = event.target as HTMLInputElement;
    el.value = this.displayEnd();
  }

  // ── Commit with end ≥ start enforcement ──────────────────────────────────────

  /**
   * Commit the range, enforcing end >= start, the optional [dateFilter],
   * and the [minDate]/[maxDate] bounds — manual typing must not accept a
   * date the calendar would forbid (B17).
   */
  private commitRange(start: string | null, end: string | null): void {
    const s = parseIsoDate(start);
    const e = parseIsoDate(end);

    let finalStart = start;
    let finalEnd = end;

    const filter = this.dateFilter();
    if (filter !== null && finalStart !== null && !filter(finalStart)) finalStart = null;
    if (filter !== null && finalEnd !== null && !filter(finalEnd)) finalEnd = null;

    if (finalStart !== null && !this.isWithinBounds(finalStart)) finalStart = null;
    if (finalEnd !== null && !this.isWithinBounds(finalEnd)) finalEnd = null;

    if (s && e && compareDates(e, s) < 0) {
      finalEnd = finalStart;
    }

    this.setValue({ start: finalStart, end: finalEnd });
    this.markAsDirty();
  }

  /** True when the ISO date lies inside [minDate, maxDate]. */
  private isWithinBounds(iso: string): boolean {
    const min = this.parsedMinDate();
    const max = this.parsedMaxDate();
    if (min && iso < formatIsoDate(min)) return false;
    if (max && iso > formatIsoDate(max)) return false;
    return true;
  }
}
