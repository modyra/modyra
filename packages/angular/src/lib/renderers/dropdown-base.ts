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

/**
 * Shared base for dropdown renderers (select, multiselect).
 *
 * Owns the non-UI-specific concerns that the two renderers share:
 * i18n, injector, overlay min-space, option template query, selection
 * output, search-query lifecycle, and the reset contract. Subclasses
 * remain responsible for their specific value model, keyboard handling,
 * filtering and templates.
 */
@Directive()
export abstract class MdyDropdownBase<TValue, TOptionValue = unknown>
  extends MdyOptionsOverlayControl<TValue, TOptionValue>
  implements MdyOptionsControl<TOptionValue>
{
  /** Internationalized strings used by dropdown UI. */
  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  /** Injector for Angular effects and `afterNextRender` calls. */
  protected readonly injector = inject(Injector);

  /** Minimum viewport space required to anchor the dropdown. */
  protected override readonly minSpace = 250;

  /** Emitted when the user selects or toggles an option. */
  readonly selectionChange = output<MdySelectOption<TOptionValue>>();

  /** Custom option template provided via `<ng-template mdyOption>`. */
  protected readonly optionTpl = contentChild(MdyOptionDirective, {
    read: TemplateRef,
  });

  /** Stable field id used for labels, ARIA and option ids. */
  protected abstract readonly fieldId: string;

  /** Resets the control value to its empty state. */
  public abstract resetSelection(): void;

  /** Reset the search query every time the overlay opens. */
  protected override onBeforeOpen(): void {
    this.searchQuery.set("");
    this.searchChanged.emit("");
  }
}
