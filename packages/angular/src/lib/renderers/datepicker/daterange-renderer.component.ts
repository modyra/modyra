import { MdyPartDirective } from "../../control/mdy-part.directive";
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
} from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS,
  dateRangeValueTransition,
  overlayControlledId, projectOverlayOpenerA11y, createDaterangeFieldController } from "@modyra/widgets";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyDateRange } from "../../core/types";
import { MdyRangeCalendarComponent } from "./range-calendar.component";
import { inputText, isoDateText } from "../renderer-projection";

@Component({
  selector: "mdy-control-daterange",
  standalone: true,
  imports: [MdyPartDirective, 
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
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    @if (label()) {
      <mdy-control-label
        [label]="label()"
        [forId]="fieldId + '-start'"
      [widgetId]="fieldId"
        [required]="isRequired()"
        [filled]="true"
        [showInlineError]="inlineErrorShown()"
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
            [readonly]="isReadonly()"
            [placeholder]="startPlaceholder()"
            (input)="onEndpointInput($event, 'start')"
            (blur)="onEndpointBlur($event, 'start')"
            (focus)="lastFocused.set('start')"
            (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
            [attr.aria-invalid]="paintsAsInvalid()"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-readonly]="isReadonly() ? 'true' : null"
            [attr.aria-label]="(label() ? label() + ' — ' : '') + i18n.daterangeStartLabel"
            [mdyPart]="popupPromisePart()"
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
            [readonly]="isReadonly()"
            [placeholder]="endPlaceholder()"
            (input)="onEndpointInput($event, 'end')"
            (blur)="onEndpointBlur($event, 'end')"
            (focus)="lastFocused.set('end')"
            (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
            [attr.aria-invalid]="paintsAsInvalid()"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-readonly]="isReadonly() ? 'true' : null"
            [attr.aria-label]="(label() ? label() + ' — ' : '') + i18n.daterangeEndLabel"
            [mdyPart]="popupPromisePart()"
            autocomplete="off"
          />
        </span>
        <div class="mdy-input-suffix">
          <button
            type="button"
            class="mdy-datepicker__toggle"
            [mdyPart]="openerPart()"
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
        [panelId]="popupId()"
        [open]="open()"
        [position]="position()"
        [alignment]="alignment()"
        [coords]="coords()"
        [hasBackdrop]="position() === 'overlay'"
        [widthMode]="'auto-content'"
        [panelClass]="popupClass"
        [kind]="'daterange'"
        (close)="closeOverlay()"
      >
        @if (position() === 'overlay') {
           <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">{{ label() || i18n.daterangeSelectFallback }}</span>
              <span class="mdy-datepicker__modal-value">{{ modalDisplayValue() }}</span>
           </div>
        }

        <mdy-range-calendar
        [widgetId]="fieldId"
          #calendar
          [controller]="controller()"
          [rangeStart]="parsedStart()"
          [rangeEnd]="parsedEnd()"
          [minDate]="parsedMinDate()"
          [maxDate]="parsedMaxDate()"
          [ariaLabel]="label() || i18n.daterangeChooseRange"
          [dateFilter]="dateFilter()"
          (rangePicked)="onRangePicked($event)"
          (closed)="closeOverlay()"
        />

      </mdy-overlay-panel>
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyDateRangePickerComponent extends MdyOverlayControl<MdyDateRange | null> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.daterange.parts.popup.classes.join(" ");
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "daterange" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.daterange;
  protected override readonly widgetKind = "daterange" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly startPlaceholder = input<string>("Start");
  readonly endPlaceholder = input<string>("End");
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  /**
   * Where the popup sits: hung off the control, or covering the viewport.
   *
   * Presentation and nothing else. It used to mean "modal *and* confirm before committing", which
   * contradicted this kind's own value contract (`commit: "live"`).
   */
  readonly variant = input<"docked" | "modal">("docked");

  protected override forceModalPlacement(): boolean {
    return this.variant() === "modal";
  }

  // The ends can move, and the controller is told rather than rebuilt: rebuilding forgets the month
  // on screen and which end the next pick closes.
  protected readonly controller = this.adoptFieldController(
    (handle, widgetId) => createDaterangeFieldController({
      widgetId, handle: handle as never, minDate: this.minDate(), maxDate: this.maxDate(),
      firstDayOfWeek: this.locale.firstDayOfWeek }),
    (c) => c.setBounds(this.minDate(), this.maxDate()),
  );
  readonly dateFilter = input<((date: string) => boolean) | null>(null);

  protected override readonly minSpace = 450;


  /** The id the opener names, which the projected panel has to carry. */
  protected readonly popupId = computed(() => overlayControlledId("daterange", this.fieldId) ?? "");

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("daterange", { widgetId: this.fieldId, open: this.open() })!,
  );

  protected readonly lastFocused = signal<"start" | "end">("start");

  private readonly calendarRef =
    viewChild<MdyRangeCalendarComponent>("calendar");

  private readonly locale = inject(MDY_DATE_LOCALE);
  private readonly injector = inject(Injector);
  protected readonly i18n = inject(MDY_I18N_MESSAGES);


  protected readonly displayStart = computed(() => isoDateText(this.value()?.start));
  protected readonly displayEnd = computed(() => isoDateText(this.value()?.end));

  protected readonly modalDisplayValue = computed((): string => {
    const s = this.parsedStart();
    const e = this.parsedEnd();

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

  protected override onBeforeOpen(): void {
    afterNextRender(() => {
      const cal = this.calendarRef();
      if (!cal) return;
      cal.syncView(this.parsedStart(), this.parsedEnd());
      cal.focusFocusedDate();
    }, { injector: this.injector });
  }

  protected onRangePicked(range: {
    readonly start: CalendarDate;
    readonly end: CalendarDate;
  }): void {
    this.commitRange(formatIsoDate(range.start), formatIsoDate(range.end));
    this.closeOverlay();
  }

  protected onEndpointInput(event: Event, endpoint: "start" | "end"): void {
    const raw = inputText(event).trim();
    const current = this.value() ?? { start: null, end: null };
    if (!raw) {
      this.commitRange(
        endpoint === "start" ? null : current.start,
        endpoint === "end" ? null : current.end,
      );
      return;
    }
    const parsed = parseIsoDate(raw);
    if (!parsed) return;
    const iso = formatIsoDate(parsed);
    const filter = this.dateFilter();
    if (filter !== null && !filter(iso)) return;
    this.commitRange(
      endpoint === "start" ? iso : current.start,
      endpoint === "end" ? iso : current.end,
    );
  }

  protected onEndpointBlur(event: FocusEvent, endpoint: "start" | "end"): void {
    this.dispatchValueBlur("daterange");
    (event.target as HTMLInputElement).value =
      endpoint === "start" ? this.displayStart() : this.displayEnd();
  }

  private commitRange(start: string | null, end: string | null): void {
    const next = dateRangeValueTransition(
      { start, end },
      { minIso: this.minDate(), maxIso: this.maxDate(), accepts: this.dateFilter() },
    );
    this.dispatchValueIntent<MdyDateRange | null>("daterange", { type: "select", value: next });
  }
}
