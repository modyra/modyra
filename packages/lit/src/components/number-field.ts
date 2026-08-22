import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldConstraints, type MdyFieldHandle } from "@modyra/core";
import { createTextFieldController, type MdyTextFieldController } from "@modyra/widgets";
import { MdyFieldElement, mdyIcon } from "../base.js";

export class MdyNumberFieldElement extends MdyFieldElement<number | null> {
  static override properties: PropertyDeclarations = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };
  /**
   * The range offered at the keyboard. Left unset it is the field's own: a `min`/`max` in the
   * schema already answers "what may this hold", and writing it again here is how the two come to
   * disagree. Set, it narrows what this control offers without changing what the field accepts.
   */
  declare min?: number;
  declare max?: number;
  declare step?: number;
  protected override readonly widgetKind = "number" as const;

  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    return { min: this.min ?? null, max: this.max ?? null, step: this.step ?? null };
  }
  private fieldController?: MdyTextFieldController<number | null>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createTextFieldController({
      widgetId: this.fieldId,
      handle,
      inputType: "number",
      kind: "number",
      // Read on every projection, so a `min` set after the element connected is honoured.
      constraints: () => ({ min: this.min ?? null, max: this.max ?? null, step: this.step ?? null }),
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  /**
   * One step of the field's own range, through the same intent typing goes through.
   *
   * The catalogue declares `increment` and `decrement` at this kind's trailing edge, and nothing
   * here drew them: the promise a theme styles was kept by the platform's spinner or by nothing,
   * depending on the browser.
   */
  private stepBy(handle: MdyFieldHandle<number | null>, direction: 1 | -1): void {
    if (handle.disabled() || handle.readonly()) return;
    const rules = { ...handle.constraints(), ...this.narrowedConstraints() };
    const by = typeof rules.step === "number" && rules.step > 0 ? rules.step : 1;
    const from = handle.value() ?? 0;
    const min = typeof rules.min === "number" ? rules.min : -Infinity;
    const max = typeof rules.max === "number" ? rules.max : Infinity;
    const next = Math.min(max, Math.max(min, from + by * direction));
    if (this.fieldController) this.fieldController.dispatch({ type: "input", value: next });
    else { handle.set(next); handle.markAsDirty(); }
  }

  protected override renderControl(handle: MdyFieldHandle<number | null>): unknown {
    // The box and its two steppers share one positioning context, which is presentation and not a
    // part: nothing is announced by it and no contract member points at it.
    return html`<span class="mdy-number-spinner">${this.renderBox(handle)}
      <button
        type="button"
        class="${this.partClass("increment")}"
        tabindex="-1"
        aria-label=${this.messages.increase}
        ?disabled=${handle.disabled() || handle.readonly()}
        @click=${() => this.stepBy(handle, 1)}
      >${mdyIcon("SPIN_UP", "")}</button>
      <button
        type="button"
        class="${this.partClass("decrement")}"
        tabindex="-1"
        aria-label=${this.messages.decrease}
        ?disabled=${handle.disabled() || handle.readonly()}
        @click=${() => this.stepBy(handle, -1)}
      >${mdyIcon("SPIN_DOWN", "")}</button>
    </span>`;
  }

  private renderBox(handle: MdyFieldHandle<number | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type="number"
      .value=${handle.value() === null ? "" : String(handle.value())}
      ?disabled=${handle.disabled()}
      ?readonly=${handle.readonly()}
      aria-readonly=${handle.readonly() ? "true" : nothing}
      ${mdyPart(this.controlPart(handle))}
      @input=${(e: Event) => {
        const n = (e.target as HTMLInputElement).valueAsNumber;
        const value = Number.isNaN(n) ? null : n;
        if (this.fieldController) {
          this.fieldController.dispatch({ type: "input", value });
        } else {
          handle.set(value);
          handle.markAsDirty();
        }
      }}
      @blur=${() =>
        this.fieldController
          ? this.fieldController.dispatch({ type: "blur" })
          : handle.markAsTouched()}
    />`;
  }
}
