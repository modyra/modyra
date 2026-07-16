// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history and a
// simulated server-side error. <mdy-text-field> renders in light DOM, so
// the theme stylesheet applies to its markup directly.
import { html, LitElement } from "lit";
import {
  createLitForm, crossField, defineMdyTextField, email, field, minLength,
  MdyFormController, mountMdyDevtools, required,
} from "@modyra/lit";

defineMdyTextField();

class SignupApp extends LitElement {
  form = createLitForm(
    {
      name: field("", [required(), minLength(2)]),
      email: field("", [required(), email()]),
      password: field("", [required(), minLength(8)]),
      confirm: field("", [required()]),
    },
    {
      validators: [
        crossField(["confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords do not match"),
      ],
      history: { debounceMs: 300 },
      // The password never touches storage.
      draft: { key: "signup-lit", exclude: ["password", "confirm"] },
    },
  );

  // Re-render on the state this template reads outside <mdy-text-field>.
  tracker = new MdyFormController(this, [
    this.form.state.canSubmit,
    this.form.canUndo,
    this.form.canRedo,
  ]);

  createRenderRoot() { return this; } // light DOM: the theme applies

  firstUpdated() {
    this._disposeDevtools = mountMdyDevtools(this.form, this.querySelector("#devtools"));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._disposeDevtools?.();
  }

  #submit = (e) => {
    e.preventDefault();
    void this.form.submit(async (value) => {
      // Returned errors are shown on the matching fields until edited.
      if (value.email === "taken@example.com") {
        return [{ path: "email", kind: "server", message: "This email is already registered" }];
      }
      console.log("submitted", value);
    });
  };

  render() {
    return html`
      <main style="max-width:30rem;margin:2rem auto;display:grid;gap:1rem">
        <h1>Modyra × Lit</h1>
        <p>Try <code>taken@example.com</code> to see a server error. Reload mid-typing: the draft survives.</p>
        <form class="mdy-form" @submit=${this.#submit}>
          <mdy-text-field label="Name" .field=${this.form.f.name}></mdy-text-field>
          <mdy-text-field label="Email" type="email" .field=${this.form.f.email}></mdy-text-field>
          <mdy-text-field label="Password" type="password" .field=${this.form.f.password}></mdy-text-field>
          <mdy-text-field label="Confirm password" type="password" .field=${this.form.f.confirm}></mdy-text-field>
          <div style="display:flex;gap:.5rem">
            <button type="submit" ?disabled=${!this.form.state.canSubmit()}>Sign up</button>
            <button type="button" ?disabled=${!this.form.canUndo()} @click=${() => this.form.undo()}>Undo</button>
            <button type="button" ?disabled=${!this.form.canRedo()} @click=${() => this.form.redo()}>Redo</button>
          </div>
        </form>
        <div id="devtools"></div>
      </main>`;
  }
}
customElements.define("signup-app", SignupApp);
