import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { createTextFieldController, type MdyTextFieldController } from "@modyra/widgets";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";

@Component({
  selector: "mdy-control-text",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent, MdyPartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--text",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="!!value()"
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
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        [disabled]="isDisabled()"
        [readonly]="isReadonly()"
        [attr.aria-readonly]="isReadonly() ? 'true' : null"
        [attr.autocomplete]="autocomplete()"
        [mdyPart]="controlPart()"
        (input)="onInput($event)"
        (blur)="onBlur()"
        [attr.aria-label]="controlAriaLabel()"
      />
      @if (suffix(); as s) {
        <div class="mdy-input-suffix">
          <ng-container [ngTemplateOutlet]="s.template" />
        </div>
      }
    </div>

    @if (errorsReserved()) {
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
export class MdyTextComponent extends MdyBaseControl<string> implements OnInit {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.text;
  protected override readonly widgetKind = "text";
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly placeholder = input<string>("");
  readonly type = input<string>("text");
  readonly autocomplete = input<string | null>(null);

  private fieldController?: MdyTextFieldController<string>;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const handle = this.field();
    const autocomplete = this.autocomplete();
    if (handle) {
      this.fieldController = createTextFieldController({
        widgetId: this.fieldId,
        handle: handle as never,
        inputType: this.type(),
        ...(autocomplete ? { autocomplete } : {}),
      });
    }
    this.destroyRef.onDestroy(() => this.fieldController?.destroy());
    super.ngOnInit();
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (this.fieldController) {
      this.fieldController.dispatch({ type: "input", value: target.value });
    } else {
      this.dispatchValueIntent<string>("text", { type: "input", value: target.value });
    }
  }

  protected onBlur(): void {
    if (this.fieldController) {
      this.fieldController.dispatch({ type: "blur" });
    } else {
      this.dispatchValueBlur("text");
    }
  }
}
