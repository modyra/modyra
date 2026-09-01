// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history, a
// cancellable server-side username check and a simulated server error on
// submit. <mdy-text-field> renders in light DOM, so the theme stylesheet
// applies to its markup directly.
// The inspector is a development tool, not part of a form. `IfWanted` mounts it when the build
// says development and skips it otherwise — and takes `true` or `false` when you want to decide
// yourself, in either direction.
import { mountMdyDevtoolsIfWanted } from "@modyra/core/devtools";
import {
  createLitForm,
  crossField,
  email,
  field,
  group,
  MdyFormController,
  maxLength,
  minLength,
  pattern,
  record,
  required,
  serverValidator,
} from "@modyra/lit/adapter";
import { defineMdyElements, mdyLitTagFor } from "@modyra/lit/ui";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";
import { applyDynamicRules, buildFlatFormSchema, parseDynamicForm } from "@modyra/core";
import { html, LitElement, nothing } from "lit";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { legendWhenReady } from "../shared/legend.js";

// Simulated availability endpoint. The abort signal cancels the request
// when a newer keystroke supersedes the run (last-wins), so stale replies
// never land on the field.
const isUsernameTaken = (value, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(["admin", "root"].includes(value)), 350);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

// Registers the whole control catalog: text, textarea, number, checkbox,
// toggle, radio group, segmented, select, multiselect, slider, datepicker,
// daterange, timepicker, colors, file.
defineMdyElements();

const THEMES = { modern: "modyra-modern.css", default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };

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
      // Debounced, cancellable availability check with a 2s timeout —
      // try "admin" or "root".
      username: field(
        "",
        [required(), minLength(3)],
        serverValidator(
          async (value, { signal }) =>
            (await isUsernameTaken(value, signal)) ? "Username is already taken" : null,
          {
            debounceMs: 300,
            timeoutMs: 2000,
            // Nothing to ask a server about a name that is too short to be one: `minLength(3)` has
            // already refused it. Without this the check runs on the empty initial value, and the
            // page carries a "checking…" line for the first third of a second — a layout that exists
            // only while nobody has typed anything.
            when: (value) => String(value ?? "").length >= 3,
          },
        ),
      ),
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
      draft: { key: "signup-lit", exclude: ["password", "confirm"] }
    },
  );

  // Re-render on the state this template reads outside <mdy-text-field>.
  tracker = new MdyFormController(this, [
    this.form.state.canSubmit,
    this.form.canUndo,
    this.form.canRedo,
    this.form.f.username.pending,
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
    this.theme = "modern";
  }

  createRenderRoot() { return this; } // light DOM: the theme applies

  firstUpdated() {
    this._disposeDevtools = mountMdyDevtoolsIfWanted(this.form, this.querySelector("#devtools"));
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
        <p>Try username <code>admin</code> for a cancellable server check, <code>taken@example.com</code> for a server error. Reload mid-typing: the draft survives.</p>
        <form class="mdy-form" @submit=${this.#submit}>
          <mdy-text-field label="Username" .field=${this.form.f.username}></mdy-text-field>
          ${this.form.f.username.pending()
        ? html`<div class="mdy-supporting-text" role="status">checking…</div>`
        : nothing}
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
          <mdy-multiselect-field label="Channels" reorderable
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

        <h2>Rows keyed by data</h2>
        <p>
          A table rendered <strong>by column</strong>: each column draws one cell of each row, so the
          two controls of a row are created apart. Sorting, closing an editor and removing a row
          change nothing a value depends on.
        </p>
        <keyed-rows></keyed-rows>

        <h2>A section that only counts sometimes</h2>
        <p>
          The company details are declared like everything else and are <strong>out of play</strong>
          while the account is personal: not validated, not submitted, and what was typed into them
          kept. The code carries <code>maxlength</code> and <code>pattern</code> because its rules
          say so — nothing here writes an attribute.
        </p>
        <conditional-section></conditional-section>
      </main>`;
  }
}
customElements.define("signup-app", SignupApp);

/**
 * The same checkout the plain demo draws, from the same service, drawn by Lit.
 *
 * This is the claim the contract exists for: one document, defined by a Rust backend, and every
 * renderer draws it. Nothing here knows what a checkout is — it asks `mdyLitTagFor` which element
 * draws each kind the document names, and hands it the field handle.
 *
 * Parsed strictly before a single element is created. A document off a network is data from
 * somewhere else even when the somewhere else is ours.
 */
class ServedCheckout extends LitElement {
  static properties = { _note: { state: true }, _fields: { state: true } };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this._note = "asking the API…";
    this._fields = [];
    this._form = null;
  }

  connectedCallback() {
    super.connectedCallback();
    void this._load();
  }

  async _load() {
    let payload;
    try {
      const response = await fetch("http://127.0.0.1:3000/v1/forms/checkout", {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`the API answered ${response.status}`);
      payload = await response.json();
    } catch (error) {
      // An absence that says how to end it. A blank space reads as a renderer that failed, which is
      // the wrong thing to go and debug.
      this._note = `The form API is not answering (${error.message}). Run this demo with `
        + "`npm run demo:lit`, which starts it, or `cargo run -p modyra-axum-form-server-example`.";
      return;
    }

    const parsed = parseDynamicForm(payload, { mode: "strict" });
    if (!parsed.ok) {
      this._note = "The API served a document this reader refuses — the check working, not a network "
        + `problem: ${parsed.diagnostics.map((d) => `${d.code} at ${d.path}`).join(", ")}`;
      return;
    }

    // The document's own rules reach the form: a condition parsed and never applied is a form that
    // looks obeyed while every rule in it is inert.
    this._form = createLitForm(buildFlatFormSchema(parsed.fields), { autoActivate: false });
    applyDynamicRules(this._form, parsed.rules);
    this._form.activate();

    this._note = `Contract v${parsed.version} · ${parsed.fields.length} fields · built in Rust, drawn by Lit.`;
    this._fields = parsed.fields;
  }

  render() {
    return html`
      <h2>A checkout its backend defined</h2>
      <p style="font-size:.9em">${this._note}</p>
      ${this._form
        ? this._fields.map((each) => {
            const tag = mdyLitTagFor(each.kind);
            // A kind this package draws nothing for is said, not skipped: a document naming one
            // would otherwise lose a field with nobody told.
            if (!tag) return html`<p>no Lit element draws <code>${each.kind}</code></p>`;
            return staticHtml`<${unsafeStatic(tag)}
              .field=${this._form.f[each.name]}
              label=${each.label ?? each.name}
            ></${unsafeStatic(tag)}>`;
          })
        : null}
    `;
  }
}
customElements.define("served-checkout", ServedCheckout);


/**
 * The arrangement `record()` exists for, in Lit.
 *
 * Each column below iterates the rows and renders one cell of each, so a row's controls are created
 * in different template positions and at different times. What the form holds does not follow any of
 * that: a row exists because `upsert` declared it.
 */
class KeyedRows extends LitElement {
  static properties = { editing: { state: true }, descending: { state: true } };

  rows = createLitForm({
    lines: record(
      group({
        item: field("", [required()]),
        qty: field(1, [(value) => (Number(value) >= 1 ? [] : ["At least 1"])]),
        // A row's own collection: the lots this line draws from, keyed by lot code.
        lots: record(field(1)),
      }),
    ),
  });

  constructor() {
    super();
    this.editing = new Set(["tmp:1"]);
    this.descending = false;
    this.rows.f.lines.setAll({
      12: { item: "Espresso", qty: 2, lots: { A: 2 } },
      34: { item: "Cornetto", qty: 1, lots: { B: 1 } },
      "tmp:1": { item: "", qty: 1, lots: {} },
    });
    // The value and the verdict are read in `render`, so the controller keeps them fresh without
    // this component knowing which cell changed.
    this._tracker = new MdyFormController(this, [this.rows.f.lines.keys, this.rows.value]);
  }

  createRenderRoot() { return this; }

  #keys() {
    return [...this.rows.f.lines.keys()].sort((a, b) =>
      this.descending ? b.localeCompare(a) : a.localeCompare(b),
    );
  }

  #toggle(key) {
    const next = new Set(this.editing);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.editing = next;
  }

  #save(key) {
    const assigned = String(Math.floor(Math.random() * 900) + 100);
    this.rows.f.lines.rename(key, assigned);
    const next = new Set(this.editing);
    next.delete(key);
    next.add(assigned);
    this.editing = next;
  }

  #addLot(key) {
    const lots = this.rows.f.lines.row(key).lots;
    const taken = new Set(lots.keys());
    const code = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !taken.has(c)) ?? `L${taken.size}`;
    lots.upsert(code, 1);
  }

  #remove(key) {
    this.rows.f.lines.remove(key);
    const next = new Set(this.editing);
    next.delete(key);
    this.editing = next;
  }

  render() {
    const keys = this.#keys();
    return html`
      <table class="keyed-rows">
        <thead>
          <tr><th>Key</th><th>Item</th><th>Qty</th><th>Lots</th><th></th></tr>
        </thead>
        <tbody>
          ${keys.map((key) => html`
            <tr class=${this.editing.has(key) ? "editing" : nothing}>
              <td>${key}</td>
              <td>
                ${this.editing.has(key)
        ? html`<mdy-text-field aria-label=${`Item, row ${key}`}
            .field=${this.rows.f.lines.cell(key, "item")}></mdy-text-field>`
        : html`${this.rows.f.lines.cell(key, "item").value() ?? ""}`}
              </td>
              <td>
                ${this.editing.has(key)
        ? html`<mdy-number-field aria-label=${`Quantity, row ${key}`}
            .field=${this.rows.f.lines.cell(key, "qty")}></mdy-number-field>`
        : html`${this.rows.f.lines.cell(key, "qty").value() ?? ""}`}
              </td>
              <td class="keyed-rows-lots">
                ${[...this.rows.f.lines.row(key).lots.keys()].map((code) => html`<span
                  class="keyed-rows-lot">${code}×${this.rows.f.lines.row(key).lots.row(code).value()}</span>`)}
                <button type="button" @click=${() => this.#addLot(key)}>Add lot</button>
              </td>
              <td>
                <button type="button" @click=${() => this.#toggle(key)}>
                  ${this.editing.has(key) ? "Done" : "Edit"}
                </button>
                ${key.startsWith("tmp:")
        ? html`<button type="button" @click=${() => this.#save(key)}>Save</button>`
        : nothing}
                <button type="button" @click=${() => this.#remove(key)}>Remove</button>
              </td>
            </tr>`)}
        </tbody>
      </table>
      <div class="keyed-rows-actions">
        <button type="button" @click=${() => { this.descending = !this.descending; }}>
          ${this.descending ? "Sort ascending" : "Sort descending"}
        </button>
        <button type="button" @click=${() => this.rows.f.lines.upsert(`tmp:${Date.now()}`, { item: "", qty: 1, lots: {} })}>
          Add row
        </button>
        <button type="button" @click=${() => { this.editing = new Set(); }}>Close every editor</button>
      </div>
      <pre class="keyed-rows-state">rows valid: ${this.rows.state.valid()}
declared: ${keys.join(", ") || "(none)"}
${JSON.stringify(this.rows.value().lines, null, 2)}</pre>`;
  }
}
customElements.define("keyed-rows", KeyedRows);

/**
 * A section the form only asks about under a condition, and the attributes nobody wrote.
 *
 * `when` is answered by the engine, so this element declares the fields and renders them; nothing
 * here hides, disables or re-validates anything.
 */
class ConditionalSection extends LitElement {
  account = createLitForm({
    kind: field("personal"),
    company: group(
      {
        name: field("", [required()]),
        code: field("", [minLength(2), maxLength(8), pattern(/^[A-Z]+$/)]),
      },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  constructor() {
    super();
    this._tracker = new MdyFormController(this, [this.account.value, this.account.state.valid]);
  }

  createRenderRoot() { return this; }

  render() {
    const code = this.querySelector('input[id="company.code"]');
    return html`
      <mdy-select-field
        .field=${this.account.f.kind}
        label="Account"
        .options=${[
          { value: "personal", label: "Personal" },
          { value: "company", label: "Company" },
        ]}
      ></mdy-select-field>
      <div class="conditional-details">
        <mdy-text-field .field=${this.account.f.company.name} label="Company name"></mdy-text-field>
        <mdy-text-field .field=${this.account.f.company.code} label="Code"></mdy-text-field>
      </div>
      <pre class="conditional-state" data-conditional-state>${JSON.stringify({
        valid: this.account.state.valid(),
        submitted: Object.keys(this.account.submitValue()),
        kept: this.account.getValue().company,
        codeCarries: code
          ? { maxlength: code.getAttribute("maxlength"), pattern: code.getAttribute("pattern") }
          : null,
      }, null, 2)}</pre>`;
  }
}
customElements.define("conditional-section", ConditionalSection);


// The legend that says what each control on this page is, which keys it claims and which parts it
// draws. Shared with every other example. The host is the app element rather than `#app`: this page
// mounts a custom element, and its light DOM is where the fields land.
legendWhenReady("signup-app", { contracts: MDY_WIDGET_CONTRACTS, keyboard: MDY_WIDGET_KEYBOARD });
