import { html, nothing } from "lit";
import { type MdyDateRange, type MdyFieldHandle } from "@modyra/core";
import { MdyFieldElement } from "../base.js";

export class MdyDaterangeFieldElement extends MdyFieldElement<MdyDateRange | null> {
  protected override readonly rendererClass = "mdy-renderer--daterange";

  protected override renderControl(handle: MdyFieldHandle<MdyDateRange | null>): unknown {
    const range = handle.value() ?? { start: null, end: null };
    const patch = (part: Partial<MdyDateRange>): void => {
      handle.set({ ...range, ...part });
      handle.markAsDirty();
      handle.markAsTouched();
    };
    return html`
      <input
        id=${this.fieldId}
        type="date"
        class="mdy-datepicker__input"
        .value=${range.start ?? ""}
        max=${range.end ?? nothing}
        ?disabled=${handle.disabled()}
        @change=${(e: Event) => patch({ start: (e.target as HTMLInputElement).value || null })}
      />
      <span aria-hidden="true">–</span>
      <input
        type="date"
        class="mdy-datepicker__input"
        .value=${range.end ?? ""}
        min=${range.start ?? nothing}
        ?disabled=${handle.disabled()}
        aria-label=${`${this.label} (end)`}
        @change=${(e: Event) => patch({ end: (e.target as HTMLInputElement).value || null })}
      />
    `;
  }
}
