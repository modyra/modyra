import { Directive, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as an input suffix (trailing content).
 */
@Directive({
  selector: "[mdySuffix]",
  standalone: true,
})
export class MdySuffixDirective {
  constructor(public readonly template: TemplateRef<unknown>) {}
}
