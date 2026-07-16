import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdySelectOption } from "../../core/types";

/**
 * Radio Group renderer component.
 */
@Component({
  selector: "mdy-control-radio",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 
    class: "mdy-renderer mdy-renderer--radio-group",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <!-- The group is labelled via aria-labelledby on the radiogroup: the label
         gets a real id and no [for] (there is no single input to point to, B33). -->
    <mdy-control-label
      [label]="label()"
      [labelId]="fieldId + '-label'"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    <div
      class="mdy-radio-group"
      [class.mdy-radio-group--horizontal]="layout() === 'horizontal'"
      role="radiogroup"
      [attr.aria-labelledby]="label() ? fieldId + '-label' : null"
    >
      @for (opt of options(); track opt.value) {
        <label class="mdy-radio-item" [class.mdy-radio-item--disabled]="isDisabled()">
          <input
            type="radio"
            [name]="fieldId"
            [value]="opt.value"
            [checked]="value() === opt.value"
            [disabled]="isDisabled()"
            (change)="onSelectionChange(opt.value)"
            (blur)="markAsTouched()"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="ariaRequired() || isRequired()"
          />
          <span class="mdy-radio-circle"></span>
          <span class="mdy-radio-label">{{ opt.label }}</span>
        </label>
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
export class MdyRadioGroupComponent<TValue = unknown> extends MdyBaseControl<TValue | null> {
  readonly options = input<readonly MdySelectOption<TValue>[]>([]);
  readonly layout  = input<"vertical" | "horizontal">("vertical");

  protected readonly fieldId = `mdy-control-radio-${MdyBaseControl.nextId()}`;

  protected onSelectionChange(value: TValue): void {
    if (this.isDisabled()) return;
    this.setValue(value);
    this.markAsDirty();
  }
}
