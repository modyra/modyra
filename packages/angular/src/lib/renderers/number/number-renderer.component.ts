import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import type { MdyFieldConstraints } from "@modyra/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyPartDirective } from "../../control/mdy-part.directive";
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
    MdyPartDirective,
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
      [showInlineError]="inlineErrorShown()"
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
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [readonly]="isReadonly()"
        [attr.aria-readonly]="isReadonly() ? 'true' : null"
        (input)="onInput($event)"
        (blur)="dispatchValueBlur('number')"
        [attr.aria-label]="controlAriaLabel()"
        [mdyPart]="controlPart()"
        [mdyNumberSpinButtons]="showSpinButtons()"
      />
      @if (suffix(); as s) {
        <div class="mdy-input-suffix">
          <ng-container [ngTemplateOutlet]="s.template" />
        </div>
      }
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
  `,
})
export class MdyNumberComponent extends MdyBaseControl<number | null> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.number;
  protected override readonly widgetKind = "number";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly minValue = input<number | null>(null);
  readonly maxValue = input<number | null>(null);
  readonly step = input<number | null>(null);
  readonly showSpinButtons = input<boolean>(false);

  /**
   * What this control asks for on top of the field's rules. It can only narrow: the projection takes
   * whichever end is tighter, so a control cannot offer a value the rules would refuse.
   */
  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    return { min: this.minValue(), max: this.maxValue(), step: this.step() };
  }


  protected onInput(event: Event): void {
    this.dispatchValueIntent<number | null>("number", { type: "input", value: inputNumber(event) });
  }
}
