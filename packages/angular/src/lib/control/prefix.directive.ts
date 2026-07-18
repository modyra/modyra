import { Directive, inject, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as an input prefix (leading content).
 */
@Directive({
  selector: "[mdyPrefix]",
  standalone: true,
})
export class MdyPrefixDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
