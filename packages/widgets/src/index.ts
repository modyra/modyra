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

export { anchorOverlay, type MdyAnchorRect, type MdyOverlayAnchorOptions, type MdyOverlayAnchoring, type MdyViewportSize } from "./overlay.js";
export { MDY_CANONICAL_UI_CLASSES, MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "./catalog.js";
export type { MdyWidgetDefinition, MdyWidgetKind, MdyWidgetPart } from "./catalog.js";

export { createCatalogWidgetController } from "./catalog-controller.js";
export type { MdyCatalogWidgetIntent, MdyCatalogWidgetState } from "./catalog-controller.js";

export { colorValueEquals, colorValueTransition, dateDraftTransition, dateRangeDraftTransition, dateRangeValueTransition, dateValueTransition, dateWithinBounds, decideOverlayPlacement, fileSelectionTransition, clearFileSelection, listboxNavigationIndex, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, overlayLifecycleTransition, selectKeyboardAction, shouldCloseMultiselectOverlay, stabilizeOverlayPlacement, timeClockTransition, timeDraftTransition, timeInputTransition, widgetKeyIntent } from "./behavior.js";
export type { MdyColorValueIntent, MdyColorValueTransition, MdyDateDraftIntent, MdyDateDraftState, MdyDateDraftTransition, MdyDateRangeDraftIntent, MdyDateRangeDraftState, MdyDateRangeDraftTransition, MdyDateRangeValue, MdyDateValueIntent, MdyFileCandidate, MdyFileSelectionOptions, MdyFileSelectionTransition, MdyMultiselectOverlayAction, MdyMultiselectValueIntent, MdyOptionNavigationTarget, MdyOverlayDecision, MdyOverlayGeometry, MdyOverlayLifecycleIntent, MdyOverlayLifecycleState, MdyOverlayLifecycleTransition, MdySelectKeyboardAction, MdyTimeClockIntent, MdyTimeDraftIntent, MdyTimeDraftState, MdyTimeDraftTransition, MdyWidgetKeyIntent } from "./behavior.js";

export { createValueWidgetController } from "./value-controller.js";
export type { MdyValueWidgetController, MdyValueWidgetControllerOptions, MdyValueWidgetIntent, MdyValueWidgetState } from "./value-controller.js";
