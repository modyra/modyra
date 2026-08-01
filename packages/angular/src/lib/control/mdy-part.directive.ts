import { Directive, ElementRef, effect, inject, input } from "@angular/core";
import { applyPart, type MdyPartContract } from "@modyra/widgets";

/**
 * Applies a widget part contract to the host element.
 *
 * ```html
 * <input [mdyPart]="controlPart()" [value]="value()" (input)="…" />
 * ```
 *
 * The part comes from a widget projection, which decides what a control exposes. A template binds
 * this instead of restating the semantics attribute by attribute, so an attribute added to the
 * projection reaches the DOM without the template being touched, and no two templates can expose a
 * different subset of a widget's states.
 *
 * Templates keep the bindings that are genuinely theirs: `[value]`, event handlers, structural
 * classes.
 */
@Directive({ selector: "[mdyPart]", standalone: true })
export class MdyPartDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mdyPart = input.required<MdyPartContract>();

  constructor() {
    // The projection is a computed over field state, so the attributes must follow it. `applyPart`
    // rewrites only what the contract controls, which makes re-applying safe on every change.
    effect(() => {
      applyPart(this.host.nativeElement, this.mdyPart());
    });
  }
}
