import { InjectionToken, type Signal } from "@angular/core";
import type { MdyDeclarativeRegistry } from "./declarative-form-adapter";
import { MdyFormAdapter, MdyOptionsControl } from "./types";

/**
 * Scoped to MdyFormComponent via providers[].
 * Injected by renderer components to resolve FieldRefs.
 */
export const MDY_FORM_ADAPTER = new InjectionToken<
  MdyFormAdapter<Record<string, unknown>>
>("MDY_FORM_ADAPTER");

/**
 * When provided on an element injector, renderers display errors
 * inline next to the label rather than as a block below the input.
 */
export const MDY_INLINE_ERRORS = new InjectionToken<boolean>(
  "MDY_INLINE_ERRORS",
);

/**
 * Provided by select/multiselect renderers to allow conditional directives
 * to push filtered options back into the component.
 */
export const MDY_OPTIONS_CONTROL = new InjectionToken<MdyOptionsControl<unknown>>(
  "MDY_OPTIONS_CONTROL",
);

/**
 * What a provider of {@link MDY_FLOATING_LABELS} answers.
 *
 * The contract rather than the class that satisfies it. A token typed as its own provider makes the
 * two files name each other — the token needs the directive's type, the directive needs the token to
 * provide itself — and a type-only ring compiles, ships, and objects to nothing until somebody tries
 * to move one of the two. Named here, the direction is the one it should be: the directive derives
 * from what the token promises, and an injector reads only what is promised.
 */
export interface MdyFloatingLabelsSource {
  /**
   * Whether descendants float their labels.
   *
   * The only thing anything asks this token, and so the whole of what it promises. Density is the
   * provider's own business: it is applied to the host element as a custom property and inherits
   * from there, so nothing injects it and nothing needs it declared.
   */
  readonly mdyFloatingLabels: Signal<boolean>;
}

/**
 * Provided by MdyFloatingLabelsDirective to enable floating labels globally on a form.
 */
export const MDY_FLOATING_LABELS = new InjectionToken<MdyFloatingLabelsSource>("MDY_FLOATING_LABELS");

/**
 * Global default for whether floating labels are enabled.
 * Override at application root to change the default for all forms.
 * Defaults to `false` (floating labels opt-in via `mdyFloatingLabels` directive).
 */
export const MDY_FLOATING_LABELS_DEFAULT = new InjectionToken<boolean>(
  "MDY_FLOATING_LABELS_DEFAULT",
  { providedIn: "root", factory: () => false },
);

/**
 * Global default density for floating labels.
 * Replicates M3 density semantics: 0 = standard 56px, negative values compact.
 * Defaults to `-2` (48px, balanced compactness).
 */
export const MDY_FLOATING_LABELS_DENSITY_DEFAULT = new InjectionToken<number>(
  "MDY_FLOATING_LABELS_DENSITY_DEFAULT",
  { providedIn: "root", factory: () => -2 },
);

/**
 * Provided by MdyFormComponent in declarative mode (no explicit [adapter] input).
 * Validator directives inject this to register their rules on specific fields.
 */
export const MDY_DECLARATIVE_REGISTRY = new InjectionToken<MdyDeclarativeRegistry>(
  "MDY_DECLARATIVE_REGISTRY",
);

