import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { createOptionFieldController, defaultWidgetIdFactory, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdySelectOption } from "../../core/types";

@Component({
  selector: "mdy-control-radio",
  standalone: true,
  imports: [MdyPartDirective, NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--radio-group",
    "[class.mdy-renderer]": "widgetHasRootClass",
  },
  template: `
    <!-- And a spoken name where there is no caption to point at: a group with neither is
         announced as its role and nothing else, which says there is a set of choices here
         and not what it is asking. The group is labelled via aria-labelledby on the radiogroup: the label
         gets a real id and no [for] (there is no single input to point to, B33). -->
    <mdy-control-label
      [label]="label()"
      [labelId]="labelId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div
      class="mdy-radio-group"
      [class.mdy-radio-group--horizontal]="layout() === 'horizontal'"
      role="radiogroup"
      [mdyPart]="controlPart()"
      [attr.aria-labelledby]="label() ? labelId : null"
      [attr.aria-label]="label() ? null : controlAriaLabel()"
    >
      @for (opt of options(); track opt.value) {
        <label class="mdy-radio-item" [class.mdy-radio-item--disabled]="isDisabled()">
          <input
            type="radio"
            [name]="groupName()"
            [value]="opt.value"
            [checked]="value() === opt.value"
            [disabled]="isDisabled()"
            (change)="onSelectionChange(opt.value)"
            (blur)="onBlur()"
          />
          <span class="mdy-radio-circle"></span>
          <span class="mdy-radio-label">{{ opt.label }}</span>
        </label>
      }
    </div>

    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
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
export class MdyRadioGroupComponent<TValue = unknown> extends MdyBaseControl<TValue | null> {
  /**
   * The group's label, named through the id factory rather than joined by hand.
   *
   * Every id this library publishes is `scope__part`, and a consumer that knows the scope composes
   * a part name the same way. A hyphen still yields a unique id and still works — and is unreachable
   * by anybody who builds the name instead of reading it off the element.
   */
  protected readonly labelId = defaultWidgetIdFactory.part(this.fieldId, "label");

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.radio;
  protected override readonly widgetKind = "radio" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly options = input<readonly MdySelectOption<TValue>[]>([]);
  readonly layout  = input<"vertical" | "horizontal">("vertical");


  private readonly controller = this.adoptFieldController(
    (handle, widgetId) => createOptionFieldController<TValue>(
      { widgetId, handle: handle as never, options: this.options(), variant: "radio" }),
    (c) => c.setOptions(this.options()),
  );

  protected onSelectionChange(value: TValue): void {
    this.controller()?.dispatch({ type: "select", optionKey: String(value) });
  }

  protected onBlur(): void {
    this.controller()?.dispatch({ type: "blur" });
  }
}
