import { Directive, input } from "@angular/core";
import { max } from "@modyra/core";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates numeric maximum in declarative mode.
 *
 * ```html
 * <mdy-control-number name="age" [mdyMax]="99" />
 * <mdy-control-number name="age" [mdyMax]="99" mdyMaxMessage="Valore troppo alto" />
 * ```
 */
@Directive({ selector: "[mdyMax]", standalone: true })
export class MdyMaxDirective extends MdyValidatorBaseDirective {
  readonly mdyMax = input.required<number | string>();
  readonly mdyMaxMessage = input<string | undefined>(undefined);

  protected buildValidators() {
    return {
      validators: [max(Number(this.mdyMax()), this.mdyMaxMessage())],
    };
  }
}
