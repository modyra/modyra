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

import { getCurrentScope, onScopeDispose } from "@vue/reactivity";

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
 * Vue composable variant of {@link createVueForm}: when called inside an
 * active effect scope, the form is automatically destroyed on scope dispose.
 */
export function useVueForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  const form = createVueForm(schema, options);
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => form.destroy());
  }
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";


