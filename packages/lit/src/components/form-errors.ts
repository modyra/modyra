import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { formErrorsOf, MDY_FORM_SHELL_CLASSES as FORM } from "@modyra/widgets";
import type { MdyFormError } from "@modyra/core";
import { MdyFormController } from "../adapter.js";

/**
 * The refusals the form shows for itself.
 *
 * Not every refusal belongs to a field. A failed network call, a service that is down, a cross-field
 * rule only a server can check: they arrive with no path, and a field-bound control has no reason to
 * show them. The engine keeps them in `state.lastSubmitErrors()`, and without somewhere to put them
 * the person who pressed the button saw their fields exactly as they had left them.
 *
 * Placed by the host, because a form's shape is the host's: this element takes the form and says
 * what the form has to say about itself.
 *
 * ```html
 * <mdy-form-errors .form=${form}></mdy-form-errors>
 * ```
 *
 * Light DOM, like every control in this package, so the shipped themes reach it.
 */
export class MdyFormErrorsElement extends LitElement {
  static properties: PropertyDeclarations = {
    form: { attribute: false },
  };

  declare form: { state: { lastSubmitErrors(): ReadonlyArray<MdyFormError> } } | undefined;

  private _tracker: MdyFormController | null = null;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): unknown {
    const form = this.form;
    if (!form) return nothing;
    // Subscribed on the first render rather than in the constructor: the host assigns `.form` after
    // the element exists, and a tracker built over the wrong form would report the wrong one.
    this._tracker ??= new MdyFormController(this, [() => form.state.lastSubmitErrors()]);
    const shown = formErrorsOf(form.state.lastSubmitErrors());
    // Rendered empty rather than not at all: a region a screen reader is already watching announces
    // what arrives in it, and one that appears with its message in it may not.
    return html`<ul class=${FORM.formErrors} role="status" ?hidden=${shown.length === 0}>
      ${shown.map((error) => html`<li class=${FORM.formErrorItem}>${error.message}</li>`)}
    </ul>`;
  }
}
