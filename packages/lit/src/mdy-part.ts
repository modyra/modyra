import { noChange } from "lit";
import { directive, Directive, PartType, type ElementPart, type PartInfo } from "lit/directive.js";
import { applyPart, type MdyPartContract } from "@modyra/widgets";

/**
 * Applies a widget part contract to the element it is placed on.
 *
 * ```ts
 * html`<input ${mdyPart(this.controlPart(handle))} .value=${…} @input=${…} />`
 * ```
 *
 * The part comes from a widget projection, which decides what a control exposes. An element binds
 * this instead of naming each ARIA attribute itself, so an attribute added to the projection reaches
 * the DOM without the template being touched, and no two elements can expose a different subset of
 * a widget's states.
 *
 * Elements keep the bindings that are genuinely theirs: `.value`, `?disabled`, event handlers.
 */
class MdyPartDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("mdyPart can only be used on an element, not on an attribute or in text");
    }
  }

  override render(_part: MdyPartContract): typeof noChange {
    return noChange;
  }

  override update(part: ElementPart, [contract]: [MdyPartContract]): typeof noChange {
    applyPart(part.element as HTMLElement, contract);
    return noChange;
  }
}

export const mdyPart = directive(MdyPartDirective);
