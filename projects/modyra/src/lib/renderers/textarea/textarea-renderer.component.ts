import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";

/**
 * Textarea renderer component.
 */
@Component({
  selector: "mdy-control-textarea",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--textarea",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="!!value()"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />
    <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
      @if (prefix(); as p) {
        <div class="mdy-input-prefix">
          <ng-container [ngTemplateOutlet]="p.template" />
        </div>
      }
      <textarea
        [id]="fieldId"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [rows]="rows()"
        (input)="onInput($event)"
        (blur)="markAsTouched()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-label]="label() || null"
      ></textarea>
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
export class MdyTextareaComponent extends MdyBaseControl<string | null> {
  readonly placeholder = input<string>("");
  readonly rows = input<number>(3);

  protected readonly fieldId = `mdy-control-textarea-${MdyBaseControl.nextId()}`;

  protected onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.setValue(target.value);
    this.markAsDirty();
  }
}
