import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";

/**
 * Checkbox renderer component.
 *
 * ```html
 * <mdy-control-checkbox name="acceptTerms" label="I accept the terms" />
 * ```
 */
@Component({
  selector: "mdy-control-checkbox",
  standalone: true,
  imports: [NgTemplateOutlet, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 
    class: "mdy-renderer mdy-renderer--checkbox",
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
        (blur)="markAsTouched()"
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
  protected readonly fieldId = `mdy-control-checkbox-${MdyBaseControl.nextId()}`;

  protected onChange(event: Event): void {
    this.setValue((event.target as HTMLInputElement).checked);
    this.markAsDirty();
  }
}
