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
} from "@modyra/core/time-utils";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MdyTimepickerClockComponent } from "./timepicker-clock.component";

/**
 * Timepicker renderer — M3-style input with clock overlay.
 */
@Component({
  selector: "mdy-control-timepicker",
  standalone: true,
  imports: [
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
          [value]="value() || ''"
          [disabled]="isDisabled()"
          [placeholder]="effectivePlaceholder()"
          (change)="onInputChange($event)"
          (focus)="onInputFocus($event)"
          (blur)="onInputBlur($event)"
          (keydown.arrowdown)="openOverlay($event); $event.preventDefault()"
          [attr.aria-invalid]="hasErrors()"
          [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
          [attr.aria-required]="ariaRequired() || isRequired()"
          [attr.aria-disabled]="effectiveAriaDisabled()"
          [attr.aria-label]="label() || null"
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

      <mdy-overlay-panel
        [open]="open()"
        [position]="position()"
        [alignment]="alignment()"
        [coords]="coords()"
        [maxHeight]="maxHeight()"
        [hasBackdrop]="position() === 'overlay'"
        [widthMode]="'auto-content'"
        [panelClass]="'mdy-timepicker__popup'"
        (close)="closeOverlay()"
      >
        <mdy-timepicker-clock
          [value]="draftValue()"
          [format]="format()"
          [disabled]="isDisabled()"
          (timePicked)="onTimePicked($event)"
          (cancelClicked)="closeOverlay()"
          (confirmClicked)="confirmPicker()"
        />
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
export class MdyTimepickerComponent extends MdyOverlayControl<string | null> {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly placeholder = input<string>("");
  /**
   * Value and display format: `"12h"` uses `"hh:mm AM/PM"` strings,
   * `"24h"` uses `"HH:mm"` (00-23). The clock overlay adapts (no AM/PM
   * toggle, 0-23 hour input) — the field value follows this format.
   */
  readonly format = input<MdyTimeFormat>("12h");
  protected override readonly minSpace = 450;

  protected readonly effectivePlaceholder = computed(() =>
    this.placeholder() || (this.format() === "24h" ? "HH:mm" : "hh:mm AM/PM"),
  );

  protected readonly fieldId = `mdy-control-timepicker-${MdyBaseControl.nextId()}`;
  protected readonly draftValue = signal<string | null>(null);
  private readonly injector = inject(Injector);

  protected override onBeforeOpen(): void {
    // The clock's internal model is canonical 12h; convert the (possibly
    // 24h) field value at the boundary. Empty defaults to the current time
    // so the OK button picks it immediately.
    const parsed = parseAnyTime(this.value(), this.format());
    this.draftValue.set(parsed ? formatTime(parsed) : getCurrentTime());
  }

  protected onTimePicked(time: string): void {
    this.draftValue.set(time);
  }

  protected confirmPicker(): void {
    const draft = parseTime(this.draftValue());
    const next = draft ? formatTimeAs(draft, this.format()) : null;
    if (next !== null && next !== this.value()) {
      this.setValue(next);
      this.markAsDirty();
    }
    this.closeOverlay();
  }

  /**
   * Commit-style parsing on `change` (blur/Enter), not on every keystroke:
   * updating the value mid-typing made the `[value]` binding rewrite the
   * input and wipe the user's text (R4). Unparsable text leaves the value
   * untouched — the blur handler reverts the display.
   */
  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim().toUpperCase();
    if (!raw) {
      this.setValue(null);
      this.markAsDirty();
      return;
    }
    const parsed = parseAnyTime(raw, this.format());
    if (parsed) {
      const formatted = formatTimeAs(parsed, this.format());
      if (this.value() !== formatted) {
        this.setValue(formatted);
        this.markAsDirty();
      }
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
    // Revert any unparsed/rejected text to the canonical value (R4).
    (event.target as HTMLInputElement).value = this.value() || "";
    this.markAsTouched();
  }
}
