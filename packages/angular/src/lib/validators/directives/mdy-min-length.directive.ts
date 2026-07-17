import { Directive, input } from "@angular/core";
import { minLength } from "@modyra/core";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates minimum length in declarative mode.
 *
 * ```html
 * <mdy-control-text name="username" [mdyMinLength]="3" />
 * <mdy-control-text name="username" [mdyMinLength]="3" mdyMinLengthMessage="Troppo corto" />
 * ```
 */
@Directive({ selector: "[mdyMinLength]", standalone: true })
export class MdyMinLengthDirective extends MdyValidatorBaseDirective {
  readonly mdyMinLength = input.required<number | string>();
  readonly mdyMinLengthMessage = input<string | undefined>(undefined);

  protected buildValidators() {
    return {
      validators: [
        minLength(Number(this.mdyMinLength()), this.mdyMinLengthMessage()),
      ],
    };
  }
}
