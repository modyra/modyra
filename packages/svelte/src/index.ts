/**
 * @modyra/svelte — binds the Modyra form engine to Svelte, via stores.
 *
 * Why stores, not runes: Svelte 5's runes (`$state`/`$derived`/`$effect`)
 * are compiler macros — they only work inside a `.svelte` file or a
 * `.svelte.js`/`.svelte.ts` module compiled by the Svelte compiler. A
 * plain, `tsc`-built npm package (this one) cannot use them; calling
 * `$state()` in ordinary JavaScript is a `ReferenceError`. `svelte/store`
 * (`writable`/`derived`/`get`/the `Readable` contract), by contrast, is
 * ordinary JavaScript — it has worked outside `.svelte` files
 * since Svelte 3 and Svelte 5 still fully supports it. So the engine
 * runs on the core's `vanillaReactivity()` — this host exports no fine-grained signal to bind to —
 * and {@link toStore} adapts any Modyra signal into a
 * Svelte `Readable`, so a `.svelte` template can write `{$emailStore}` and
 * subscribe to it the native way. A runes-based ergonomic layer is
 * possible as a follow-up (a small `@modyra/svelte/runes` subpath built
 * through the Svelte compiler) but is a separate, larger toolchain
 * decision — not this package's job.
 */
import {
  createForm,
  MdyCoreFormOptions,
  MdyFormSchema,
  MdyFormValue,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";

/**
 * `createForm` preconfigured with the vanilla reactive graph:
 *
 * ```ts
 * const form = createSvelteForm({ email: field("", [required()]) });
 * const email = toStore(form.f.email.value);
 * // <script>const emailValue = $email;</script> — auto-subscribed
 * ```
 */
export function createSvelteForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: vanillaReactivity() });
}

export { svelteReactivity, toStore } from "./reactivity.js";

export * from "@modyra/core";
export * from "./widgets/index.js";

