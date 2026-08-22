import {
  contentChild,
  Directive,
  inject,
  Injector,
  output,
  TemplateRef,
} from "@angular/core";
import { MdyOptionDirective } from "../control/option.directive";
import { MDY_I18N_MESSAGES } from "../core/i18n";
import { MdyOptionsOverlayControl } from "../core/options-overlay-control.directive";
import { MdyOptionsControl, MdySelectOption } from "../core/types";
import { findProjectedOption, projectionKey } from "./renderer-projection";

@Directive()
export abstract class MdyDropdownBase<TValue, TOptionValue = unknown>
  extends MdyOptionsOverlayControl<TValue, TOptionValue>
  implements MdyOptionsControl<TOptionValue>
{
  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  protected readonly injector = inject(Injector);

  protected override readonly minSpace = 250;

  readonly selectionChange = output<MdySelectOption<TOptionValue>>();

  protected readonly optionTpl = contentChild(MdyOptionDirective, {
    read: TemplateRef,
  });


  public abstract resetSelection(): void;

  protected optionKey(value: TOptionValue): string {
    return projectionKey(value);
  }

  protected optionFor(value: unknown): MdySelectOption<TOptionValue> | undefined {
    return findProjectedOption(this.effectiveOptions(), value);
  }

  protected override onBeforeOpen(): void {
    this.searchQuery.set("");
    this.searchChanged.emit("");
  }
}
