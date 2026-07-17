import { html, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { MdyFieldElement } from "../base.js";

// ─── Slider ──────────────────────────────────────────────────────────────────

export class MdySliderFieldElement extends MdyFieldElement<number> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  declare min: number;
  declare max: number;
  declare step: number;
  protected override readonly rendererClass = "mdy-renderer--slider";

  constructor() {
    super();
    this.min = 0;
    this.max = 100;
    this.step = 1;
  }

  protected override renderControl(handle: MdyFieldHandle<number>): unknown {
    const value = handle.value() ?? this.min;
    const pct = ((value - this.min) / (this.max - this.min || 1)) * 100;
    return html`<div class="mdy-slider-container">
      <input
        id=${this.fieldId}
        type="range"
        class="mdy-slider"
        style="--mdy-slider-fill-pct: ${pct}%"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(value)}
        ?disabled=${handle.disabled()}
        aria-required=${handle.required() ? "true" : "false"}
        @input=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).valueAsNumber);
          handle.markAsDirty();
        }}
        @change=${() => handle.markAsTouched()}
      />
      <span class="mdy-slider-value">${handle.value()}</span>
    </div>`;
  }
}
