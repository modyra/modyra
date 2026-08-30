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
      <!-- The track is anatomy: the catalogue declares it a part of every toggle, so it renders
           whether or not the field was given a label. It sits inside the label element because the
           native input is hidden and the label is what forwards a press to it — a track outside one
           draws a switch nothing can operate. A toggle with no label still gets the element,
           carrying the track and nothing else. -->
      <label class="mdy-toggle__label" [for]="fieldId">
        <span class="mdy-toggle__track" aria-hidden="true">
          <span class="mdy-toggle__thumb"></span>
        </span>
        @if (label()) {
          {{ label() }}
          @if (isRequired()) {
            <span class="mdy-label__required" aria-hidden="true">*</span>
          }
          @if (inlineErrorShown()) {
            <mdy-inline-error-icon [errorText]="inlineErrorText()" />
          }
        }
      </label>
      <!--
        The false half of the value, after the visible control. HTML leaves an unchecked box out of
        the payload altogether, so without this a person who said no and a form that never carried
        the question arrive identical at the other end.

        After, not before: a hidden input ahead of the visible control changes what the most obvious
        selector anybody writes — the first input in the field — actually finds.
      -->
      <input [mdyPart]="submitFalsePart()" />
    </div>
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
    }
    <!-- Not an else: an error does not take the place of the instruction that would have prevented
         it, which is what the described-by projection says by naming both. Rendered as an
         alternative, a field that can fail lost its supporting text the moment the error container
         was reserved — and the reference to it went on naming an element no longer on the page. -->
    @if (projectedSupportingText(); as st) {
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
export class MdyToggleComponent extends MdyBaseControl<boolean> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.toggle;
  protected override readonly widgetKind = "toggle";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");

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
