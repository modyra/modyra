import { type PropertyDeclarations } from "lit";
import { type MdyFieldHandle, type MdySelectOption } from "@modyra/core";
import { MdyFieldElement } from "../base.js";

// ─── Option-based ────────────────────────────────────────────────────────────

export abstract class MdyOptionsFieldElement<T> extends MdyFieldElement<T> {
  static override properties: PropertyDeclarations = {
    options: { attribute: false },
  };
  declare options: ReadonlyArray<MdySelectOption<unknown>>;

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
