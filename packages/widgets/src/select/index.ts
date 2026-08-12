/**
 * Headless single-select controller.
 */

export {
  createSelectController,
} from "./select-controller.js";
export type {
  MdySelectController,
} from "./select-controller.js";

export type {
  MdySelectControllerOptions,
  MdySelectIntent,
  MdySelectState,
} from "./select-types.js";

export type {
  MdySelectMoveTarget,
} from "./select-keyboard.js";

/**
 * The projection is exported, not only its types.
 *
 * Every other kind publishes the function that turns its state into ARIA. This one published the
 * shape and kept the function, so a renderer wanting a select of its own had to rewrite the
 * projection — which is exactly what ADR 0006 says a renderer must never have to do.
 */
export { projectSelectA11y } from "./select-a11y.js";
export type {
  MdySelectA11yOptions,
  MdySelectA11yProjection,
} from "./select-a11y.js";

export {
  closeOverlay,
  focusTrigger,
  openOverlay,
  restoreFocusTrigger,
  scrollOptionIntoView,
} from "./select-commands.js";

export { optionsWithUnrecognizedValue, optionsWithUnrecognizedValues, reconcileSelectValue } from "../options-reconciliation.js";
export type { MdySelectReconciliationState } from "../options-reconciliation.js";
