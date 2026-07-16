// Demo Lit — same signup form as the React/Vue/Angular demos, default theme.
// Uses the ready-made <mdy-text-field> element from @modyra/lit.
import { html, LitElement } from "lit";
import {
  createLitForm, defineMdyTextField, email, field, minLength,
  mountMdyDevtools, required,
} from "@modyra/lit";

defineMdyTextField();

class SignupApp extends LitElement {
  form = createLitForm({
    name: field("", [required(), minLength(2)]),
    email: field("", [required(), email()]),
  });
  createRenderRoot() { return this; } // light DOM: global theme applies
  firstUpdated() {
    mountMdyDevtools(this.form, this.querySelector("#devtools"));
  }
  render() {
    return html`
      <main style="max-width:28rem;margin:2rem auto;display:grid;gap:1rem">
        <h1>Modyra × Lit</h1>
        <form class="mdy-form" @submit=${(e) => { e.preventDefault(); void this.form.submit((v) => console.log(v)); }}>
          <mdy-text-field label="Name" .field=${this.form.f.name}></mdy-text-field>
          <mdy-text-field label="Email" type="email" .field=${this.form.f.email}></mdy-text-field>
          <button type="submit">Sign up</button>
        </form>
        <div id="devtools"></div>
      </main>`;
  }
}
customElements.define("signup-app", SignupApp);
