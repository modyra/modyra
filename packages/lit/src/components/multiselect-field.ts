import { type MdyFieldHandle } from "@modyra/core";
import { MdyDropdownFieldElement } from "./dropdown-field.js";

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  protected override readonly rendererClass = "mdy-renderer--multiselect";

  protected override get multiselectable(): boolean {
    return true;
  }

  protected override isSelected(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): boolean {
    return (handle.value() ?? []).includes(value);
  }

  protected override pick(handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    const current = handle.value() ?? [];
    handle.set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
    handle.markAsDirty();
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    const current = handle.value() ?? [];
    if (current.length === 0) return "";
    return this.options
      .filter((o) => current.includes(o.value))
      .map((o) => o.label)
      .join(", ");
  }
}
