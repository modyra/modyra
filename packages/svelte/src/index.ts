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
  MdyBatchingCapability,
  MdyCoreFormOptions,
  MdyFlushCapability,
  MdyFormSchema,
  MdyFormValue,
  MdyObserveCapability,
  MdyReactivity,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";
import type { Readable, Subscriber, Unsubscriber } from "svelte/store";

/**
 * `vanillaReactivity()` tagged `kind: "svelte"`.
 *
 * `createSvelteForm` already runs on the vanilla graph by default; this exists so the capability
 * matrix (`scripts/reactivity-capability-matrix.mjs`) has a named export to introspect, and so a
 * diagnostic can say which host it came from.
 */
export function svelteReactivity(): MdyReactivity &
  MdyBatchingCapability &
  MdyFlushCapability &
  MdyObserveCapability {
  return { ...vanillaReactivity(), kind: "svelte" };
}

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
 * then again on every change) — with one timing difference: since it wraps
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
