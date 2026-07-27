import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";

@Component({
  selector: "mdy-control-checkbox",
  standalone: true,
  imports: [NgTemplateOutlet, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--checkbox",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <label class="mdy-checkbox">
      <input
        type="checkbox"
        [id]="fieldId"
        [checked]="value()"
        [disabled]="isDisabled()"
        (change)="onChange($event)"
        (blur)="dispatchValueBlur('checkbox')"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-label]="label() || null"
      />
      <span
        class="mdy-label"
        [title]="(inlineErrors && touched() && hasErrors()) ? inlineErrorText() : null"
      >
        {{ label() }}
        @if (label() && isRequired()) {
          <span class="mdy-label__required" aria-hidden="true">*</span>
        }
      </span>
    </label>
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyCheckboxComponent extends MdyBaseControl<boolean> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.checkbox;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly fieldId = `mdy-control-checkbox-${MdyBaseControl.nextId()}`;

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dispatchValueIntent<boolean>("checkbox", { type: "input", value: input.checked });
  }
}
