/**
 * @modyra/solid — binds the Modyra form engine to Solid's reactivity.
 *
 * Solid's primitives map almost 1:1 onto the engine's reactive contract:
 * `createSignal` → signal, `createMemo` → computed, `createEffect` →
 * effect. The one gap is a manually-destroyable effect handle (the engine
 * calls `effect(...).destroy()` outside any component lifecycle, e.g. for
 * async validators/drafts/history) — each effect runs inside its own
 * `createRoot` so `destroy()` disposes it independent of the caller's own
 * owner.
 *
 * Testing/SSR note: solid-js's `package.json` maps the plain Node import
 * condition to `dist/server.js`, a non-reactive SSR stub (signals/effects
 * run once, never notify). Any Node process consuming this package —
 * `node --test`, a server-rendered handler, ts-node, etc. — must be run
 * with `--conditions=browser` (see this package's own `test` script) or
 * every signal in this file silently becomes inert.
 */
import {
  createForm,
  MdyCoreFormOptions,
  MdyEffectRef,
  MdyFormSchema,
  MdyFormValue,
  MdyOnCleanup,
  MdyReactivity,
  MdyTypedForm,
  MdyWritableSignal,
} from "@modyra/core";
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
} from "solid-js";

/** Modyra's reactive contract implemented on Solid's native signals. */
export function solidReactivity(): MdyReactivity {
  return {
    canEffect: true,
    signal<T>(initial: T): MdyWritableSignal<T> {
      const [get, set] = createSignal(initial);
      const read = (() => get()) as MdyWritableSignal<T>;
      // Wrapped in `() => value`: Solid's setter calls a function argument
      // as an updater, which would misfire for field values that happen
      // to be functions themselves.
      read.set = (value: T) => set(() => value);
      read.update = (fn: (value: T) => T) => set((prev) => fn(prev as T));
      read.asReadonly = () => () => get();
      return read;
    },
    computed<T>(fn: () => T): () => T {
      const memo = createMemo(fn);
      return () => memo();
    },
    effect(fn: (onCleanup: MdyOnCleanup) => void): MdyEffectRef {
      let dispose!: () => void;
      createRoot((disposeRoot) => {
        dispose = disposeRoot;
        createEffect(() => fn((cleanup) => onCleanup(cleanup)));
      });
      return { destroy: () => dispose() };
    },
    untracked<T>(fn: () => T): T {
      return untrack(fn);
    },
  };
}

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
