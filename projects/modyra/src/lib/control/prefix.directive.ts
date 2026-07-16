import { Directive, TemplateRef } from "@angular/core";

/**
 * Marks a template or element as an input prefix (leading content).
 */
@Directive({
  selector: "[mdyPrefix]",
  standalone: true,
})
export class MdyPrefixDirective {
  constructor(public readonly template: TemplateRef<unknown>) {}
}
