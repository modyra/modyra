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

import { getOwner, onCleanup, onMount } from "solid-js";

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
 * Solid variant of {@link createSolidForm}. Inside an active owner (a
 * component or `createRoot`) the form is built inactive and activated on
 * mount, and destroyed on owner cleanup: a server render never mounts, so
 * draft storage, history and async validators never start there. With no
 * owner the form is active at once, like {@link createSolidForm}.
 */
export function useSolidForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  if (getOwner() === null) return createSolidForm(schema, options);
  const form = createSolidForm(schema, { ...options, autoActivate: false });
  onMount(() => form.activate());
  onCleanup(() => form.destroy());
  return form;
}

export * from "@modyra/core";
export * from "./widgets/index.js";

