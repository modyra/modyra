import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyNumberSpinButtonsDirective } from "./number-spin-buttons.directive";
import { inputNumber } from "../renderer-projection";

@Component({
  selector: "mdy-control-number",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyNumberSpinButtonsDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--number",
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
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />
    <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
      @if (prefix(); as p) {
        <div class="mdy-input-prefix">
          <ng-container [ngTemplateOutlet]="p.template" />
        </div>
      }
      <input
        [id]="fieldId"
        type="number"
        [step]="step()"
        [attr.min]="effectiveMin()"
        [attr.max]="effectiveMax()"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [readonly]="isReadonly()"
        [attr.aria-readonly]="isReadonly() ? 'true' : null"
        (input)="onInput($event)"
        (blur)="dispatchValueBlur('number')"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="describedById(fieldId)"
        [attr.aria-label]="controlAriaLabel()"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [mdyNumberSpinButtons]="showSpinButtons()"
      />
      @if (suffix(); as s) {
        <div class="mdy-input-suffix">
          <ng-container [ngTemplateOutlet]="s.template" />
        </div>
      }
    </div>

    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyNumberComponent extends MdyBaseControl<number | null> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.number;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly minValue = input<number | null>(null);
  readonly maxValue = input<number | null>(null);
  readonly step = input<number>(1);
  readonly showSpinButtons = input<boolean>(false);

  /**
   * The range offered at the keyboard, from the field's own rules unless this control overrides it.
   *
   * A `min(0)`/`max(255)` in the schema is already the answer to "what may this hold"; making the
   * author write it again on the control is how the two come to disagree. An explicit binding still
   * wins — a control may narrow what it offers without changing what the field accepts.
   */
  protected readonly effectiveMin = computed(
    () => this.minValue() ?? this.fieldState().bounds().min,
  );
  protected readonly effectiveMax = computed(
    () => this.maxValue() ?? this.fieldState().bounds().max,
  );

  protected readonly fieldId = `mdy-control-number-${MdyBaseControl.nextId()}`;

  protected onInput(event: Event): void {
    this.dispatchValueIntent<number | null>("number", { type: "input", value: inputNumber(event) });
  }
}
