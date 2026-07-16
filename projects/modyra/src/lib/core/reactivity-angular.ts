import {
  computed,
  effect,
  Injector,
  signal,
  untracked,
} from "@angular/core";
import { MdyEffectRef, MdyOnCleanup, MdyReactivity } from "@modyra/core";

declare const ngDevMode: boolean | undefined;

const NOOP_EFFECT: MdyEffectRef = { destroy: () => undefined };

/**
 * Binds the framework-agnostic form engine to Angular's native signals: the
 * engine's state IS Angular signal state, so templates, `computed`s and
 * zoneless change detection react to it with no bridging layer.
 *
 * Effects need an {@link Injector}; without one the reactivity reports
 * `canEffect: false` and the engine skips effect-dependent features
 * (async validators, drafts, history) with a warning — matching the
 * behavior of constructing the adapter without an injector.
 */
export function angularReactivity(injector?: Injector): MdyReactivity {
  return {
    canEffect: injector !== undefined,
    signal: <T>(initial: T) => signal(initial),
    computed: <T>(fn: () => T) => computed(fn),
    effect: (fn: (onCleanup: MdyOnCleanup) => void): MdyEffectRef => {
      if (!injector) {
        if (typeof ngDevMode !== "undefined" && ngDevMode) {
          console.warn(
            "[modyra] This feature needs an Injector: construct the adapter " +
              "with one (done automatically by <mdy-form> and mdyForm()).",
          );
        }
        return NOOP_EFFECT;
      }
      return effect((onCleanup) => fn(onCleanup), { injector });
    },
    untracked,
  };
}
