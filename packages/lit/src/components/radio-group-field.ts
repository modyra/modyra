import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdySelectOption } from "@modyra/core";
import {
  createOptionFieldController,
  shownErrorsOf,
  type MdyOptionFieldController,
  defaultOptionKey,
} from "@modyra/widgets";
import { MdyOptionsFieldElement } from "./options-field.js";


export class MdyRadioGroupFieldElement extends MdyOptionsFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = {
    layout: { type: String },
  };
  /** `"vertical"` (default) or `"horizontal"`. */
  declare layout: "vertical" | "horizontal";

  protected override readonly widgetKind = "radio" as const;
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
    const groupAttrs = view?.parts.group.attributes;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    return html`
      ${this.renderGroupLabel(handle)}
      <div
        class="${this.partClass("group")} ${this.layout === "horizontal" ? "mdy-radio-group--horizontal" : ""}"
        role="radiogroup"
        aria-labelledby=${this.label ? this.labelId : nothing}
        aria-describedby=${groupAttrs?.["aria-describedby"] ?? nothing}
        aria-disabled=${groupAttrs?.["aria-disabled"] ?? nothing}
        aria-readonly=${groupAttrs?.["aria-readonly"] ?? nothing}
        aria-invalid=${groupAttrs?.["aria-invalid"] ?? (shownErrorsOf(handle).length > 0 ? "true" : "false")}
        aria-required=${groupAttrs?.["aria-required"] ?? (handle.required() ? "true" : "false")}
      >
        ${this.options.map(
          (option) => {
            // The key the contract derives, not `String()`: every plain object renders as `[object Object]`
            // through it, so every option of an object-valued list read the *same* projection entry —
            // and a group with one value held marked every option as the chosen one.
            const key = defaultOptionKey(option.value);
            const optionView = view?.parts[key];
            const optionAttrs = optionView?.attributes;
            return html`<label
              class="${this.partClass("option")} ${option.disabled || handle.disabled() ? "mdy-radio-item--disabled" : ""}"
            >
              <input
                type="radio"
                .value=${String(key)}
                .checked=${this.isChosen(handle.value(), option.value)}
                ?disabled=${handle.disabled() || option.disabled === true}
                aria-checked=${optionAttrs?.["aria-checked"] ?? (this.isChosen(handle.value(), option.value) ? "true" : "false")}
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
              <span class="${this.partClass("optionControl")}"></span>
              <span class="${this.partClass("optionLabel")}">${option.label}</span>
            </label>`;
          },
        )}
      </div>
      ${showBlockErrors ? this.renderErrors(handle) : this.renderSupportingText()}
    `;
  }
}
