import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import {
  createBooleanFieldController,
  MDY_WIDGET_CONTRACTS,
  type MdyBooleanFieldController,
} from "@modyra/widgets";
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
    <label class="mdy-checkbox">
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
      <span [class]="widgetContract.parts.indicator.classes.join(' ')" aria-hidden="true"></span>
      <span
        class="mdy-label"
        [title]="inlineErrorShown() ? inlineErrorText() : null"
      >
        {{ label() }}
        @if (label() && isRequired()) {
          <span class="mdy-label__required" aria-hidden="true">*</span>
        }
      </span>
    </label>
    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyCheckboxComponent extends MdyBaseControl<boolean> implements OnInit {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.checkbox;
  protected override readonly widgetKind = "checkbox";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly fieldId = `mdy-control-checkbox-${MdyBaseControl.nextId()}`;

  private controller: MdyBooleanFieldController | undefined;

  override ngOnInit(): void {
    this.controller = this.adoptFieldController((handle, widgetId) =>
      createBooleanFieldController({ widgetId, handle: handle as never, variant: "checkbox" }),
    );
    super.ngOnInit();
  }

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.controller) {
      this.controller.dispatch({ type: input.checked ? "check" : "uncheck" });
      return;
    }
    this.dispatchValueIntent<boolean>("checkbox", { type: "input", value: input.checked });
  }

  protected onBlur(): void {
    if (this.controller) {
      this.controller.dispatch({ type: "blur" });
      return;
    }
    this.dispatchValueBlur("checkbox");
  }
}
