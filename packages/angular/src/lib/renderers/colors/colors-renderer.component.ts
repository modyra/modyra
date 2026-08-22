import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
} from "@angular/core";

import { MDY_OVERLAY_PORTAL_CLASS } from "@modyra/widgets";
import { MDY_COLOR_PRESETS, MDY_WIDGET_CONTRACTS, colorValueEquals, keyBindingFor, rowRovingIndex, colorValueTransition, popupPlacementClass, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
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
      [widgetId]="fieldId"
      [required]="isRequired()"
      [filled]="!!value()"
      [showInlineError]="inlineErrorShown()"
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
            [mdyPart]="openerButtonPart()"
            [attr.aria-label]="i18n.colorPresetsHeader"
            (click)="toggleOverlay($event); $event.stopPropagation()"
          >
            <div
              class="mdy-colors__preview-swatch"
              [style.background-color]="value() || '#4361ee'"
            ></div>
          </button>
          <!--
            The native colour input sits outside the button, never inside it. A focusable control
            stretched over another focusable control is nested-interactive: the button already
            carries the handler, the disabled state and the accessible name, so an invisible
            type=color on top of it adds a defect and nothing else.

            It is kept because it is what a form post and an autofill see. The picker itself is this
            renderer's popup and the HEX field beside it is the control a user types into, so the
            foundation stops this input taking a pointer.
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
            [readonly]="isReadonly()"
            [attr.aria-label]="label() || i18n.colorHexLabel"
            [attr.aria-invalid]="paintsAsInvalid() ? 'true' : null"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
            [attr.aria-required]="isRequired() ? 'true' : null"
            [attr.aria-disabled]="isDisabled() ? 'true' : null"
            [attr.aria-readonly]="isReadonly() ? 'true' : null"
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
        [hasBackdrop]="position() === 'overlay'"
        [dialogLabel]="i18n.colorPresetsHeader"
        [widthMode]="'auto-content'"
        (close)="closeOverlay()"
      >
        <div
          [class]="popupClass"
          [id]="popupId()"
          [ngClass]="placementClass()"
        >
          <div class="mdy-colors__dropdown-header" aria-hidden="true">{{ i18n.colorPresetsHeader }}</div>
          <div
            class="mdy-colors__presets"
            role="listbox"
            [attr.aria-label]="i18n.colorPresetsHeader"
            (keydown)="onPresetKeydown($event)"
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

    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
  `
})
export class MdyColorsComponent extends MdyOverlayControl<string> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.colors.parts.popup.classes.join(" ") + " " + MDY_OVERLAY_PORTAL_CLASS;
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "colors" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.colors;
  protected override readonly widgetKind = "colors" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");

  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  readonly placeholder = input<string>("#000000");
  readonly presets = input<readonly string[]>(MDY_COLOR_PRESETS);


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

  /**
   * Into the row the palette has just shown.
   *
   * The keys the contract declares for an open colour field belong to the swatches, and `Tab`
   * dismisses the palette — so a palette that left the keyboard on the toggle was one no keyboard
   * could reach the presets in. The swatch holding the current value is where a person is.
   */
  protected override openOverlay(event?: Event): void {
    super.openOverlay(event);
    // After the render that draws the row — and the row is portalled, so on a real page it is not
    // there yet when the render this opening triggers completes. Tried again on the next frame for
    // that reason, and given up after it rather than looping: a palette that never drew is a
    // different defect, and a retry that never stops would hide it.
    afterNextRender(() => this.landOnASwatch(2), { injector: this.presetInjector });
  }

  /** Puts the keyboard on the swatch holding the value, or on the first, once the row exists. */
  private landOnASwatch(attemptsLeft: number): void {
    (this.hostElement.nativeElement as HTMLElement).dataset.landing = `try${attemptsLeft}:open=${this.open()}:n=${this.presetSwatches().length}`;
    if (!this.open()) return;
    const swatches = this.presetSwatches();
    if (swatches.length === 0) {
      if (attemptsLeft > 0) requestAnimationFrame(() => this.landOnASwatch(attemptsLeft - 1));
      return;
    }
    if (swatches.includes(this.hostElement.nativeElement.ownerDocument?.activeElement as HTMLButtonElement)) return;
    const held = swatches.find((_, index) => colorValueEquals(this.value(), this.presets()[index]));
    (held ?? swatches[0])?.focus();
  }

  private readonly presetInjector = inject(Injector);

  /** The swatches on the page, in the order the row draws them. */
  private presetSwatches(): readonly HTMLButtonElement[] {
    // By id rather than by selector: the popup is portalled out of this component, and an id built
    // from a field path holds dots — which a selector reads as classes.
    const root: Document | null = (this.hostElement.nativeElement as HTMLElement).ownerDocument;
    const popup = root?.getElementById(this.popupId()) ?? null;
    if (popup === null) return [];
    return Array.prototype.slice.call(popup.querySelectorAll(".mdy-color-swatch")) as HTMLButtonElement[];
  }

  /**
   * Walking the swatches, which are a listbox and answer like one.
   *
   * The row is real buttons, so the reading position is the focus itself. The keys are the
   * catalogue's and so is the direction: a row runs in the writing direction, and reading
   * `ArrowLeft` as "back" is wrong in a right-to-left document.
   */
  protected onPresetKeydown(event: KeyboardEvent): void {
    const binding = keyBindingFor("colors", event.key, true);
    if (!binding || binding.intent !== "move") return;
    const order = this.presetSwatches();
    const to = rowRovingIndex(event.key, order.indexOf(document.activeElement as HTMLButtonElement), order.length, binding.by);
    if (to === null) return;
    event.preventDefault();
    order[to]?.focus();
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
