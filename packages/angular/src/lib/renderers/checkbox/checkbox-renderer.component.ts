import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { createBooleanFieldController, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";

@Component({
  selector: "mdy-control-checkbox",
  standalone: true,
  imports: [NgTemplateOutlet, MdyErrorListComponent, MdyPartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--checkbox",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <div class="mdy-checkbox">
      <input
        type="checkbox"
        [class]="widgetContract.parts.control.classes.join(' ')"
        [id]="fieldId"
        [checked]="value()"
        [disabled]="isDisabled()"
        (change)="onChange($event)"
        (blur)="onBlur()"
        [attr.aria-label]="controlAriaLabel()"
        [mdyPart]="controlPart()"
      />
      <label
        class="mdy-label"
        [for]="fieldId"
        [title]="inlineErrorShown() ? inlineErrorText() : null"
      >
        <span [class]="widgetContract.parts.indicator.classes.join(' ')" aria-hidden="true"></span>
        {{ label() }}
        @if (label() && isRequired()) {
          <span class="mdy-label__required" aria-hidden="true">*</span>
        }
      </label>
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
export class MdyCheckboxComponent extends MdyBaseControl<boolean> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.checkbox;
  protected override readonly widgetKind = "checkbox";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");

  private readonly controller = this.adoptFieldController((handle, widgetId) =>
    createBooleanFieldController({ widgetId, handle: handle as never, variant: "checkbox" }));

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.controller()?.dispatch({ type: input.checked ? "check" : "uncheck" });
  }

  protected onBlur(): void {
    this.controller()?.dispatch({ type: "blur" });
  }
}
