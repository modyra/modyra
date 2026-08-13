/**
 * `@modyra/solid` — the engine bound to Solid's reactive graph.
 */

import {
  createForm,
  MdyCoreFormOptions,
  MdyFormSchema,
  MdyFormValue,
  MdyTypedForm,
} from "@modyra/core";

import { getOwner, onCleanup } from "solid-js";

import { solidReactivity } from "./reactivity.js";

export { solidReactivity } from "./reactivity.js";

/**
 * `createForm` preconfigured with Solid reactivity:
 *
 * ```ts
 * const form = createSolidForm({ email: field("", [required()]) });
 * // form.f.email.value() participates in Solid's reactive graph
 * ```
 */
export function createSolidForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: solidReactivity() });
}

/**
 * Solid variant of {@link createSolidForm}: when called inside an active
 * owner (a component or `createRoot`), the form is automatically destroyed
 * on owner cleanup.
 */
export function useSolidForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  const form = createSolidForm(schema, options);
  if (getOwner() !== null) {
    onCleanup(() => form.destroy());
  }
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";

