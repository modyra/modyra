/**
 * `@modyra/vue` — the engine bound to Vue's reactivity.
 */

import {
  createForm,
  MdyCoreFormOptions,
  MdyFormSchema,
  MdyFormValue,
  MdyTypedForm,
} from "@modyra/core";

import {
  getCurrentInstance,
  getCurrentScope,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
} from "vue";

import { vueReactivity } from "./reactivity.js";

export { vueReactivity } from "./reactivity.js";

/**
 * `createForm` preconfigured with Vue reactivity:
 *
 * ```ts
 * const form = createVueForm({ email: field("", [required()]) });
 * // form.f.email.value() participates in Vue reactivity
 * ```
 */
export function createVueForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: vueReactivity() });
}

/**
 * Vue composable variant of {@link createVueForm}. In a component's setup
 * the form is built inactive, activated on mount and paused before unmount:
 * a server render never mounts, so draft storage, history and async
 * validators never start there. Outside a component the form is active at
 * once, like {@link createVueForm}. Inside an active effect scope it is
 * destroyed on scope dispose.
 */
export function useVueForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  const inComponent = getCurrentInstance() !== null;
  const form = createVueForm(
    schema,
    inComponent ? { ...options, autoActivate: false } : options,
  );
  if (inComponent) {
    onMounted(() => form.activate());
    onBeforeUnmount(() => form.deactivate());
  }
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => form.destroy());
  }
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";


