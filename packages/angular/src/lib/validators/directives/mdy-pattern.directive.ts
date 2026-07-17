import { Directive, input } from "@angular/core";
import { pattern } from "@modyra/core";
import { MdyValidatorBaseDirective } from "./validator-base.directive";

/**
 * Validates a RegExp pattern in declarative mode.
 *
 * ```html
 * <mdy-control-text name="code" [mdyPattern]="codeRegex" />
 * <mdy-control-text name="code" [mdyPattern]="codeRegex" mdyPatternMessage="Formato non valido" />
 * ```
 */
@Directive({ selector: "[mdyPattern]", standalone: true })
export class MdyPatternDirective extends MdyValidatorBaseDirective {
  readonly mdyPattern = input.required<RegExp | string>();
  readonly mdyPatternMessage = input<string | undefined>(undefined);

  protected buildValidators() {
    const raw = this.mdyPattern();
    const regex = raw instanceof RegExp ? raw : new RegExp(raw);
    return {
      validators: [pattern(regex, this.mdyPatternMessage())],
    };
  }
}
