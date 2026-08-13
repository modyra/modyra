/**
 * The widget catalogue.
 *
 * Was one file of eight hundred lines holding the vocabulary, the builder, four side tables, the
 * semantic map and the seventeen definitions — with an in-degree of twenty-four, so every consumer
 * paid for all of it to read one class name.
 *
 * Named re-exports rather than a wildcard: splitting a file must not publish what it used to keep to
 * itself. `define`, the tables it consults and `semanticElement` are how a definition is assembled,
 * and a consumer that could reach them could assemble one this package does not know about.
 */
export {
  MDY_POPUP_CLASS,
  MDY_POPUP_OPENERS,
  MDY_POPUP_SURFACE_CLASS,
} from "./catalog/define.js";
export type { MdyPopupOpener } from "./catalog/define.js";

export { MDY_OVERLAY_PORTAL_CLASS, MDY_WIDGET_KINDS } from "./catalog/kinds.js";
export type {
  MdyWidgetDefinition,
  MdyWidgetKind,
  MdyWidgetVariant,
} from "./catalog/kinds.js";

export { MDY_CANONICAL_UI_CLASSES, MDY_WIDGET_CONTRACTS } from "./catalog/contracts.js";
export type { MdyPopupWidgetKind, MdyWidgetPart } from "./catalog/contracts.js";
