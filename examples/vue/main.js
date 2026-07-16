// Demo Vue: consumes @modyra/vue from node_modules (the built package).
import { createApp, computed } from "vue";
import { createVueForm, field, required } from "@modyra/vue";

const form = createVueForm({ email: field("", [required()]) });

createApp({
  setup() {
    return {
      email: computed(() => form.f.email.value()),
      errors: computed(() => (form.f.email.touched() ? form.f.email.errors() : [])),
      valid: computed(() => form.state.valid()),
      onInput: (e) => form.f.email.set(e.target.value),
      onBlur: () => form.f.email.markAsTouched(),
      submit: () => form.submit((v) => console.log(v)),
    };
  },
  template: `
    <form @submit.prevent="submit()">
      <label>Email <input :value="email" @input="onInput" @blur="onBlur" :aria-invalid="!valid" /></label>
      <p v-for="er in errors" :key="er.message">{{ er.message }}</p>
      <button type="submit">Sign up</button>
    </form>`,
}).mount("#app");
