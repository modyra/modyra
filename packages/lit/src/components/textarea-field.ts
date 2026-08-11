import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createFieldController, type MdyFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";
import { nativeConstraintAttributes } from "@modyra/widgets";

export class MdyTextareaFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    rows: { type: Number },
    placeholder: { type: String },
  };
  declare rows: number;
  declare placeholder: string;
  protected override readonly widgetKind = "textarea" as const;
  private fieldController?: MdyFieldController<string | null>;

  constructor() {
    super();
    this.rows = 3;
    this.placeholder = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createFieldController({
      widgetId: this.fieldId,
      handle,
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    // What the field's rules state, as this kind's own attributes. A textarea carries lengths and no
    // pattern — the platform ignores `pattern` here, and the translation says so once for everyone.
    const native = nativeConstraintAttributes(this.widgetKind, handle.constraints());
    return html`<textarea
      id=${this.fieldId}
      rows=${this.rows}
      minlength=${native["minlength"] ?? nothing}
      maxlength=${native["maxlength"] ?? nothing}
      placeholder=${this.placeholder}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      ?readonly=${handle.readonly()}
      aria-readonly=${handle.readonly() ? "true" : nothing}
      ${mdyPart(this.controlPart(handle))}
      @input=${(e: Event) => {
        const value = (e.target as HTMLTextAreaElement).value;
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
    ></textarea>`;
  }
}
