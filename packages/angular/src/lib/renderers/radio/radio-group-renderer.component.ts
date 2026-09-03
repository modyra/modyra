import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { createOptionFieldController, defaultWidgetIdFactory, fieldNameAttributes, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
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
      [words]="controlAriaLabel() ?? \'\'"
      [labelId]="labelId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div
      class="{{ cls.group }}"
      [class.mdy-radio-group--horizontal]="layout() === 'horizontal'"
      role="radiogroup"
      [mdyPart]="controlPart()"
      [attr.aria-labelledby]="namedBy()['aria-labelledby']"
      [attr.aria-label]="namedBy()['aria-label']"
    >
      @for (opt of options(); track opt.value) {
        <label class="{{ cls.option }}" [class.mdy-radio-item--disabled]="isDisabled()">
          <input
            type="radio"
            [name]="groupName()"
            [value]="opt.value"
            [checked]="value() === opt.value"
            [disabled]="isDisabled()"
            (change)="onSelectionChange(opt.value)"
            (blur)="onBlur()"
          />
          <span class="{{ cls.optionControl }}"></span>
          <span class="{{ cls.optionLabel }}">{{ opt.label }}</span>
        </label>
      }
    </div>

    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
    }
    <!-- Not an else: an error does not take the place of the instruction that would have prevented
         it, which is what the described-by projection says by naming both. Rendered as an
         alternative, a field that can fail lost its supporting text the moment the error container
         was reserved — and the reference to it went on naming an element no longer on the page. -->
    @if (projectedSupportingText(); as st) {
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)">{{ text }}</div>
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

  /**
   * Which attribute names the group, asked of the contract rather than answered here.
   *
   * Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so
   * an `aria-label` beside it is text nobody hears. Spelled out per template, the pair is what gets
   * written by accident — and what three renderers each answered separately. ADR 0175.
   */
  protected readonly namedBy = computed(() =>
    fieldNameAttributes({
      ariaLabel: this.ariaLabel(),
      label: this.label(),
      name: this.effectiveName(),
      labelId: this.labelId,
    }),
  );

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.radio;

  /**
   * The class every part and box wears, asked of the catalogue once. Spelled in the template it
   * is a second copy of a name the catalogue holds, and a copy is where the two can disagree.
   */
  // Class names the catalogue owns, resolved once. The type is deliberately the wide record
  // rather than the inferred shape: a component's declared surface must not change every time
  // its kind gains a part, and a key that is not a part of this kind is refused by the gate
  // that reads this file against the catalogue.
  protected readonly cls: Readonly<Record<string, string>> = {
    group: this.widgetContract.parts.group.classes.join(" "),
    option: this.widgetContract.parts.option.classes.join(" "),
    optionControl: this.widgetContract.parts.optionControl.classes.join(" "),
    optionLabel: this.widgetContract.parts.optionLabel.classes.join(" "),
    supportingText: this.widgetContract.parts.supportingText.classes.join(" "),
  } as const;
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
