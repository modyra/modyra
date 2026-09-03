import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import type { MdyFieldConstraints } from "@modyra/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyNumberSpinButtonsDirective } from "./number-spin-buttons.directive";
import { inputNumber } from "../renderer-projection";

@Component({
  selector: "mdy-control-number",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyNumberSpinButtonsDirective,
    MdyPartDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--number",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [words]="controlAriaLabel() ?? ''"
      [forId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />
    <div [class]="wrapperClasses()">
      @if (prefix(); as p) {
        <div class="mdy-input-prefix">
          <ng-container [ngTemplateOutlet]="p.template" />
        </div>
      }
      <input
        [id]="fieldId"
        type="number"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [readonly]="isReadonly()"
        (input)="onInput($event)"
        (blur)="dispatchValueBlur('number')"
        [attr.aria-label]="controlAriaLabel()"
        [mdyPart]="controlPart()"
        [mdyNumberSpinButtons]="showSpinButtons()"
        [mdyNumberSpinButtonsDisabled]="isDisabled()"
      />
      @if (suffix(); as s) {
        <div class="mdy-input-suffix">
          <ng-container [ngTemplateOutlet]="s.template" />
        </div>
      }
    </div>

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
    } @else {
      <!-- Drawn with nothing in it, and out of sight. The projection names this id
           whenever it describes the control, so an element that appears only once
           there are words leaves that reference pointing at nothing — the defect one
           step worse than an empty description. The two halves stay apart: the
           element is always here for a reference to land on, and describedById
           decides whether making the reference is worth a reader's move. -->
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)" hidden></div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
    }
  `,
})
export class MdyNumberComponent extends MdyBaseControl<number | null> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.number;

  /**
   * The class every part and box wears, asked of the catalogue once. Spelled in the template it
   * is a second copy of a name the catalogue holds, and a copy is where the two can disagree.
   */
  // Class names the catalogue owns, resolved once. The type is deliberately the wide record
  // rather than the inferred shape: a component's declared surface must not change every time
  // its kind gains a part, and a key that is not a part of this kind is refused by the gate
  // that reads this file against the catalogue.
  protected readonly cls: Readonly<Record<string, string>> = {
    supportingText: this.widgetContract.parts.supportingText.classes.join(" "),
  } as const;
  protected override readonly widgetKind = "number";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly minValue = input<number | null>(null);
  readonly maxValue = input<number | null>(null);
  readonly step = input<number | null>(null);
  /**
   * Whether this field draws the two steppers the catalogue declares for it.
   *
   * On by default, because the parts are the kind's anatomy: they carry `mdy-spin-btn`, the themes
   * paint them, and the native control's own arrows are suppressed by the foundation — so a field
   * that draws neither has no stepping affordance at all where the other renderers of this kind
   * have one. A consumer that wants the box alone turns them off.
   */
  readonly showSpinButtons = input<boolean>(true);

  /**
   * What this control asks for on top of the field's rules. It can only narrow: the projection takes
   * whichever end is tighter, so a control cannot offer a value the rules would refuse.
   */
  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    return { min: this.minValue(), max: this.maxValue(), step: this.step() };
  }


  protected onInput(event: Event): void {
    this.dispatchValueIntent<number | null>("number", { type: "input", value: inputNumber(event) });
  }
}
