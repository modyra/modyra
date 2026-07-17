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

export {
  selectTransitionFixtures,
} from "./fixtures/transitions.js";
export type {
  MdySelectTransitionFixture,
} from "./fixtures/transitions.js";
