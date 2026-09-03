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
    <div class="{{ cls.inputWrapper }}">
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
      <label class="{{ cls.label }}" [for]="fieldId">
        <span class="{{ cls.track }}" aria-hidden="true">
          <span class="{{ cls.thumb }}"></span>
        </span>
        @if (label()) {
          {{ label() }}
          @if (isRequired()) {
            <span class="{{ cls.requiredMarker }}" aria-hidden="true">*</span>
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
export class MdyToggleComponent extends MdyBaseControl<boolean> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.toggle;

  /**
   * The class every part and box wears, asked of the catalogue once. Spelled in the template it
   * is a second copy of a name the catalogue holds, and a copy is where the two can disagree.
   */
  // Class names the catalogue owns, resolved once. The type is deliberately the wide record
  // rather than the inferred shape: a component's declared surface must not change every time
  // its kind gains a part, and a key that is not a part of this kind is refused by the gate
  // that reads this file against the catalogue.
  protected readonly cls: Readonly<Record<string, string>> = {
    inputWrapper: this.widgetContract.parts.inputWrapper.classes.join(" "),
    label: this.widgetContract.parts.label.classes.join(" "),
    requiredMarker: this.widgetContract.parts.requiredMarker.classes.join(" "),
    supportingText: this.widgetContract.parts.supportingText.classes.join(" "),
    thumb: this.widgetContract.parts.thumb.classes.join(" "),
    track: this.widgetContract.parts.track.classes.join(" "),
  } as const;
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
