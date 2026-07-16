import { InjectionToken } from "@angular/core";
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
 * Provided by MdyFloatingLabelsDirective to enable floating labels globally on a form.
 */
export const MDY_FLOATING_LABELS = new InjectionToken<
  import("../form/mdy-floating-labels.directive").MdyFloatingLabelsDirective
>("MDY_FLOATING_LABELS");

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

