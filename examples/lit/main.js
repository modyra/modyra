// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history and a
// simulated server-side error. <mdy-text-field> renders in light DOM, so
// the theme stylesheet applies to its markup directly.
import {
  createLitForm,
  crossField,
  email,
  field,
  MdyFormController,
  minLength,
  mountMdyDevtools,
  required,
} from "@modyra/lit/adapter";
import { defineMdyElements } from "@modyra/lit/ui";
import { html, LitElement } from "lit";

// Registers the whole control catalog: text, textarea, number, checkbox,
// toggle, radio group, segmented, select, multiselect, slider, datepicker,
// daterange, timepicker, colors, file.
defineMdyElements();

const THEMES = { default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };

class SignupApp extends LitElement {
  static properties = { theme: { state: true } };

  // Swaps the theme stylesheet at runtime — every packaged theme works
  // with the same markup, so switching is just a different href.
  #setTheme = (theme) => {
    this.theme = theme;
    document.getElementById("theme").href = `./themes/${THEMES[theme]}`;
  };

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

  // A second, standalone form exercising every element of the catalog.
  gallery = createLitForm({
    topic: field(null, [required()]),
    plan: field("free"),
    billing: field("monthly"),
    channels: field([]),
    teamSize: field(5),
    budget: field(null),
    startDate: field(null),
    trial: field(null),
    standup: field(null),
    brand: field("#3366ff"),
    notifications: field(true),
    terms: field(false, [required()]),
    notes: field(""),
    attachments: field(null),
  });

  constructor() {
    super();
    this.theme = "default";
  }

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
        <label class="mdy-label" style="display:flex;gap:.5rem;align-items:center">
          Theme
          <select @change=${(e) => this.#setTheme(e.target.value)}>
            ${Object.keys(THEMES).map((t) => html`<option value=${t} ?selected=${t === this.theme}>${t}</option>`)}
          </select>
        </label>
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

        <h2>Control catalog</h2>
        <form class="mdy-form" style="display:grid;gap:1rem">
          <mdy-select-field label="Topic" placeholder="Pick one…"
            .field=${this.gallery.f.topic}
            .options=${[
        { value: "sales", label: "Sales" },
        { value: "support", label: "Support" },
      ]}></mdy-select-field>
          <mdy-radio-group-field label="Plan"
            .field=${this.gallery.f.plan}
            .options=${[
        { value: "free", label: "Free" },
        { value: "pro", label: "Pro" },
      ]}></mdy-radio-group-field>
          <mdy-segmented-field label="Billing"
            .field=${this.gallery.f.billing}
            .options=${[
        { value: "monthly", label: "Monthly" },
        { value: "yearly", label: "Yearly" },
      ]}></mdy-segmented-field>
          <mdy-multiselect-field label="Channels"
            .field=${this.gallery.f.channels}
            .options=${[
        { value: "mail", label: "Email" },
        { value: "sms", label: "SMS" },
        { value: "push", label: "Push" },
      ]}></mdy-multiselect-field>
          <mdy-slider-field label="Team size" min="1" max="50"
            .field=${this.gallery.f.teamSize}></mdy-slider-field>
          <mdy-number-field label="Budget" min="0" step="100"
            .field=${this.gallery.f.budget}></mdy-number-field>
          <mdy-datepicker-field label="Start date"
            .field=${this.gallery.f.startDate}></mdy-datepicker-field>
          <mdy-daterange-field label="Trial period"
            .field=${this.gallery.f.trial}></mdy-daterange-field>
          <mdy-timepicker-field label="Daily standup"
            .field=${this.gallery.f.standup}></mdy-timepicker-field>
          <mdy-colors-field label="Brand color"
            .field=${this.gallery.f.brand}></mdy-colors-field>
          <mdy-toggle-field label="Notifications"
            .field=${this.gallery.f.notifications}></mdy-toggle-field>
          <mdy-checkbox-field label="Accept terms"
            .field=${this.gallery.f.terms}></mdy-checkbox-field>
          <mdy-textarea-field label="Notes" rows="3"
            .field=${this.gallery.f.notes}></mdy-textarea-field>
          <mdy-file-field label="Attachments" multiple
            .field=${this.gallery.f.attachments}></mdy-file-field>
        </form>
      </main>`;
  }
}
customElements.define("signup-app", SignupApp);
