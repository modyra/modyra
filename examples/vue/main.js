// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history, a
// cancellable server-side username check and a simulated server error on
// submit. Form state is native Vue reactivity, so plain computed()
// wrappers are all the glue a component needs.
import { computed, createApp, onMounted, onUnmounted, ref, watchEffect } from "vue";
import {
  createVueForm, crossField, email, field, minLength, mountMdyDevtools, required,
  serverValidator,
} from "@modyra/vue";

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

const TextField = {
  props: { label: String, handle: Object, type: { type: String, default: "text" } },
  setup(props) {
    return {
      value: computed(() => props.handle.value() ?? ""),
      errors: computed(() => (props.handle.touched() ? props.handle.errors() : [])),
      invalid: computed(() => !props.handle.valid()),
      isRequired: computed(() => props.handle.required()),
      touched: computed(() => props.handle.touched()),
      // Async validators keep the field pending until the run settles.
      pending: computed(() => props.handle.pending()),
    };
  },
  template: `
    <div class="mdy-renderer mdy-renderer--text" :class="{ 'mdy-renderer--touched': touched }">
      <label class="mdy-label">
        {{ label }}<span v-if="isRequired" class="mdy-label__required" aria-hidden="true">*</span>
      </label>
      <div class="mdy-input-wrapper">
        <input :type="type" :value="value" :aria-invalid="invalid" :aria-required="isRequired"
               @input="handle.set($event.target.value)" @blur="handle.markAsTouched()" />
      </div>
      <div v-if="pending" class="mdy-supporting-text" role="status">checking…</div>
      <ul v-if="errors.length" class="mdy-control__errors" role="alert">
        <li v-for="er in errors" :key="er.message" class="mdy-control__error">{{ er.message }}</li>
      </ul>
    </div>`,
};

const THEMES = { default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };

createApp({
  components: { TextField },
  setup() {
    // Swaps the theme stylesheet at runtime — every packaged theme works
    // with the same markup, so switching is just a different href.
    const theme = ref("ios");
    watchEffect(() => {
      document.getElementById("theme").href = `./themes/${THEMES[theme.value]}`;
    });
    let dispose;
    onMounted(() => { dispose = mountMdyDevtools(form, document.getElementById("devtools")); });
    onUnmounted(() => dispose?.());
    return {
      theme,
      themes: THEMES,
      form,
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
        <text-field label="Username" :handle="form.f.username" />
        <text-field label="Name" :handle="form.f.name" />
        <text-field label="Email" :handle="form.f.email" type="email" />
        <text-field label="Password" :handle="form.f.password" type="password" />
        <text-field label="Confirm password" :handle="form.f.confirm" type="password" />
        <div style="display:flex;gap:.5rem">
          <button type="submit" :disabled="!canSubmit">Sign up</button>
          <button type="button" :disabled="!canUndo" @click="form.undo()">Undo</button>
          <button type="button" :disabled="!canRedo" @click="form.redo()">Redo</button>
        </div>
      </form>
      <div id="devtools"></div>
    </main>`,
}).mount("#app");
