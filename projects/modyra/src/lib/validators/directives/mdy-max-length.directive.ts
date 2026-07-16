import { Directive, input } from "@angular/core";
import { maxLength } from "../../core/validators";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates maximum length in declarative mode.
 *
 * ```html
 * <mdy-control-text name="bio" [mdyMaxLength]="200" />
 * <mdy-control-text name="bio" [mdyMaxLength]="200" mdyMaxLengthMessage="Troppo lungo" />
 * ```
 */
@Directive({ selector: "[mdyMaxLength]", standalone: true })
export class MdyMaxLengthDirective extends MdyValidatorBaseDirective {
  readonly mdyMaxLength = input.required<number | string>();
  readonly mdyMaxLengthMessage = input<string | undefined>(undefined);

  protected buildValidators() {
    return {
      validators: [
        maxLength(Number(this.mdyMaxLength()), this.mdyMaxLengthMessage()),
      ],
    };
  }
}
