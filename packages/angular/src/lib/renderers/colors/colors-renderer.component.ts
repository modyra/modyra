import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";

import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";

/**
 * Color picker renderer component.
 *
 * ```html
 * <mdy-control-colors name="primaryColor" label="Brand Color" />
 * ```
 */
@Component({
  selector: "mdy-control-colors",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--colors",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },

  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="hexInputId"
      [required]="isRequired()"
      [filled]="!!value()"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    <div class="mdy-colors" #wrapper [class.mdy-colors--open]="open()">
      <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">

        <!-- Color Preview -->
        <div class="mdy-input-wrapper__inliner">
          <button
            type="button"
            class="mdy-colors__primary-picker"
            [disabled]="isDisabled()"
            [attr.aria-expanded]="open()"
            aria-haspopup="dialog"
            [attr.aria-label]="i18n.colorPresetsHeader"
            (click)="toggleOverlay($event); $event.stopPropagation()"
          >
            <div
              class="mdy-colors__preview-swatch"
              [style.background-color]="value() || '#4361ee'"
            ></div>
            <!-- Native input is purely visual; the HEX text input is the accessible control -->
            <input
              [id]="fieldId"
              type="color"
              aria-hidden="true"
              tabindex="-1"
              [value]="value() || '#4361ee'"
              [disabled]="isDisabled()"
              (input)="onInput($event)"
              (click)="toggleOverlay($event); $event.stopPropagation(); $event.preventDefault()"
              class="mdy-colors__native-hidden"
            />
          </button>

          <!-- Input: HEX (accessible control) -->
          <input
            [id]="hexInputId"
            type="text"
            [value]="value() ?? ''"
            [placeholder]="placeholder()"
            [disabled]="isDisabled()"
            [attr.aria-label]="label() || i18n.colorHexLabel"
            [attr.aria-invalid]="touched() && hasErrors() ? 'true' : null"
            [attr.aria-describedby]="touched() && hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="isRequired() ? 'true' : null"
            [attr.aria-disabled]="isDisabled() ? 'true' : null"
            (input)="onTextInput($event)"
            (blur)="onHexBlur($event)"
            class="mdy-colors__hex-input"
            spellcheck="false"
          />

          <!-- Suffix: Presets Toggle -->
          <button
            type="button"
            class="mdy-input-suffix mdy-colors__toggle-area"
            [disabled]="isDisabled()"
            [attr.aria-expanded]="open()"
            aria-haspopup="listbox"
            [attr.aria-label]="i18n.colorPresetsHeader"
            (click)="toggleOverlay($event); $event.stopPropagation()"
          >
            <mdy-icon name="CHEVRON_DOWN" class="mdy-select__arrow" [class.mdy-select__arrow--open]="open()" />
          </button>
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
        (close)="closeOverlay()"
      >
        <div
          class="mdy-colors__dropdown"
          [class.mdy-colors__dropdown--above]="position() === 'above'"
          [class.mdy-colors__dropdown--overlay]="position() === 'overlay'"
        >
          <div class="mdy-colors__dropdown-header" aria-hidden="true">{{ i18n.colorPresetsHeader }}</div>
          <div
            class="mdy-colors__presets"
            role="listbox"
            [attr.aria-label]="i18n.colorPresetsHeader"
          >
            @for (color of presets(); track color) {
              <button
                type="button"
                role="option"
                class="mdy-color-swatch"
                [style.--color]="color"
                [class.mdy-color-swatch--active]="isActiveColor(color)"
                [attr.aria-selected]="isActiveColor(color)"
                [attr.aria-label]="i18n.selectColorPrefix + ' ' + color"
                (click)="selectColor(color)"
              ></button>
            }
          </div>
        </div>
      </mdy-overlay-panel>
    </div>

    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `
})
export class MdyColorsComponent extends MdyOverlayControl<string> {

  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  readonly placeholder = input<string>("#000000");
  readonly presets = input<readonly string[]>([
    "#4361ee", "#7209b7", "#f72585", "#4cc9f0", "#4895ef",
    "#18181b", "#ffffff", "#e63946", "#f59e0b", "#10b981"
  ]);

  protected readonly fieldId = `mdy-control-colors-${MdyBaseControl.nextId()}`;
  /** Separate id for the HEX text input — the accessible label target. */
  protected readonly hexInputId = `${this.fieldId}-hex`;

  protected override onBeforeOpen(): void {
    // Sync logic if needed
  }

  protected onBlur(event: FocusEvent): void {
    // Use relatedTarget to check where focus is going. When null
    // (click on non-focusable element), onDocumentClick handles closing.
    const next = event.relatedTarget as Node | null;
    if (next && !this.wrapperRef()?.nativeElement.contains(next)) {
      this.closeOverlay();
      this.markAsTouched();
    }
  }


  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateValue(target.value);
  }

  protected onHexBlur(event: FocusEvent): void {
    // Revert leftover invalid text to the committed value (R14).
    (event.target as HTMLInputElement).value = this.value() ?? "";
    this.markAsTouched();
  }

  protected onTextInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    let val = target.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(val)) {
      this.updateValue(val);
    }
  }

  protected selectColor(color: string): void {
    if (this.isDisabled()) return;
    this.updateValue(color);
    this.markAsTouched();
    this.closeOverlay();
  }

  /** Case-insensitive hex comparison: #FFF and #fff are the same color (B26). */
  protected isActiveColor(color: string): boolean {
    return (this.value() ?? "").toLowerCase() === color.toLowerCase();
  }

  private updateValue(val: string): void {
    this.setValue(val);
    this.markAsDirty();
  }
}
