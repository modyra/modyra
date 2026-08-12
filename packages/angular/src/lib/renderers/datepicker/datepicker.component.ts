import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
  Injector,
} from "@angular/core";
import {
  CalendarDate,
  formatIsoDate,
  parseIsoDate,
  parseLocalizedDate,
  today,
} from "@modyra/core/datetime";
import {
  createDatepickerFieldController,
  MDY_WIDGET_CONTRACTS,
  overlayControlledId,
  projectOverlayOpenerA11y,
} from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_DATE_LOCALE } from "../../core/date-locale";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { inputText } from "../renderer-projection";
import { MdyCalendarComponent } from "./calendar.component";

@Component({
  selector: "mdy-control-datepicker",
  standalone: true,
  imports: [MdyPartDirective, 
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
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
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
          [mdyPart]="openerPart()"
          [placeholder]="placeholder()"
          [value]="displayValue()"
          [disabled]="isDisabled()"
          (change)="onInputChange($event)"
          (blur)="onInputBlur($event)"
          [attr.aria-haspopup]="'dialog'"
          [attr.aria-invalid]="paintsAsInvalid()"
          [attr.aria-describedby]="describedById(fieldId)"
          [attr.aria-label]="controlAriaLabel()"
          [attr.aria-required]="ariaRequired() || isRequired()"
          [attr.aria-disabled]="effectiveAriaDisabled()"
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
                [attr.aria-expanded]="open()"
                [attr.aria-haspopup]="'dialog'"
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
        [hasBackdrop]="position() === 'overlay'"
        [widthMode]="'auto-content'"
        [panelClass]="popupClass"
        [kind]="'datepicker'"
        (close)="closeOverlay()"
      >
        @if (position() === 'overlay') {
           <div class="mdy-datepicker__modal-header">
              <span class="mdy-datepicker__modal-label">{{ label() || i18n.datepickerSelectFallback }}</span>
              <span class="mdy-datepicker__modal-value">{{ modalDisplayValue() }}</span>
           </div>
        }

        <mdy-calendar
        [gridId]="popupId()"
          #calendar
          [controller]="controller()"
          [selectedDate]="parsedSelectedDate()"
          [minDate]="parsedMinDate()"
          [maxDate]="parsedMaxDate()"
          [ariaLabel]="label() || i18n.datepickerChooseDate"
          (datePicked)="onDatePicked($event)"
          (closed)="closeOverlay()"
        />

      </mdy-overlay-panel>
    </div>

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyDatePickerComponent extends MdyOverlayControl<string | null> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.datepicker.parts.popup.classes.join(" ");
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "datepicker" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.datepicker;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("YYYY-MM-DD");
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  /**
   * Where the popup sits: hung off the control, or covering the viewport.
   *
   * Presentation and nothing else. It used to mean "modal *and* confirm before committing", which
   * contradicted this kind's own value contract (`commit: "live"`); what a field commits is the
   * contract's answer and a placement never changes it.
   */
  readonly variant = input<"docked" | "modal">("docked");

  protected override forceModalPlacement(): boolean {
    return this.variant() === "modal";
  }
  readonly displayFormat = input<"iso" | "localized">("localized");

  protected override readonly minSpace = 450;

  private readonly injector = inject(Injector);
  protected readonly fieldId = `mdy-control-datepicker-${MdyBaseControl.nextId()}`;

  protected readonly controller = this.adoptFieldController(
    (handle, widgetId) => createDatepickerFieldController({
      widgetId, handle: handle as never, minDate: this.minDate(), maxDate: this.maxDate(),
      firstDayOfWeek: this.locale.firstDayOfWeek }),
    (c) => c.setBounds(this.minDate(), this.maxDate()),
  );

  /** One committed date: the controller decides what the range and the field allow. */
  private commitDate(iso: string | null): void {
    this.controller()?.dispatch(iso === null ? { type: "clear" } : { type: "select-date", iso });
  }

  /** The id the opener names — the grid, which is what carries the overlay's role. */
  protected readonly popupId = computed(() => overlayControlledId("datepicker", this.fieldId) ?? "");

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("datepicker", { widgetId: this.fieldId, open: this.open() })!,
  );

  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  private readonly calendarRef = viewChild<MdyCalendarComponent>("calendar");
  private readonly locale = inject(MDY_DATE_LOCALE);


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
      const d = this.parsedSelectedDate() ?? today();
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
    afterNextRender(() => {
      const cal = this.calendarRef();
      if (!cal) return;
      cal.syncView(this.parsedSelectedDate());
      cal.focusFocusedDate();
    }, { injector: this.injector });
  }

  protected onDatePicked(date: CalendarDate): void {
    this.commitDate(formatIsoDate(date));
    this.closeOverlay();
  }

  protected onInputChange(event: Event): void {
    const raw = inputText(event).trim();
    if (!raw) {
      this.commitDate(null);
      return;
    }
    const parsed =
      this.displayFormat() === "localized"
        ? parseLocalizedDate(raw, this.locale.locale)
        : parseIsoDate(raw);
    if (parsed) this.commitDate(formatIsoDate(parsed));
  }

  protected onInputBlur(event: FocusEvent): void {
    (event.target as HTMLInputElement).value = this.displayValue();
    this.controller()?.dispatch({ type: "blur" });
  }
}
