/**
 * @modyra/svelte — binds the Modyra form engine to Svelte, via stores.
 *
 * Why stores, not runes: Svelte 5's runes (`$state`/`$derived`/`$effect`)
 * are compiler macros — they only work inside a `.svelte` file or a
 * `.svelte.js`/`.svelte.ts` module compiled by the Svelte compiler. A
 * plain, `tsc`-built npm package (this one) cannot use them; calling
 * `$state()` in ordinary JavaScript is a `ReferenceError`. `svelte/store`
 * (`writable`/`derived`/`get`/the `Readable` contract), by contrast, is
 * real, uncompiled JavaScript — it has worked outside `.svelte` files
 * since Svelte 3 and Svelte 5 still fully supports it. So the engine
 * runs on the core's `vanillaReactivity()` (same as `@modyra/react` and
 * `@modyra/preact` — Svelte has no exported fine-grained signal any more
 * than React does), and {@link toStore} adapts any Modyra signal into a
 * real `Readable`, so a `.svelte` template can write `{$emailStore}` and
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
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";
import type { Readable, Subscriber, Unsubscriber } from "svelte/store";

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

/**
 * Adapts any Modyra signal (a field's `.value`/`.errors`/`.valid`…, or
 * `form.state.canSubmit`, `form.canUndo`, …) into a real Svelte
 * `Readable`, so `.svelte` templates can use the native `$store` syntax
 * instead of manually polling. Each `subscribe()` call runs its own
 * tracking effect on the vanilla graph and honors the store contract
 * (the subscriber is called once, synchronously, with the current value,
 * then again on every change) — with one honest caveat: since it wraps
 * an *effect*, later notifications are microtask-batched like every
 * other effect-driven feature in the engine (async validators, drafts,
 * history), not perfectly synchronous the way Svelte's own `writable()`
 * is. A `.svelte` component's `$store` re-render still happens correctly
 * (Svelte re-renders whenever the subscriber fires), just one microtask
 * after the underlying value changes rather than in the same tick.
 */
export function toStore<T>(signal: MdySignal<T>): Readable<T> {
  return {
    subscribe(run: Subscriber<T>): Unsubscriber {
      const rx = vanillaReactivity();
      const ref = rx.effect(() => {
        run(signal());
      });
      return () => ref.destroy();
    },
  };
}

export * from "@modyra/core";
export * from "./widgets/index.js";
