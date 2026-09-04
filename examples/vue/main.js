// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history, a
// cancellable server-side username check and a simulated server error on
// submit. Form state is native Vue reactivity, so plain computed()
// wrappers are all the glue a component needs.
import { computed, createApp, onMounted, onUnmounted, ref, watchEffect } from "vue";
import {
  createVueForm, crossField, email, field, minLength, required,
  serverValidator,
  // The controls themselves. Everything a widget owes — its parts, classes, ARIA relations, the
  // native input its kind asks for — lives in these and is derived from the published contract.
  MdyBooleanField, MdyColorsField, MdyDatepickerField, MdyDaterangeField, MdyFileField,
  MdyMultiselectField, MdyOptionField, MdySelectField, MdySliderField, MdyTextField,
  MdyTimepickerField,
} from "@modyra/vue";
// The inspector is a development tool, not part of a form. `IfWanted` mounts it when the build
// says development and skips it otherwise — and takes `true` or `false` when you want to decide
// yourself, in either direction.
import { mountMdyDevtoolsIfWanted } from "@modyra/core/devtools";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { legendWhenReady } from "../shared/legend.js";
import { everyKind } from "../shared/scenarios/every-kind.js";

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

const form = createVueForm(
  {
    // Debounced, cancellable availability check with a 2s timeout —
    // try "admin" or "root".
    username: field(
      "",
      [required(), minLength(3)],
      serverValidator(
        async (value, { signal }) =>
          (await isUsernameTaken(value, signal)) ? "Username is already taken" : null,
        { debounceMs: 300, timeoutMs: 2000 },
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
    draft: { key: "signup-vue", exclude: ["password", "confirm"] },
  },
);

/**
 * Which component draws which kind.
 *
 * The only thing this demo knows that the contract does not: how *this framework* mounts a control.
 * Everything below that line — the classes, the ARIA, the native input a kind asks for, which parts
 * a widget owes — belongs to the components and is not written here. It used to be: this file
 * hand-rolled a text field, copying `mdy-renderer--text`, `mdy-label`, `mdy-input-wrapper`,
 * `aria-invalid` and `aria-required` beside a package that ships seventeen components deriving all
 * of them. A demo doing what the library exists to stop is the worst place for it to happen.
 */
const DRAWN_BY = {
  text: ["mdy-text-field", { kind: "text" }],
  email: ["mdy-text-field", { kind: "email" }],
  password: ["mdy-text-field", { kind: "password" }],
  textarea: ["mdy-text-field", { kind: "textarea" }],
  number: ["mdy-text-field", { kind: "number" }],
  checkbox: ["mdy-boolean-field", { kind: "checkbox" }],
  toggle: ["mdy-boolean-field", { kind: "toggle" }],
  radio: ["mdy-option-field", { kind: "radio" }],
  segmented: ["mdy-option-field", { kind: "segmented" }],
  select: ["mdy-select-field", { searchable: true }],
  multiselect: ["mdy-multiselect-field", { mode: "single" }],
  slider: ["mdy-slider-field", {}],
  file: ["mdy-file-field", {}],
  datepicker: ["mdy-datepicker-field", {}],
  daterange: ["mdy-daterange-field", {}],
  timepicker: ["mdy-timepicker-field", {}],
  colors: ["mdy-colors-field", {}],
};

/** The catalogue scenario, as this page needs it: the fields, and the component for each. */
const SHOWCASE = everyKind.fields().map((field) => {
  const drawn = DRAWN_BY[field.kind];
  // Refused rather than skipped: a kind the shared declaration carries and this page cannot draw is
  // a hole in the demo, and a page that quietly renders sixteen looks finished.
  if (!drawn) throw new Error(`[vue demo] no component declared for kind "${field.kind}"`);
  const [is, extra] = drawn;
  return { ...field, is, extra: { ...extra, ...(field.options ? { options: field.options } : {}) } };
});

const showcase = createVueForm(
  Object.fromEntries(SHOWCASE.map((entry) => [entry.name, field(entry.initial)])),
);

const THEMES = { modern: "modyra-modern.css", default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };

createApp({
  components: {
    MdyTextField, MdyBooleanField, MdyOptionField, MdySelectField, MdyMultiselectField,
    MdySliderField, MdyFileField, MdyDatepickerField, MdyDaterangeField, MdyTimepickerField,
    MdyColorsField,
  },
  setup() {
    // Swaps the theme stylesheet at runtime — every packaged theme works
    // with the same markup, so switching is just a different href.
    const theme = ref("ios");
    watchEffect(() => {
      document.getElementById("theme").href = `./themes/${THEMES[theme.value]}`;
    });
    let dispose;
    onMounted(() => { dispose = mountMdyDevtoolsIfWanted(form, document.getElementById("devtools")); });
    onUnmounted(() => dispose?.());
    return {
      theme,
      themes: THEMES,
      form,
      showcase,
      SHOWCASE,
      canSubmit: computed(() => form.state.canSubmit()),
      canUndo: computed(() => form.canUndo()),
      canRedo: computed(() => form.canRedo()),
      submit: () =>
        form.submit(async (value) => {
          // Returned errors are shown on the matching fields until edited.
          if (value.email === "taken@example.com") {
            return [{ path: "email", kind: "server", message: "This email is already registered" }];
          }
          console.log("submitted", value);
        }),
    };
  },
  template: `
    <main style="max-width:30rem;margin:2rem auto;display:grid;gap:1rem">
      <h1>Modyra × Vue</h1>
      <label class="mdy-label" style="display:flex;gap:.5rem;align-items:center">
        Theme
        <select v-model="theme">
          <option v-for="t in Object.keys(themes)" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <p>Try username <code>admin</code> for a cancellable server check, <code>taken@example.com</code> for a server error. Reload mid-typing: the draft survives.</p>
      <form class="mdy-form" @submit.prevent="submit()">
        <mdy-text-field label="Username" :field="form.f.username" widget-id="signup-username" />
        <mdy-text-field label="Name" :field="form.f.name" widget-id="signup-name" />
        <mdy-text-field label="Email" :field="form.f.email" kind="email" widget-id="signup-email" />
        <mdy-text-field label="Password" :field="form.f.password" kind="password" widget-id="signup-password" />
        <mdy-text-field label="Confirm password" :field="form.f.confirm" kind="password" widget-id="signup-confirm" />
        <div style="display:flex;gap:.5rem">
          <button type="submit" :disabled="!canSubmit">Sign up</button>
          <button type="button" :disabled="!canUndo" @click="form.undo()">Undo</button>
          <button type="button" :disabled="!canRedo" @click="form.redo()">Redo</button>
        </div>
      </form>
      <h2>Every kind the catalogue declares</h2>
      <p>Declared once in <code>examples/shared/scenarios</code> and rendered by every demo: the
         pages differ in how a form is mounted, not in what a form is.</p>
      <form class="mdy-form">
        <component v-for="entry in SHOWCASE" :key="entry.name" :is="entry.is"
                   :field="showcase.f[entry.name]" :label="entry.label"
                   :widget-id="'showcase-' + entry.name" v-bind="entry.extra" />
      </form>
      <div id="devtools"></div>
    </main>`,
}).mount("#app");

// The legend that says what each control on this page is, which keys it claims and which parts it
// draws. Shared with every other example: the demos differ in how they mount a form, not in what a
// form is, and a legend written per demo would drift per demo.
legendWhenReady("#app", { contracts: MDY_WIDGET_CONTRACTS, keyboard: MDY_WIDGET_KEYBOARD });

