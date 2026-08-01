import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyInlineErrorIconComponent } from "../../control/inline-error-icon.component";

@Component({
  selector: "mdy-control-toggle",
  standalone: true,
  imports: [NgTemplateOutlet, MdyInlineErrorIconComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--toggle",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <label class="mdy-toggle">
      <input
        type="checkbox"
        role="switch"
        [class]="widgetContract.parts.control.classes.join(' ')"
        [id]="fieldId"
        [checked]="value()"
        [disabled]="isDisabled()"
        (change)="onChange($event)"
        (blur)="dispatchValueBlur('toggle')"
        [attr.aria-checked]="value()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="describedById(fieldId)"
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
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.toggle;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly fieldId = `mdy-control-toggle-${MdyBaseControl.nextId()}`;

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dispatchValueIntent<boolean>("toggle", { type: "input", value: input.checked });
  }
}
