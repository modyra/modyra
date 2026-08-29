import { nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle, type MdySelectOption } from "@modyra/core";
import { defaultWidgetIdFactory, fieldNameAttributes } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

// ─── Option-based ────────────────────────────────────────────────────────────

export abstract class MdyOptionsFieldElement<T> extends MdyFieldElement<T> {
  static override properties: PropertyDeclarations = {
    options: { attribute: false },
  };
  declare options: ReadonlyArray<MdySelectOption<unknown>>;

  /**
   * The list this element actually renders. Identical to `options` unless a subclass has something
   * to add — a single-value chooser adds the value its field holds when the list does not contain
   * it, so a value the widget refuses to erase is still a value the user can see.
   */
  protected get listOptions(): ReadonlyArray<MdySelectOption<unknown>> {
    return this.options;
  }

  constructor() {
    super();
    this.options = [];
  }

  protected get labelId(): string {
    // Through the factory, so the id is one a consumer can compose from the scope rather than one
    // only this renderer knows how to spell.
    return defaultWidgetIdFactory.part(this.fieldId, "label");
  }

  /**
   * Which attribute names this control, asked of the contract rather than answered per element.
   *
   * Two names on one element is not two names — the computation takes `aria-labelledby` and stops —
   * and the pair is what a template writes by accident when the rule is spelled out at each site.
   * `nothing` where the contract says the attribute is absent, so lit removes it.
   */
  protected namedBy(): { readonly labelledby: string | typeof nothing; readonly label: string | typeof nothing } {
    const named = fieldNameAttributes({
      ariaLabel: this._pendingName,
      label: this.label,
      name: this.field?.path,
      labelId: this.labelId,
    });
    return {
      labelledby: named["aria-labelledby"] ?? nothing,
      label: named["aria-label"] ?? nothing,
    };
  }

  /** Group label: real id, no `for` (there is no single input to point to). */
  protected renderGroupLabel(handle: MdyFieldHandle<T>): unknown {
    return this.renderLabel(handle, this.fieldId, this.labelId);
  }
}
