import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, Injector, input, OnInit } from "@angular/core";
import {
  createOptionFieldController,
  MDY_WIDGET_CONTRACTS,
  type MdyOptionFieldController,
} from "@modyra/widgets";
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
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <!-- The group is labelled via aria-labelledby on the radiogroup: the label
         gets a real id and no [for] (there is no single input to point to, B33). -->
    <mdy-control-label
      [label]="label()"
      [labelId]="fieldId + '-label'"
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
      [attr.aria-labelledby]="label() ? fieldId + '-label' : null"
    >
      @for (opt of options(); track opt.value) {
        <label class="mdy-radio-item" [class.mdy-radio-item--disabled]="isDisabled()">
          <input
            type="radio"
            [name]="fieldId"
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

    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyRadioGroupComponent<TValue = unknown> extends MdyBaseControl<TValue | null> implements OnInit {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.radio;
  protected override readonly widgetKind = "radio" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly options = input<readonly MdySelectOption<TValue>[]>([]);
  readonly layout  = input<"vertical" | "horizontal">("vertical");

  protected readonly fieldId = `mdy-control-radio-${MdyBaseControl.nextId()}`;

  private readonly injector = inject(Injector);
  private controller: MdyOptionFieldController<TValue> | undefined;

  override ngOnInit(): void {
    this.controller = this.adoptFieldController((handle, widgetId) =>
      createOptionFieldController<TValue>({
        widgetId,
        handle: handle as never,
        options: this.options(),
        variant: "radio",
      }),
    );
    // The list is an input, so it can be replaced after the controller exists — the controller is
    // told rather than rebuilt, because rebuilding forgets which option the keyboard was on. The
    // injector is passed because this runs in `ngOnInit`, which is not an injection context.
    effect(() => this.controller?.setOptions(this.options()), { injector: this.injector });
    super.ngOnInit();
  }


  protected onSelectionChange(value: TValue): void {
    if (this.controller) {
      this.controller.dispatch({ type: "select", optionKey: String(value) });
      return;
    }
    this.dispatchValueIntent<TValue | null>("radio", { type: "select", value });
  }

  protected onBlur(): void {
    if (this.controller) {
      this.controller.dispatch({ type: "blur" });
      return;
    }
    this.dispatchValueBlur("radio");
  }
}
