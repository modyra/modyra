// Demo Vue — same signup form as the React/Lit/Angular demos, iOS theme.
import { createApp, computed, onMounted } from "vue";
import {
  createVueForm, email, field, minLength, mountMdyDevtools, required,
} from "@modyra/vue";

const form = createVueForm({
  name: field("", [required(), minLength(2)]),
  email: field("", [required(), email()]),
});

const FieldRow = {
  props: ["label", "path", "type"],
  setup(props) {
    const handle = props.path === "name" ? form.f.name : form.f.email;
    return {
      handle,
      value: computed(() => handle.value()),
      errors: computed(() => (handle.touched() ? handle.errors() : [])),
      invalid: computed(() => !handle.valid()),
      touched: computed(() => handle.touched()),
    };
  },
  template: `
    <div class="mdy-renderer mdy-renderer--text" :class="{ 'mdy-renderer--touched': touched }">
      <label class="mdy-label">{{ label }}</label>
      <div class="mdy-input-wrapper">
        <input :type="type ?? 'text'" :value="value" :aria-invalid="invalid"
               @input="handle.set($event.target.value)" @blur="handle.markAsTouched()" />
      </div>
      <ul v-if="errors.length" class="mdy-control__errors" role="alert">
        <li v-for="er in errors" :key="er.message" class="mdy-control__error">{{ er.message }}</li>
      </ul>
    </div>`,
};

createApp({
  components: { FieldRow },
  setup() {
    onMounted(() => mountMdyDevtools(form, document.getElementById("devtools")));
    return { submit: () => form.submit((v) => console.log(v)) };
  },
  template: `
    <main style="max-width:28rem;margin:2rem auto;display:grid;gap:1rem">
      <h1>Modyra × Vue</h1>
      <form class="mdy-form" @submit.prevent="submit()">
        <field-row label="Name" path="name" />
        <field-row label="Email" path="email" type="email" />
        <button type="submit">Sign up</button>
      </form>
      <div id="devtools"></div>
    </main>`,
}).mount("#app");
