import { Directive, input } from "@angular/core";
import { email } from "@modyra/core";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates e-mail format in declarative mode.
 *
 * ```html
 * <mdy-control-text name="email" mdyEmail />
 * <mdy-control-text name="email" [mdyEmail]="'Formato non valido'" />
 * ```
 */
@Directive({ selector: "[mdyEmail]", standalone: true })
export class MdyEmailDirective extends MdyValidatorBaseDirective {
  /** Optional custom error message. */
  readonly mdyEmail = input<string | undefined>(undefined);

  protected buildValidators() {
    return { validators: [email(this.mdyEmail() || undefined)] };
  }
}
