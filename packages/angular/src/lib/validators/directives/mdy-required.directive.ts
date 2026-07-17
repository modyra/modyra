import { Directive, input } from "@angular/core";
import { required } from "@modyra/core";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Marks a control as required in declarative mode.
 *
 * ```html
 * <mdy-control-text name="email" mdyRequired />
 * <mdy-control-text name="email" [mdyRequired]="'Email obbligatoria'" />
 * ```
 */
@Directive({ selector: "[mdyRequired]", standalone: true })
export class MdyRequiredDirective extends MdyValidatorBaseDirective {
  /** Optional custom error message — pass as binding: [mdyRequired]="'...'" */
  readonly mdyRequired = input<string | undefined>(undefined);

  protected buildValidators() {
    // Attribute usage (`mdyRequired`) yields "" — fall back to the default
    // message instead of producing an empty error string (B13).
    return {
      validators: [required(this.mdyRequired() || undefined)],
      marksRequired: true,
    };
  }
}
