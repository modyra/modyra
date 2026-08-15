import { mdyPart } from "../mdy-part.js";
import { html, type PropertyDeclarations } from "lit";
import { type MdyFieldConstraints, type MdyFieldHandle } from "@modyra/core";
import { MDY_CSS_PROPERTIES, blocksValueChange, sliderFillRatio, sliderTrack } from "@modyra/widgets";
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

  /**
   * The track, offered as this control's own narrowing.
   *
   * One source for the drawn fill and for the attributes the base projects: a track that spanned the
   * value while `max` still said 100 would draw the thumb in one place and refuse it in another.
   */
  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    const held = this.field?.value();
    return sliderTrack(
      { min: this.min ?? null, max: this.max ?? null, step: this.step ?? null },
      typeof held === "number" ? held : null,
    );
  }

  constructor() {
    super();
    this.step = 1;
  }

  /**
   * The value is assigned *after* the part applies `min`/`max`.
   *
   * A range input clamps its value to the bounds it carries at the moment of assignment, so a value
   * of 150 written while the track still said 100 stayed 100 even once the track widened. Template
   * order is the fix, and it is load-bearing rather than cosmetic.
   */
  protected override renderControl(handle: MdyFieldHandle<number>): unknown {
    const constraints = handle.constraints();
    // The track the contract draws: it spans what the field holds where nothing declared a bound,
    // and drops a step that would move the thumb off the value. Both renderers used to default to
    // 0–100 here, separately, and put the thumb at 100 for a value of 150.
    const track = sliderTrack(
      { min: this.min ?? constraints.min, max: this.max ?? constraints.max, step: constraints.step },
      typeof handle.value() === "number" ? handle.value() : null,
    );
    const min = track.min;
    const max = track.max;
    const value = handle.value() ?? min;
    const fill = sliderFillRatio(value, min, max);
    return html`<div class="${this.partClass("track")}">
      <input
        id=${this.fieldId}
        type="range"
        class="${this.partClass("control")}"
        style="${MDY_CSS_PROPERTIES.control.sliderFill}: ${fill}"
        ?disabled=${handle.disabled()}
        ${mdyPart(this.controlPart(handle))}
        .value=${String(value)}
        @input=${(e: Event) => {
          const range = e.target as HTMLInputElement;
          // A read-only field is fully in play — submitted, validated, reachable — and the one thing
          // it does not do is change. `<input type="range">` ignores the native `readonly`
          // attribute, so the refusal has to be made here, and the thumb put back where the value
          // still is: a rail that slides and then reports the old number shows one thing and holds
          // another.
          if (blocksValueChange(handle.interactivity())) {
            range.value = String(handle.value() ?? min);
            return;
          }
          handle.set(range.valueAsNumber);
          handle.markAsDirty();
        }}
        @change=${() => handle.markAsTouched()}
      />
      <span class="${this.partClass("value")}">${handle.value()}</span>
    </div>`;
  }
}
