import {
  computed,
  effect,
  Injector,
  signal,
  untracked,
} from "@angular/core";
import {
  MdyComputedOptions,
  MdyDiagnostics,
  MdyEffectOptions,
  MdyEffectRef,
  MdyOnCleanup,
  MdyReactivity,
  MdySignalOptions,
  MdyUnsupportedCapabilityError,
  MDY_EFFECTS_UNAVAILABLE,
} from "@modyra/core";

declare const ngDevMode: boolean | undefined;

export interface AngularReactivityOptions {
  /** Needed to run effects (async validators, drafts, history). */
  injector?: Injector | undefined;
  /**
   * `"throw"` (default): `effect()` throws {@link MdyUnsupportedCapabilityError}
   * when called without an Injector — the engine already checks
   * `capabilities.effects` before calling `effect()` for its own
   * features, so this only fires for a caller that skipped that check.
   * `"report"`: degrade to a disabled effect instead of throwing (the pre-M4
   * behavior), but always through {@link MdyDiagnostics} — never silently.
   */
  unsupported?: "throw" | "report" | undefined;
  /** Receives structured diagnostics (see `@modyra/core`'s `MDY_*` codes). */
  diagnostics?: MdyDiagnostics | undefined;
}

interface NormalizedAngularReactivityOptions {
  readonly injector: Injector | undefined;
  readonly unsupported: "throw" | "report";
  readonly diagnostics: MdyDiagnostics | undefined;
}

function normalizeOptions(
  arg: Injector | AngularReactivityOptions | undefined,
): NormalizedAngularReactivityOptions {
  const isOptionsBag =
    arg !== undefined &&
    typeof arg === "object" &&
    ("injector" in arg || "unsupported" in arg || "diagnostics" in arg);
  const options: AngularReactivityOptions = isOptionsBag
    ? (arg as AngularReactivityOptions)
    : { injector: arg as Injector | undefined };
  return {
    injector: options.injector,
    unsupported: options.unsupported ?? "throw",
    diagnostics: options.diagnostics,
  };
}


/**
 * Whether effects can actually be run with this injector, asked rather than inferred.
 *
 * Holding an injector was taken to mean effects work, which is a proxy for the question and not the
 * question. An injector created with no parent — `Injector.create({ providers: [] })` — has no
 * `ChangeDetectionScheduler`, so `effect()` raises `NG0201` from inside Angular *after* the
 * capability has already promised effects. The no-injector path degrades honestly and warns; the
 * better-looking input produced the worse failure.
 *
 * Measured, so the boundary is stated rather than guessed: a parentless `Injector.create` raises,
 * while `TestBed.inject(Injector)` and a `createEnvironmentInjector` child of an application
 * injector both run. So this is reached by a detached container rather than by anything `inject()`
 * hands a component — but the cost of asking is one effect created and destroyed at construction,
 * and the cost of inferring is a capability that lies.
 *
 * The same shape as `solidReactivity` probing its graph rather than matching a build.
 */
function canRunEffects(injector: Injector | undefined): boolean {
  if (injector === undefined) return false;
  try {
    effect(() => { /* nothing: the question is whether creating one is allowed */ }, { injector })
      .destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Binds the framework-agnostic form engine to Angular's native signals: the
 * engine's state IS Angular signal state, so templates, `computed`s and
 * zoneless change detection react to it with no bridging layer.
 *
 * Effects need an {@link Injector}; without one `capabilities.effects` reports
 * `false` and the engine skips
 * effect-dependent features (async validators, drafts, history) with a
 * warning — the capability check happens before `effect()` is ever called
 * for those. Accepts either an `Injector` directly (existing call sites) or
 * an {@link AngularReactivityOptions} bag.
 */
export function angularReactivity(
  injectorOrOptions?: Injector | AngularReactivityOptions,
): MdyReactivity {
  const { injector, unsupported, diagnostics } =
    normalizeOptions(injectorOrOptions);
  const hasEffects = canRunEffects(injector);

  return {
    id: Symbol("angular"),
    kind: "angular",
    capabilities: {
      effects: hasEffects,
      // Angular's EffectRef.destroy() is a real, idempotent teardown when
      // an Injector is present — wrapped below so MdyEffectRef.destroyed
      // is honest too (Angular's own EffectRef has no such getter).
      effectOwnership: hasEffects,
      // Angular's signal()/computed() both accept a real `equal` predicate.
      signalEquality: true,
      computedEquality: true,
      batching: false,
      deterministicFlush: false,
      directObservation: false,
      // Angular refuses the write itself (NG0600), which is the same rule from the other side.
      pureComputeds: true,
      graphInspection: false,
      serverSnapshots: false,
    },
    signal: <T>(initial: T, options?: MdySignalOptions<T>) =>
      signal(initial, options?.equal ? { equal: options.equal } : undefined),
    computed: <T>(fn: () => T, options?: MdyComputedOptions<T>) =>
      computed(fn, options?.equal ? { equal: options.equal } : undefined),
    effect: (
      fn: (onCleanup: MdyOnCleanup) => void,
      effectOptions?: MdyEffectOptions,
    ): MdyEffectRef => {
      if (!injector) {
        const message =
          "[modyra] This feature needs an Injector: construct the adapter " +
          "with one (done automatically by <mdy-form> and mdyForm()).";
        diagnostics?.report({
          code: MDY_EFFECTS_UNAVAILABLE,
          severity: unsupported === "throw" ? "error" : "warning",
          feature: effectOptions?.debugName,
          adapter: "angular",
          message,
        });
        if (unsupported === "throw") {
          throw new MdyUnsupportedCapabilityError("effects", "angular");
        }
        // "report" mode: an explicit, diagnosed degradation — not the
        // silent default. Still dev-console-warns absent a diagnostics sink.
        if (typeof ngDevMode !== "undefined" && ngDevMode && !diagnostics) {
          console.warn(message);
        }
        return { destroy: () => undefined, destroyed: true };
      }
      let destroyed = false;
      const ref = effect((onCleanup) => {
        try {
          fn(onCleanup);
        } catch (error) {
          // Respect onError when given (piano §4.2/§8.3 — an accepted
          // option must not be silently ignored). Without one, rethrow so
          // Angular's own ErrorHandler receives it, same as today.
          if (effectOptions?.onError) effectOptions.onError(error);
          else throw error;
        }
      }, { injector });
      const wrapped: MdyEffectRef = {
        destroy: () => {
          if (destroyed) return;
          destroyed = true;
          ref.destroy();
        },
        get destroyed() {
          return destroyed;
        },
      };
      effectOptions?.scope?.onCleanup(() => wrapped.destroy());
      return wrapped;
    },
    untracked,
  };
}
