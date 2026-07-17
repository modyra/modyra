import { html, nothing } from "lit";
import { type MdySelectOption } from "@modyra/core";
import { createOptionFieldController, type MdyOptionFieldController } from "@modyra/widgets";
import { MdyOptionsFieldElement } from "./options-field.js";

export class MdyRadioGroupFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly rendererClass = "mdy-renderer--radio-group";
  private fieldController?: MdyOptionFieldController<unknown>;

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
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    const view = this.fieldController?.view();
    const groupAttrs = view?.parts.group.attributes;
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="mdy-radio-group"
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
      ${this.renderErrors(handle)}
    `;
  }
}
