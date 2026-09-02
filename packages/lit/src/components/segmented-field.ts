import { mdyPart } from "../mdy-part.js";
import { styleMap } from "lit/directives/style-map.js";
import { html, nothing } from "lit";
import { type MdySelectOption } from "@modyra/core";
import { createOptionFieldController, defaultOptionKey, type MdyOptionFieldController,
  partClasses,
  presentationClass,
} from "@modyra/widgets";
import { mdyIcon } from "../base.js";
import { MdyOptionsFieldElement } from "./options-field.js";

/**
 * The class every part and box wears, asked of the contract once. A second copy of a name the
 * catalogue holds is where the two come to disagree without either moving.
 */
const CLASS = {
  option: partClasses("segmented", "option").join(" "),
  firstButton: presentationClass("segmented", "firstButton"),
  lastButton: presentationClass("segmented", "lastButton"),
} as const;


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
        aria-labelledby=${this.namedBy().labelledby}
        aria-label=${this.namedBy().label}
        style=${styleMap(view?.parts.group?.style ?? {})}
      >
        ${this.options.map((option, index) => {
          // The key the contract derives, not `String()`: every plain object renders as `[object Object]`
          // through it, so every option of an object-valued list read the *same* projection entry —
          // and a group with one value held marked every option as the chosen one.
          const key = defaultOptionKey(option.value);
          const selected = this.isChosen(handle.value(), option.value);
          const classes = [
            CLASS.option,
            index === 0 ? CLASS.firstButton : "",
            index === last ? CLASS.lastButton : "",
            selected ? "mdy-segmented__button--selected" : "",
          ].join(" ");
          // A label around its own radio, not a button carrying the role. The choice is then a real
          // radio: it takes the group's arrow keys, its roving tab stop and its form participation
          // from the platform rather than reimplementing them, and a theme can paint the selected
          // state from `:checked` instead of a class the renderer has to remember to apply.
          return html`<label class=${classes}>
            <input
              type="radio"
              class="${this.partClass("optionControl")}"
              .value=${String(key)}
              .checked=${selected}
              ?disabled=${handle.disabled() || option.disabled === true}
              @change=${() => {
                if (this.fieldController) {
                  this.fieldController.dispatch({ type: "select", optionKey: key });
                } else {
                  handle.set(option.value);
                  handle.markAsDirty();
                  handle.markAsTouched();
                }
              }}
            />
            <span
              class="${this.partClass("optionCheck")}"
              style="visibility:${selected ? "visible" : "hidden"}"
              aria-hidden=${selected ? nothing : "true"}
            >
              ${mdyIcon("CHECKMARK", "")}
            </span>
            <span class="${this.partClass("optionText")}" data-text=${option.label}>${option.label}</span>
          </label>`;
        })}
      </div>
      ${this.renderSupportingText()}
      ${showBlockErrors || this.errorsReserved(handle) ? this.renderErrors(handle) : nothing}
    `;
  }
}
