import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyNumberSpinButtonsDirective } from "./number-spin-buttons.directive";

/**
 * Number input renderer component.
 */
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
        [min]="minValue()"
        [max]="maxValue()"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        (input)="onInput($event)"
        (blur)="markAsTouched()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-label]="label() || null"
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
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyNumberComponent extends MdyBaseControl<number | null> {
  readonly placeholder = input<string>("");
  readonly minValue = input<number | null>(null);
  readonly maxValue = input<number | null>(null);
  readonly step = input<number>(1);
  readonly showSpinButtons = input<boolean>(false);

  protected readonly fieldId = `mdy-control-number-${MdyBaseControl.nextId()}`;

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.setValue(raw === "" ? null : Number(raw));
    this.markAsDirty();
  }
}
