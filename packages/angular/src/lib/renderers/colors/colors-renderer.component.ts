import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";

import { MDY_WIDGET_CONTRACTS, colorValueEquals, colorValueTransition } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOverlayControl } from "../../core/overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";

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
    "[class.mdy-renderer]": "widgetHasRootClass",
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
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.colors;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");

  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  readonly placeholder = input<string>("#000000");
  readonly presets = input<readonly string[]>([
    "#4361ee", "#7209b7", "#f72585", "#4cc9f0", "#4895ef",
    "#18181b", "#ffffff", "#e63946", "#f59e0b", "#10b981"
  ]);

  protected readonly fieldId = `mdy-control-colors-${MdyBaseControl.nextId()}`;
  protected readonly hexInputId = `${this.fieldId}-hex`;

  protected override onBeforeOpen(): void {
  }

  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.wrapperRef()?.nativeElement.contains(next)) {
      this.closeOverlay();
      this.dispatchValueBlur("colors");
    }
  }

  protected onInput(event: Event): void {
    this.applyColorIntent("native", (event.target as HTMLInputElement).value);
  }

  protected onHexBlur(event: FocusEvent): void {
    (event.target as HTMLInputElement).value = this.value() ?? "";
    this.dispatchValueBlur("colors");
  }

  protected onTextInput(event: Event): void {
    this.applyColorIntent("text", (event.target as HTMLInputElement).value);
  }

  protected selectColor(color: string): void {
    if (this.isDisabled()) return;
    this.applyColorIntent("preset", color);
  }

  protected isActiveColor(color: string): boolean {
    return colorValueEquals(this.value(), color);
  }

  private applyColorIntent(type: "native" | "text" | "preset", value: string): void {
    const transition = colorValueTransition({ type, value });
    if (transition.value !== undefined && transition.value !== this.value()) {
      this.dispatchValueIntent<string | null>("colors", { type: "select", value: transition.value });
    }
    if (transition.touched) this.dispatchValueBlur("colors");
    if (transition.close) this.closeOverlay();
  }
}
