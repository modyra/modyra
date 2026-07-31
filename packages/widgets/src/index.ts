/**
 * @modyra/widgets — headless widget controllers and universal
 * interaction/accessibility contract.
 */

export type {
  MdyPartContract,
  MdyWidgetController,
  MdyWidgetViewContract,
  MdyTypedWidgetViewContract,
} from "./contract.js";

export {
  MDY_FIELD_SHELL_CLASSES,
  MDY_FIELD_SHELL_STRUCTURE,
  MDY_WIDGET_CONTRACT_VERSION,
} from "./structure.js";
export type {
  MdyFieldShellPart,
  MdyPartMap,
  MdyWidgetSemanticElement,
  MdyWidgetStructure,
  MdyWidgetStructureNode,
} from "./structure.js";

export type {
  MdyElementTarget,
  MdyUiCommand,
} from "./commands.js";

export {
  defaultWidgetIdFactory,
  isValidWidgetId,
  MDY_ID_DELIMITER,
} from "./ids.js";
export type {
  MdyWidgetIdFactory,
} from "./ids.js";

export {
  browserRuntimeCapabilities,
  ssrRuntimeCapabilities,
} from "./runtime.js";
export type {
  MdyWidgetCommandExecutor,
  MdyWidgetRuntimeCapabilities,
} from "./runtime.js";

export {
  createMdyAnnouncer,
  processWidgetCommands,
} from "./command-runtime.js";
export type {
  MdyAnnouncer,
  MdyElementLookup,
  MdyWidgetCommandContext,
  MdyWidgetCommandHandlers,
} from "./command-runtime.js";

export * from "./select/index.js";
export * from "./field/index.js";

export { MDY_CHIP_CLASSES, multiselectChipClasses, type MdyChipAppearance, type MdyChipMode, type MdyChipPart, type MdyChipRole } from "./chip.js";
export { MDY_STATE_MODIFIERS, stateClass, type MdyPartState, type MdyStateName } from "./state.js";
export { MDY_CSS_PROPERTIES, MDY_CSS_PROPERTY_NAMES, type MdyOverlayProperty } from "./css.js";
export { partClasses, partStates, widgetStateClasses } from "./part-classes.js";
export { MDY_LAYOUT_BREAKPOINTS, MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTIES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY, MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES, MDY_LAYOUT_COLUMN_START_PROPERTIES, layoutNodeAttributes, layoutSlotStyle, type MdyLayoutBreakpoint, type MdyLayoutColumnCounts, type MdyLayoutPart, type MdyLayoutSlotPlacement } from "./layout.js";
export { anchorOverlay, overlayAnchoringFor, overlayStyleProperties, popupPlacementClass, MDY_OVERLAY_GAP, type MdyAnchorRect, type MdyOverlayAlignment, type MdyOverlayAnchorOptions, type MdyOverlayAnchoring, type MdyOverlayCoords, type MdyOverlayPlacement, type MdyOverlayPlacementResult, type MdyViewportSize } from "./overlay.js";
export { setOverlayOpen } from "./overlay-dom.js";
export { MDY_CANONICAL_UI_CLASSES, MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "./catalog.js";
export type { MdyPopupWidgetKind, MdyWidgetDefinition, MdyWidgetKind, MdyWidgetPart } from "./catalog.js";

export { createCatalogWidgetController } from "./catalog-controller.js";
export type { MdyCatalogWidgetIntent, MdyCatalogWidgetState } from "./catalog-controller.js";

export { colorValueEquals, colorValueTransition, dateDraftTransition, dateRangeDraftTransition, dateRangeValueTransition, dateValueTransition, dateWithinBounds, decideOverlayAlignment, decideOverlayPlacement, MDY_OVERLAY_VIEWPORT_MARGIN, fileSelectionTransition, clearFileSelection, listboxNavigationIndex, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, overlayLifecycleTransition, selectKeyboardAction, shouldCloseMultiselectOverlay, stabilizeOverlayPlacement, timeClockTransition, timeDraftTransition, timeInputTransition, widgetKeyIntent } from "./behavior.js";
export type { MdyColorValueIntent, MdyColorValueTransition, MdyDateDraftIntent, MdyDateDraftState, MdyDateDraftTransition, MdyDateRangeDraftIntent, MdyDateRangeDraftState, MdyDateRangeDraftTransition, MdyDateRangeValue, MdyDateValueIntent, MdyFileCandidate, MdyFileSelectionOptions, MdyFileSelectionTransition, MdyMultiselectOverlayAction, MdyMultiselectValueIntent, MdyOptionNavigationTarget, MdyOverlayDecision, MdyOverlayGeometry, MdyOverlayLifecycleIntent, MdyOverlayLifecycleState, MdyOverlayLifecycleTransition, MdySelectKeyboardAction, MdyTimeClockIntent, MdyTimeDraftIntent, MdyTimeDraftState, MdyTimeDraftTransition, MdyWidgetKeyIntent } from "./behavior.js";

export { createValueWidgetController } from "./value-controller.js";
export type { MdyValueWidgetController, MdyValueWidgetControllerOptions, MdyValueWidgetIntent, MdyValueWidgetState } from "./value-controller.js";
