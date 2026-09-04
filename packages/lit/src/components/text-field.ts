import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, createTextFieldController, type MdyTextFieldController } from "@modyra/widgets";
import { MdyFieldElement } from "../base.js";

// ─── Text-like ────────────────────────────────────────────────────────────────

/**
 * The kinds this one element draws.
 *
 * `textarea` is text-like in the schema and is not here: it has its own element because its anatomy
 * differs, while these three share one and differ only in the native input the contract asks for.
 */
type MdyTextLikeKind = "text" | "email" | "password";

export class MdyTextFieldElement extends MdyFieldElement<string | null> {
  static override properties: PropertyDeclarations = {
    kind: { type: String },
    type: { type: String },
    placeholder: { type: String },
    autocomplete: { type: String },
  };
  /**
   * Which text-like kind this is: `text`, `email` or `password`.
   *
   * The three share one anatomy and differ only in the native input they ask for, so one element
   * draws all three — and naming the kind is what lets the contract answer that difference. A host
   * that names none gets `text`, which is what it got before this property existed.
   */
  declare kind: MdyTextLikeKind;
  declare type: string;
  declare placeholder: string;
  declare autocomplete: string;
  /**
   * What the base resolves anatomy from, and it stays `text` on purpose.
   *
   * The three kinds this element draws share one anatomy — same parts, same classes — so every
   * answer the base takes from the catalogue is the same for all of them. Widening this would move
   * a published type to say something no rendering depends on; `kind` above carries the difference
   * that is real, which is the native input.
   */
  protected override readonly widgetKind = "text" as const;
  private fieldController?: MdyTextFieldController<string | null>;

  constructor() {
    super();
    this.kind = "text";
    // Empty rather than "text": empty means *nothing was said*, and what a kind's native input
    // should be is the contract's answer. Written as a default here it would be a second statement
    // of it — the one that stops moving when the declaration does.
    this.type = "";
    this.placeholder = "";
    this.autocomplete = "";
  }

  /**
   * The native input this control asks for: what the host said, or what the kind declares.
   *
   * The explicit property stays an override, because a host may have a reason the catalogue does not
   * know. What changes is the *default*: unset, an email field used to render `type="text"` and lose
   * the keyboard and the affordance that go with it, silently and for as long as nobody looked.
   */
  private get inputType(): string {
    return this.type !== "" ? this.type : MDY_WIDGET_CONTRACTS[this.kind].controlType ?? "text";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createTextFieldController({
      widgetId: this.fieldId,
      handle,
      inputType: this.inputType,
      kind: this.widgetKind,
      autocomplete: this.autocomplete,
      describes: () => this.hasDescription(),
    });
  }

  override disconnectedCallback(): void {
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  protected override renderControl(handle: MdyFieldHandle<string | null>): unknown {
    return html`<input
      id=${this.fieldId}
      type=${this.inputType}
      placeholder=${this.placeholder}
      autocomplete=${this.autocomplete || nothing}
      .value=${handle.value() ?? ""}
      ?disabled=${handle.disabled()}
      ?readonly=${handle.readonly()}
      aria-readonly=${handle.readonly() ? "true" : nothing}
      ${mdyPart(this.controlPart(handle))}
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
