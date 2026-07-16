import { Directive, input } from "@angular/core";
import { min } from "../../core/validators";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates numeric minimum in declarative mode.
 *
 * ```html
 * <mdy-control-number name="age" [mdyMin]="18" />
 * <mdy-control-number name="age" [mdyMin]="18" mdyMinMessage="Devi essere maggiorenne" />
 * ```
 */
@Directive({ selector: "[mdyMin]", standalone: true })
export class MdyMinDirective extends MdyValidatorBaseDirective {
  readonly mdyMin = input.required<number | string>();
  readonly mdyMinMessage = input<string | undefined>(undefined);

  protected buildValidators() {
    return {
      validators: [min(Number(this.mdyMin()), this.mdyMinMessage())],
    };
  }
}
