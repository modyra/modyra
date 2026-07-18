import { Directive, inject, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as an input suffix (trailing content).
 */
@Directive({
  selector: "[mdySuffix]",
  standalone: true,
})
export class MdySuffixDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
