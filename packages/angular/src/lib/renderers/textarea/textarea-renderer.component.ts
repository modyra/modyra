import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { nativeConstraintAttributes, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { inputText } from "../renderer-projection";

@Component({
  selector: "mdy-control-textarea",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--textarea",
    "[class.mdy-renderer]": "widgetHasRootClass",
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
        [readonly]="isReadonly()"
        [attr.aria-readonly]="isReadonly() ? 'true' : null"
        [rows]="rows()"
        [attr.minlength]="native()['minlength']"
        [attr.maxlength]="native()['maxlength']"
        (input)="onInput($event)"
        (blur)="dispatchValueBlur('textarea')"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="describedById(fieldId)"
        [attr.aria-label]="controlAriaLabel()"
        [attr.aria-required]="ariaRequired() || isRequired()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
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
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyTextareaComponent extends MdyBaseControl<string | null> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.textarea;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly rows = input<number>(3);

  /**
   * What the field's rules state, as this kind's own attributes. A textarea carries lengths and no
   * pattern — the platform ignores `pattern` here, and the translation says so once for everyone.
   */
  protected readonly native = computed(() =>
    nativeConstraintAttributes("textarea", this.fieldState().constraints()),
  );

  protected readonly fieldId = `mdy-control-textarea-${MdyBaseControl.nextId()}`;

  protected onInput(event: Event): void {
    this.dispatchValueIntent<string | null>("textarea", { type: "input", value: inputText(event) });
  }
}
