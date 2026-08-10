import { type PropertyDeclarations } from "lit";
import { type MdyFieldHandle, type MdySelectOption } from "@modyra/core";
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
    return `${this.fieldId}-label`;
  }

  /** Group label: real id, no `for` (there is no single input to point to). */
  protected renderGroupLabel(handle: MdyFieldHandle<T>): unknown {
    return this.renderLabel(handle, this.fieldId, this.labelId);
  }
}
