import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";

/**
 * Text input renderer component.
 *
 * ```html
 * <mdy-control-text name="firstName" label="First Name" placeholder="Enter name" />
 * ```
 */
@Component({
  selector: "mdy-control-text",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--text",
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
      <input
        [id]="fieldId"
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [attr.autocomplete]="autocomplete()"
        (input)="onInput($event)"
        (blur)="markAsTouched()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-label]="label() || null"
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
export class MdyTextComponent extends MdyBaseControl<string> {
  readonly placeholder = input<string>("");
  readonly type = input<string>("text");
  readonly autocomplete = input<string | null>(null);

  protected readonly fieldId = `mdy-control-text-${MdyBaseControl.nextId()}`;

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setValue(target.value);
    this.markAsDirty();
  }
}
