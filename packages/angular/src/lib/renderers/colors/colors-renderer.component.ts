import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";

import { MDY_WIDGET_CONTRACTS, colorValueEquals, colorValueTransition, popupPlacementClass, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
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
  imports: [MdyPartDirective, 
    NgClass,
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
            aria-haspopup="dialog"
            [attr.aria-label]="i18n.colorPresetsHeader"
            (click)="toggleOverlay($event); $event.stopPropagation()"
          >
            <div
              class="mdy-colors__preview-swatch"
              [style.background-color]="value() || '#4361ee'"
            ></div>
          </button>
          <!--
            The native colour input was *inside* the button above: an invisible type=color
            stretched over it, aria-hidden, tabindex -1, with a click handler that opened this
            renderer's own popup and called preventDefault so the OS picker never appeared. A
            focusable control inside a focusable control is nested-interactive, and serious - the
            button beneath it already carried the same handler, the same disabled state and the
            accessible name, so what the input added was the defect.

            It is kept, outside the button, because it is what a form post and an autofill see: the
            picker itself is this renderer's popup, and the HEX field beside it is the control a
            user types into. The foundation stops it taking a pointer, so it is no longer the
            invisible click surface it used to be.
          -->
          <input
            [id]="fieldId"
            type="color"
            aria-hidden="true"
            tabindex="-1"
            [value]="value() || '#4361ee'"
            [disabled]="isDisabled()"
            (input)="onInput($event)"
            class="mdy-colors__native-hidden"
          />

          <!-- Input: HEX (accessible control) -->
          <input
            [id]="hexInputId"
            type="text"
            [value]="value() ?? ''"
            [placeholder]="placeholder()"
            [disabled]="isDisabled()"
            [attr.aria-label]="label() || i18n.colorHexLabel"
            [attr.aria-invalid]="touched() && hasErrors() ? 'true' : null"
            [attr.aria-describedby]="describedById(fieldId)"
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
            [mdyPart]="openerPart()"
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
        [dialogLabel]="i18n.colorPresetsHeader"
        [widthMode]="'auto-content'"
        (close)="closeOverlay()"
      >
        <div
          class="mdy-colors__dropdown mdy-popup mdy-overlay"
          [id]="popupId()"
          [ngClass]="placementClass()"
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
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "colors" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.colors;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");

  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  readonly placeholder = input<string>("#000000");
  readonly presets = input<readonly string[]>([
    "#4361ee", "#7209b7", "#f72585", "#4cc9f0", "#4895ef",
    "#18181b", "#ffffff", "#e63946", "#f59e0b", "#10b981"
  ]);

  protected readonly fieldId = `mdy-control-colors-${MdyBaseControl.nextId()}`;

  /** The id the opener names, which the projected panel has to carry. */
  protected readonly popupId = computed(() => overlayControlledId("colors", this.fieldId) ?? "");

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("colors", { widgetId: this.fieldId, open: this.open() })!,
  );
  protected readonly hexInputId = `${this.fieldId}-hex`;

  /**
   * Which side the palette ended up on, named by the catalog rather than spelled here.
   *
   * `above` and `overlay` are declared states of the colors `popup` part, so the class comes from
   * `popupPlacementClass` — the call every renderer makes.
   */
  protected readonly placementClass = computed(() => popupPlacementClass("colors", this.position()) ?? "");

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
