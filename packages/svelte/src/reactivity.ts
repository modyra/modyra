/**
 * Modyra's reactive contract on Svelte, and a signal seen as a Svelte store.
 *
 * Its own module rather than the package entry: a widget hook needs the store adapter, the entry
 * re-exports the hooks, and an adapter declared in the entry makes the two import each other.
 */

import {
  MdyBatchingCapability,
  MdyFlushCapability,
  MdyObserveCapability,
  MdyReactivity,
  MdySignal,
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
