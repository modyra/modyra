import { mdyPart } from "../mdy-part.js";
import { html, type PropertyDeclarations } from "lit";
import { type MdyFieldConstraints, type MdyFieldHandle } from "@modyra/core";
import { MDY_CSS_PROPERTIES, sliderFillRatio } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

// ─── Slider ──────────────────────────────────────────────────────────────────

export class MdySliderFieldElement extends MdyFieldElement<number> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  /**
   * The ends of the track. Left unset they are the field's own rules, and where those say nothing
   * either, what a bare `<input type="range">` assumes — a slider has to span something to be drawn.
   */
  declare min?: number;
  declare max?: number;
  declare step: number;
  protected override readonly widgetKind = "slider" as const;

  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    return { min: this.min ?? null, max: this.max ?? null, step: this.step ?? null };
  }

  constructor() {
    super();
    this.step = 1;
  }

  protected override renderControl(handle: MdyFieldHandle<number>): unknown {
    const constraints = handle.constraints();
    const min = this.min ?? constraints.min ?? 0;
    const max = this.max ?? constraints.max ?? 100;
    const value = handle.value() ?? min;
    const fill = sliderFillRatio(value, min, max);
    return html`<div class="${this.partClass("track")}">
      <input
        id=${this.fieldId}
        type="range"
        class="${this.partClass("control")}"
        style="${MDY_CSS_PROPERTIES.control.sliderFill}: ${fill}"
        .value=${String(value)}
        ?disabled=${handle.disabled()}
        ${mdyPart(this.controlPart(handle))}
        @input=${(e: Event) => {
          handle.set((e.target as HTMLInputElement).valueAsNumber);
          handle.markAsDirty();
        }}
        @change=${() => handle.markAsTouched()}
      />
      <span class="${this.partClass("value")}">${handle.value()}</span>
    </div>`;
  }
}
