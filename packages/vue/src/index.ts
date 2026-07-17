/**
 * @modyra/vue — binds the Modyra form engine to Vue's reactivity.
 *
 * Form state becomes @vue/reactivity state (shallowRef/computed), so
 * templates and watchers react to it natively.
 */
import {
  createForm,
  MdyCoreFormOptions,
  MdyFormSchema,
  MdyFormValue,
  MdyOnCleanup,
  MdyReactivity,
  MdyTypedForm,
  MdyWritableSignal,
} from "@modyra/core";
import {
  getCurrentScope,
  onScopeDispose,
  pauseTracking,
  resetTracking,
  shallowRef,
  stop,
  computed as vueComputed,
  effect as vueEffect,
} from "@vue/reactivity";

/** Modyra's reactive contract implemented on @vue/reactivity. */
export function vueReactivity(): MdyReactivity {
  return {
    canEffect: true,
    signal<T>(initial: T): MdyWritableSignal<T> {
      // shallowRef: the engine owns immutability (it always replaces
      // records/maps), deep proxying would change semantics.
      const r = shallowRef(initial);
      const read = (() => r.value) as MdyWritableSignal<T>;
      read.set = (value: T) => (r.value = value);
      read.update = (fn: (value: T) => T) => (r.value = fn(r.value));
      read.asReadonly = () => () => r.value;
      return read;
    },
    computed<T>(fn: () => T) {
      const c = vueComputed(fn);
      return () => c.value;
    },
    effect(fn: (onCleanup: MdyOnCleanup) => void) {
      let cleanups: Array<() => void> = [];
      const runCleanups = (): void => {
        const list = cleanups;
        cleanups = [];
        for (const cleanup of list) cleanup();
      };
      const runner = vueEffect(() => {
        runCleanups();
        fn((cleanup) => cleanups.push(cleanup));
      });
      return {
        destroy: () => {
          runCleanups();
          stop(runner);
        },
      };
    },
    untracked<T>(fn: () => T): T {
      pauseTracking();
      try {
        return fn();
      } finally {
        resetTracking();
      }
    },
  };
}

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
