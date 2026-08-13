/**
 * The tables a theme or a conformance checker reads.
 *
 * They describe the contract rather than draw with it: which states a kind can be in, which classes
 * and custom properties are canonical, which tags can carry a label. A renderer needs none of them —
 * it needs part ids, root classes, projections and controllers, which the package entry offers.
 * One flat list for two audiences is how `partClasses` and `MDY_WIDGET_STATE_SUPPORT` came to look
 * like the same kind of thing.
 *
 * The vocabulary is not the contract: the types a presenter implements stay on the entry, because a
 * renderer reaches for them while writing one. Publishing a name from two subpaths would mean a
 * reader has to check both to learn they are the same thing.
 */
export { MDY_SHARED_UI_CLASSES, MDY_FIELD_SHELL_STRUCTURE } from "./structure.js";
export { MDY_LABELABLE_TAGS } from "./relations.js";
export {
  MDY_WIDGET_STATES,
  MDY_WIDGET_STATE_CONTRACTS,
  MDY_WIDGET_STATE_SUPPORT,
  widgetStateMatrixSize,
  widgetSupportsState,
} from "./widget-states.js";
export { MDY_STATE_MODIFIERS } from "./state.js";
export { MDY_CSS_PROPERTY_NAMES } from "./css.js";
export { MDY_CANONICAL_UI_CLASSES } from "./catalog.js";
