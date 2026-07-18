import { Directive, inject, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as supporting text (helper text).
 */
@Directive({
  selector: "[mdySupportingText]",
  standalone: true,
})
export class MdySupportingTextDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
