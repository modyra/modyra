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
} from "@angular/core";
import {
  formatTime,
  formatTimeAs,
  getCurrentTime,
  MdyTimeFormat,
  parseAnyTime,
  parseTime,
} from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS,
  timeDraftTransition,
  timeInputTransition,
  type MdyTimeDraftState, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyTimepickerClockComponent } from "./timepicker-clock.component";

@Component({
  selector: "mdy-control-timepicker",
  standalone: true,
  imports: [MdyPartDirective, 
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyTimepickerClockComponent,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './timepicker-renderer.component.scss',
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--timepicker",
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

    <div class="mdy-timepicker" #wrapper>
      <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
        @if (prefix(); as p) {
           <div class="mdy-input-prefix">
             <ng-container [ngTemplateOutlet]="p.template" />
           </div>
        }
        <input
          #inputEl
          type="text"
          [id]="fieldId"
          class="mdy-timepicker__input"
          [mdyPart]="openerPart()"
          [value]="value() || ''"
          [disabled]="isDisabled()"
          [placeholder]="effectivePlaceholder()"
          (change)="onInputChange($event)"
          (focus)="onInputFocus($event)"
          (blur)="onInputBlur($event)"
          (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
          [attr.aria-invalid]="paintsAsInvalid()"
          [attr.aria-describedby]="describedById(fieldId)"
          [attr.aria-label]="controlAriaLabel()"
          [attr.aria-required]="ariaRequired() || isRequired()"
          [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-haspopup]="'dialog'"
          autocomplete="off"
        />
        <div class="mdy-input-suffix">
          @if (suffix(); as s) {
            <ng-container [ngTemplateOutlet]="s.template" />
          } @else {
            <button
              type="button"
              class="mdy-timepicker__toggle"
              [disabled]="isDisabled()"
              [attr.aria-label]="i18n.timepickerOpenLabel"
              [attr.aria-expanded]="open()"
              [attr.aria-haspopup]="'dialog'"
              tabindex="-1"
              (click)="toggleOverlay($event)"
            >
              <mdy-icon name="CLOCK" class="mdy-timepicker__icon" />
            </button>
          }
        </div>
      </div>

      <!-- The clock inside declares no dialog of its own, so this panel is the dialog and carries
           the name. A modal panel with no name is what axe reports as a dialog-name violation. -->
      <mdy-overlay-panel
        [open]="open()"
        [position]="position()"
        [alignment]="alignment()"
        [coords]="coords()"
        [hasBackdrop]="position() === 'overlay'"
        [dialogLabel]="i18n.timepickerOpenLabel"
        [widthMode]="'auto-content'"
        [panelClass]="popupClass"
        [panelId]="popupId()"
        [kind]="'timepicker'"
        (close)="closeOverlay()"
      >
        <mdy-timepicker-clock
          [value]="draftValue()"
          [open]="open()"
          [format]="format()"
          [disabled]="isDisabled()"
          (timePicked)="onTimePicked($event)"
          (cancelClicked)="cancelPicker()"
          (confirmClicked)="confirmPicker()"
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
export class MdyTimepickerComponent extends MdyOverlayControl<string | null> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.timepicker.parts.popup.classes.join(" ");
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "timepicker" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.timepicker;
  protected override readonly widgetKind = "timepicker" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly placeholder = input<string>("");
  readonly format = input<MdyTimeFormat>("12h");
  protected override readonly minSpace = 450;

  protected readonly effectivePlaceholder = computed(() =>
    this.placeholder() || (this.format() === "24h" ? "HH:mm" : "hh:mm AM/PM"),
  );

  protected readonly fieldId = `mdy-control-timepicker-${MdyBaseControl.nextId()}`;

  /** The id the opener names — the dialog, which is what carries the overlay's role. */
  protected readonly popupId = computed(() => overlayControlledId("timepicker", this.fieldId) ?? "");

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("timepicker", { widgetId: this.fieldId, open: this.open() })!,
  );
  private readonly timeDraft = signal<MdyTimeDraftState>({ committed: null, draft: getCurrentTime(), open: false });
  protected readonly draftValue = computed(() => this.timeDraft().draft);
  private readonly injector = inject(Injector);

  protected override onBeforeOpen(): void {
    const parsed = parseAnyTime(this.value(), this.format());
    const committed = parsed ? formatTime(parsed) : null;
    this.timeDraft.set(timeDraftTransition(
      this.timeDraft(),
      { type: "open", committed, fallback: getCurrentTime() },
    ).state);
  }

  protected onTimePicked(time: string): void {
    this.timeDraft.set(timeDraftTransition(this.timeDraft(), { type: "select", value: time }).state);
  }

  protected confirmPicker(): void {
    const transition = timeDraftTransition(this.timeDraft(), { type: "confirm" });
    this.timeDraft.set(transition.state);
    const draft = parseTime(transition.commit);
    const next = draft ? formatTimeAs(draft, this.format()) : null;
    if (next !== null && next !== this.value()) {
      this.dispatchValueIntent<string | null>("timepicker", { type: "select", value: next });
    }
    this.closeOverlay();
  }

  protected cancelPicker(): void {
    this.timeDraft.set(timeDraftTransition(this.timeDraft(), { type: "cancel" }).state);
    this.closeOverlay();
  }

  protected onInputChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const next = timeInputTransition(raw, (value) => {
      const parsed = parseAnyTime(value, this.format());
      return parsed ? formatTimeAs(parsed, this.format()) : null;
    });
    if (next !== undefined && next !== this.value()) {
      this.dispatchValueIntent<string | null>("timepicker", { type: "select", value: next });
    }
  }

  protected onInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (
      !input.value ||
      input.value === "00:00 AM" ||
      input.value === "00:00 PM"
    ) {
      afterNextRender(() => input.select(), { injector: this.injector });
    }
  }

  protected onInputBlur(event: FocusEvent): void {
    (event.target as HTMLInputElement).value = this.value() || "";
    this.dispatchValueBlur("timepicker");
  }
}
