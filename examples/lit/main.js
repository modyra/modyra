// Demo Lit: consumes @modyra/lit from node_modules (the built package).
import { html, LitElement } from "lit";
import { createLitForm, field, MdyFormController, required } from "@modyra/lit";

class SignupForm extends LitElement {
  form = createLitForm({ email: field("", [required()]) });
  tracker = new MdyFormController(this, [
    this.form.f.email.value, this.form.f.email.errors,
    this.form.f.email.touched, this.form.state.valid,
  ]);
  render() {
    const email = this.form.f.email;
    return html`
      <form @submit=${(e) => { e.preventDefault(); void this.form.submit((v) => console.log(v)); }}>
        <label>Email <input .value=${email.value()}
          @input=${(e) => email.set(e.target.value)}
          @blur=${() => email.markAsTouched()}
          aria-invalid=${!email.valid()} /></label>
        ${email.touched() ? email.errors().map((er) => html`<p>${er.message}</p>`) : ""}
        <button type="submit">Sign up</button>
      </form>`;
  }
}
customElements.define("signup-form", SignupForm);
