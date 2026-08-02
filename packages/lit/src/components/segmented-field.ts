import { mdyPart } from "../mdy-part.js";
import { styleMap } from "lit/directives/style-map.js";
import { html, nothing } from "lit";
import { type MdySelectOption } from "@modyra/core";
import { createOptionFieldController, type MdyOptionFieldController } from "@modyra/widgets";
import { mdyIcon } from "../base.js";
import { MdyOptionsFieldElement } from "./options-field.js";

export class MdySegmentedFieldElement extends MdyOptionsFieldElement<unknown | null> {
  protected override readonly widgetKind = "segmented" as const;
  private fieldController?: MdyOptionFieldController<unknown>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createOptionFieldController({
      widgetId: this.fieldId,
      handle,
      options: this.options as ReadonlyArray<MdySelectOption<unknown>>,
      variant: "segmented",
      // This element renders its error list only once the field is touched, so the projection
      // must not point at a list that is not there yet.
      errorsVisible: (state) => state.touched && state.invalid,
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
    const last = this.options.length - 1;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="${this.partClass("group")}"
        role="radiogroup"
        ${mdyPart(this.controlPart(handle))}
        aria-labelledby=${this.label ? this.labelId : nothing}
        style=${styleMap(view?.parts.group?.style ?? {})}
      >
        ${this.options.map((option, index) => {
          const key = String(option.value);
          const optionView = view?.parts[key];
          const optionAttrs = optionView?.attributes;
          const selected = handle.value() === option.value;
          const classes = [
            "mdy-segmented__button",
            index === 0 ? "mdy-segmented__button--first" : "",
            index === last ? "mdy-segmented__button--last" : "",
            selected ? "mdy-segmented__button--selected" : "",
          ].join(" ");
          return html`<button
            type="button"
            class=${classes}
            role="radio"
            aria-checked=${optionAttrs?.["aria-checked"] ?? (selected ? "true" : "false")}
            ?disabled=${handle.disabled() || option.disabled === true}
            @click=${() => {
              if (this.fieldController) {
                this.fieldController.dispatch({ type: "select", optionKey: key });
              } else {
                handle.set(option.value);
                handle.markAsDirty();
                handle.markAsTouched();
              }
            }}
          >
            <span
              class="${this.partClass("optionCheck")}"
              style="visibility:${selected ? "visible" : "hidden"}"
              aria-hidden=${selected ? nothing : "true"}
            >
              ${mdyIcon("CHECKMARK", "")}
            </span>
            <span class="${this.partClass("optionText")}" data-text=${option.label}>${option.label}</span>
          </button>`;
        })}
      </div>
      ${this.renderSupportingText()}
      ${showBlockErrors ? this.renderErrors(handle) : nothing}
    `;
  }
}
