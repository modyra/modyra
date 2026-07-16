import { Directive } from "@angular/core";
import { MDY_INLINE_ERRORS } from "../core/tokens";

/**
 * Attribute directive that switches a renderer to inline error display.
 *
 * When applied to a renderer component, errors are shown in parentheses
 * next to the label instead of as a block below the input.
 *
 * ```html
 * <mdy-control-text name="email" label="Email" mdyInlineErrors />
 * ```
 */
@Directive({
  selector: "[mdyInlineErrors]",
  standalone: true,
  host: { class: "mdy-inline-errors" },
  providers: [{ provide: MDY_INLINE_ERRORS, useValue: true }],
})
export class MdyInlineErrorsDirective {}
