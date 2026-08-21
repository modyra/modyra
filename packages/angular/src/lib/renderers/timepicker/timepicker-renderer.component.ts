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
} from "@angular/core";
import type { MdyTimeGranularity } from "@modyra/core";
import { MdyTimeFormat, buildTimeString, formatTimeAs, getCurrentTime, parseAnyTime, to24Hour } from "@modyra/core/datetime";
import {
  MDY_WIDGET_CONTRACTS,
  timeInputTransition,
  createTimepickerFieldController,
  overlayControlledId,
  projectOverlayOpenerA11y,
} from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl, type MdyOverlayOwner } from "../../core/overlay-control.directive";
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
          [readonly]="isReadonly()"
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
          [attr.aria-readonly]="isReadonly() ? 'true' : null"
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
          [granularity]="granularity()"
          [animateHand]="animateHand()"
          [open]="open()"
          [format]="format()"
          [disabled]="isDisabled()"
          (timePicked)="onTimePicked($event)"
          (dialPicked)="onDialPicked($event)"
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
  /**
   * Which clock this draws. Defaults to the 24-hour one, as every renderer does.
   *
   * A default that differs between adapters means one document renders a different clock in each of
   * them, which is the divergence a shared contract exists to prevent. Pass `"12h"` for the other.
   */
  readonly format = input<MdyTimeFormat>("24h");
  /**
   * Which times this field offers. Absent offers every one.
   *
   * The controller is told once, at construction, so a granularity that changes after the fact does
   * not silently rebuild the draft the user is editing.
   */
  readonly granularity = input<MdyTimeGranularity | undefined>(undefined);
  /** Whether the dial's hand moves rather than jumps. Off by default. */
  readonly animateHand = input<boolean>(false);
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
  /** The clock's draft, which the controller owns — this kind's value contract says `confirm`. */
  protected readonly controller = this.adoptFieldController((handle, widgetId) =>
    createTimepickerFieldController({
      widgetId,
      handle: handle as never,
      format: this.format(),
      ...(this.granularity() !== undefined && { granularity: this.granularity()! }),
    }),
  );
  protected readonly draftValue = computed(() => {
    const draft = this.controller()?.state().draft;
    return draft ? buildTimeString(draft.hour, draft.minute, draft.period) : getCurrentTime();
  });
  private readonly injector = inject(Injector);


  /** The controller's `open` is this kind's open state; see `MdyOverlayControl.overlayOwner`. */
  protected override overlayOwner(): MdyOverlayOwner | undefined {
    return this.controller() as MdyOverlayOwner | undefined;
  }

  protected override onBeforeOpen(): void {
    this.controller()?.dispatch({ type: "open" });
  }

  /**
   * A position on the face, sent as the position it is.
   *
   * The dial used to hand back a formatted time that this parsed with `parseTime` — the *12-hour*
   * parser, whatever the picker's format — so a 24-hour face could only ever name the twelve numbers
   * on its outer ring. The angle and the ring go to the controller, which owns what they mean.
   */
  protected onDialPicked(pick: { field: "hour" | "minute"; angle: number; ring: "outer" | "inner" }): void {
    this.controller()?.dispatch({ type: "set-from-angle", ...pick });
  }

  /**
   * A time chosen through the number fields or the period toggle.
   *
   * Read with the picker's own format: `parseTime` reads a 12-hour string and a 24-hour picker hands
   * back `"15:30"`, which it cannot. The hour goes out in the picker's format too — 0–23 for a
   * 24-hour clock — because that is the vocabulary `set-hour` speaks.
   */
  protected onTimePicked(time: string): void {
    const format = this.format();
    const parsed = parseAnyTime(time, format) ?? parseAnyTime(time, format === "12h" ? "24h" : "12h");
    const controller = this.controller();
    if (!parsed || !controller) return;
    controller.dispatch({ type: "set-hour", hour: format === "24h" ? to24Hour(parsed) : parsed.hour });
    controller.dispatch({ type: "set-minute", minute: parsed.minute });
    if (format === "12h") controller.dispatch({ type: "set-period", period: parsed.period });
  }

  protected confirmPicker(): void {
    this.controller()?.dispatch({ type: "confirm" });
    this.closeOverlay();
  }

  protected cancelPicker(): void {
    this.controller()?.dispatch({ type: "cancel" });
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
