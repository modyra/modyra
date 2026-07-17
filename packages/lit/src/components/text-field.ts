import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createFieldController, type MdyFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

// ─── Text-like ────────────────────────────────────────────────────────────────

export class MdyTextFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    type: { type: String },
    placeholder: { type: String },
    autocomplete: { type: String },
  };
  declare type: string;
  declare placeholder: string;
  declare autocomplete: string;
  protected override readonly rendererClass = "mdy-renderer--text";
  private fieldController?: MdyFieldController<string | null>;

  constructor() {
    super();
    this.type = "text";
    this.placeholder = "";
    this.autocomplete = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createFieldController({
      widgetId: this.fieldId,
      handle,
      inputType: this.type,
      autocomplete: this.autocomplete,
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    const input = this.fieldController?.view().parts.input;
    const inputAttrs = input?.attributes;
    return html`<input
      id=${this.fieldId}
      type=${this.type}
      placeholder=${this.placeholder}
      autocomplete=${this.autocomplete || nothing}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      aria-invalid=${inputAttrs?.["aria-invalid"] ?? (handle.errors().length > 0 ? "true" : "false")}
      aria-required=${inputAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
      aria-describedby=${inputAttrs?.["aria-describedby"] ?? (this.showErrors(handle) ? this.errorsId : nothing)}
      @input=${(e: Event) => {
        const value = (e.target as HTMLInputElement).value;
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
