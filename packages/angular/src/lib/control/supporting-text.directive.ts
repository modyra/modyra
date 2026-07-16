import { Directive, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as supporting text (helper text).
 */
@Directive({
  selector: "[mdySupportingText]",
  standalone: true,
})
export class MdySupportingTextDirective {
  constructor(public readonly template: TemplateRef<unknown>) {}
}
