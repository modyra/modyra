import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { createBooleanFieldController, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyInlineErrorIconComponent } from "../../control/inline-error-icon.component";

@Component({
  selector: "mdy-control-toggle",
  standalone: true,
  imports: [NgTemplateOutlet, MdyInlineErrorIconComponent, MdyErrorListComponent, MdyPartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--toggle",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <div class="mdy-toggle">
      <input
        type="checkbox"
        role="switch"
        [class]="widgetContract.parts.control.classes.join(' ')"
        [id]="fieldId"
        [checked]="value()"
        [disabled]="isDisabled()"
        (change)="onChange($event)"
        (blur)="onBlur()"
        [attr.aria-checked]="value()"
        [attr.aria-label]="controlAriaLabel()"
        [mdyPart]="controlPart()"
      />
      @if (label()) {
        <label class="mdy-toggle__label" [for]="fieldId">
          <span class="mdy-toggle__track" aria-hidden="true">
            <span class="mdy-toggle__thumb"></span>
          </span>
          {{ label() }}
          @if (isRequired()) {
            <span class="mdy-label__required" aria-hidden="true">*</span>
          }
          @if (inlineErrorShown()) {
            <mdy-inline-error-icon [errorText]="inlineErrorText()" />
          }
        </label>
      }
    </div>
    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyToggleComponent extends MdyBaseControl<boolean> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.toggle;
  protected override readonly widgetKind = "toggle";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  protected readonly fieldId = `mdy-control-toggle-${MdyBaseControl.nextId()}`;

  private readonly controller = this.adoptFieldController((handle, widgetId) =>
    createBooleanFieldController({ widgetId, handle: handle as never, variant: "switch" }));

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.controller()?.dispatch({ type: input.checked ? "check" : "uncheck" });
  }

  protected onBlur(): void {
    this.controller()?.dispatch({ type: "blur" });
  }
}
