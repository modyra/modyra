import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdySelectOption } from "@modyra/core";
import { createOptionFieldController, type MdyOptionFieldController } from "@modyra/widgets";
import { MdyOptionsFieldElement } from "./options-field.js";

export class MdyRadioGroupFieldElement extends MdyOptionsFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = {
    layout: { type: String },
  };
  /** `"vertical"` (default) or `"horizontal"`. */
  declare layout: "vertical" | "horizontal";

  protected override readonly rendererClass = "mdy-renderer--radio-group";
  private fieldController?: MdyOptionFieldController<unknown>;

  constructor() {
    super();
    this.layout = "vertical";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createOptionFieldController({
      widgetId: this.fieldId,
      handle,
      options: this.options as ReadonlyArray<MdySelectOption<unknown>>,
      variant: "radio",
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(): unknown {
    return nothing;
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    const view = this.fieldController?.view();
    const groupAttrs = view?.parts.group.attributes;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="mdy-radio-group ${this.layout === "horizontal" ? "mdy-radio-group--horizontal" : ""}"
        role="radiogroup"
        aria-labelledby=${this.label ? this.labelId : nothing}
        aria-invalid=${groupAttrs?.["aria-invalid"] ?? (handle.errors().length > 0 ? "true" : "false")}
        aria-required=${groupAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
      >
        ${this.options.map(
          (option) => {
            const key = String(option.value);
            const optionView = view?.parts[key];
            const optionAttrs = optionView?.attributes;
            return html`<label
              class="mdy-radio-item ${option.disabled || handle.disabled() ? "mdy-radio-item--disabled" : ""}"
            >
              <input
                type="radio"
                name=${this.fieldId}
                .checked=${handle.value() === option.value}
                ?disabled=${handle.disabled() || option.disabled === true}
                aria-checked=${optionAttrs?.["aria-checked"] ?? (handle.value() === option.value ? "true" : "false")}
                aria-disabled=${optionAttrs?.["aria-disabled"] ?? (option.disabled || handle.disabled())}
                @change=${() => {
                  if (this.fieldController) {
                    this.fieldController.dispatch({ type: "select", optionKey: key });
                  } else {
                    handle.set(option.value);
                    handle.markAsDirty();
                  }
                }}
                @blur=${() =>
                  this.fieldController
                    ? this.fieldController.dispatch({ type: "blur" })
                    : handle.markAsTouched()}
              />
              <span class="mdy-radio-circle"></span>
              <span class="mdy-radio-label">${option.label}</span>
            </label>`;
          },
        )}
      </div>
      ${showBlockErrors ? this.renderErrors(handle) : this.renderSupportingText()}
    `;
  }
}
