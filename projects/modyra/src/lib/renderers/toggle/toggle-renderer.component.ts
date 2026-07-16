import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyInlineErrorIconComponent } from "../../control/inline-error-icon.component";

/**
 * Toggle (switch) renderer component.
 */
@Component({
  selector: "mdy-control-toggle",
  standalone: true,
  imports: [NgTemplateOutlet, MdyInlineErrorIconComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 
    class: "mdy-renderer mdy-renderer--toggle",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <label class="mdy-toggle">
      <input
        type="checkbox"
        role="switch"
        [id]="fieldId"
        [checked]="value()"
        [disabled]="isDisabled()"
        (change)="onChange($event)"
        (blur)="markAsTouched()"
        [attr.aria-checked]="value()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-label]="label() || null"
      />
      <span class="mdy-toggle__track" aria-hidden="true">
        <span class="mdy-toggle__thumb"></span>
      </span>
      @if (label()) {
        <span class="mdy-toggle__label">
          {{ label() }}
          @if (isRequired()) {
            <span class="mdy-label__required" aria-hidden="true">*</span>
          }
          @if (inlineErrors && touched() && hasErrors()) {
            <mdy-inline-error-icon [errorText]="inlineErrorText()" />
          }
        </span>
      }
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
export class MdyToggleComponent extends MdyBaseControl<boolean> {
  protected readonly fieldId = `mdy-control-toggle-${MdyBaseControl.nextId()}`;

  protected onChange(event: Event): void {
    this.setValue((event.target as HTMLInputElement).checked);
    this.markAsDirty();
  }
}
