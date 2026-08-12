/**
 * @modyra/widgets — headless widget controllers and universal
 * interaction/accessibility contract.
 */

export type {
  MdyPartContract,
  MdyPartMap,
  MdyWidgetController,
  MdyWidgetViewContract,
  MdyTypedWidgetViewContract,
} from "./contract.js";

export {
  MDY_FIELD_SHELL_CLASSES,
  MDY_FIELD_STATE_CLASSES,
  MDY_WIDGET_CONTRACT_VERSION,
} from "./structure.js";
export type {
  MdyFieldShellPart,
  MdyWidgetSemanticElement,
  MdyWidgetStructure,
  MdyWidgetStructureNode,
} from "./structure.js";

export { dynamicParts, isFullyServerRenderable, staticParts } from "./ssr.js";
export {
  MDY_SEMANTICS_REQUIRING_NAME,
  MDY_WIDGET_RELATIONS,
  partsRequiringName,
} from "./relations.js";
export type {
  MdyAccessibleNameSource,
  MdyRelationAttribute,
  MdyWidgetRelation,
} from "./relations.js";

export {
  MDY_DISABLED_BLOCKS_TRANSITIONS,
  MDY_WIDGET_KEYBOARD,
  MDY_WIDGET_TRANSITIONS,
  keyBindingFor,
  transitionsFrom,
} from "./transitions.js";
export type {
  MdyKeyBinding,
  MdyOverlayPhase,
  MdyTransitionTrigger,
  MdyWidgetTransition,
} from "./transitions.js";

export type {
  MdyElementTarget,
  MdyUiCommand,
} from "./commands.js";

export {
  MDY_STATE_EXPRESSION,
  overlayOnlyParts,
  stateCarriers,
} from "./widget-states.js";
export type { MdyWidgetState, MdyWidgetStateContract } from "./widget-states.js";

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
  createCommandRuntime,
  createMdyAnnouncer,
  processWidgetCommands,
} from "./command-runtime.js";
export type {
  MdyAnnouncer,
  MdyCommandDefer,
  MdyCommandRuntime,
  MdyCommandRuntimeOptions,
  MdyElementLookup,
  MdyWidgetCommandContext,
  MdyWidgetCommandHandlers,
} from "./command-runtime.js";

export * from "./select/index.js";
export { narrowConstraints, nativeConstraintAttributes } from "./native-constraints.js";
export type { MdyNativeAttributes } from "./native-constraints.js";
export * from "./field/index.js";

export { MDY_CHIP_CLASSES, multiselectChipClasses, type MdyChipAppearance, type MdyChipMode, type MdyChipPart, type MdyChipRole } from "./chip.js";
export { stateClass, type MdyPartState, type MdyStateName } from "./state.js";
export { MDY_CSS_PROPERTIES, type MdyOverlayProperty } from "./css.js";
export { partClasses, partStates, widgetStateClasses } from "./part-classes.js";
export { MDY_LAYOUT_BREAKPOINTS, MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTIES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY, MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES, MDY_LAYOUT_COLUMN_START_PROPERTIES, layoutNodeAttributes, layoutSlotStyle, type MdyLayoutBreakpoint, type MdyLayoutColumnCounts, type MdyLayoutPart, type MdyLayoutSlotPlacement } from "./layout.js";
export { anchorOverlay, overlayAnchoringFor, overlayStyleProperties, popupAlignmentClass, popupPlacementClass, MDY_OVERLAY_GAP, type MdyAnchorRect, type MdyOverlayAlignment, type MdyOverlayAnchorOptions, type MdyOverlayAnchoring, type MdyOverlayCoords, type MdyOverlayPlacement, type MdyOverlayPlacementResult, type MdyViewportSize } from "./overlay.js";
export { setOverlayOpen, trackAnchoredOverlay } from "./overlay-dom.js";
export { MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS, MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "./catalog.js";
export type { MdyPopupWidgetKind, MdyWidgetDefinition, MdyWidgetKind, MdyWidgetPart, MdyWidgetVariant } from "./catalog.js";

export { createCatalogWidgetController } from "./catalog-controller.js";
export type { MdyCatalogWidgetIntent, MdyCatalogWidgetState } from "./catalog-controller.js";

export { acceptTimeField, stepTimeField, timeFieldBounds } from "./time-bounds.js";
export type { MdyTimeEntry, MdyTimeField, MdyTimeFieldBounds, MdyTimeRejection } from "./time-bounds.js";
export { createFocusCustodian } from "./focus.js";
export { createPointerDrag, dragPointOf } from "./pointer-drag.js";
export type { MdyDragPoint, MdyPointerDrag, MdyPointerDragOptions } from "./pointer-drag.js";
export { portalRootFor } from "./portal.js";
export { createLightDismiss, isPrimaryInteraction } from "./dismissal.js";
export { bindLightDismiss } from "./dismissal-dom.js";
export type { MdyDismissalBindingOptions } from "./dismissal-dom.js";
export { affordanceClasses, kindsWithAffordances, trailingAffordances } from "./affordance.js";
export type { MdyAffordance, MdyAffordanceRole } from "./affordance.js";
export { createTypeahead, isTypeaheadCharacter, typeaheadMatch, MDY_TYPEAHEAD_IDLE_MS } from "./typeahead.js";
export type { MdyTypeahead, MdyTypeaheadOptions } from "./typeahead.js";
export type { MdyDismissalPhase, MdyLightDismiss, MdyLightDismissOptions, MdyOutsideDismiss, MdyPointerOrigin } from "./dismissal.js";
export type { MdyFocusCustodian } from "./focus.js";
export { colorValueEquals, colorValueTransition, dateDraftTransition, dateRangeDraftTransition, dateRangeValueTransition, dateValueTransition, dateWithinBounds, decideOverlayAlignment, decideOverlayPlacement, MDY_OVERLAY_VIEWPORT_MARGIN, fileSelectionTransition, clearFileSelection, listboxNavigationIndex, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, overlayLifecycleTransition, selectKeyboardAction, shouldCloseMultiselectOverlay, stabilizeOverlayPlacement, timeClockTransition, timeDraftTransition, timeInputTransition, widgetKeyIntent } from "./behavior.js";
export type { MdyColorValueIntent, MdyColorValueTransition, MdyDateDraftIntent, MdyDateDraftState, MdyDateDraftTransition, MdyDateRangeDraftIntent, MdyDateRangeDraftState, MdyDateRangeDraftTransition, MdyDateRangeValue, MdyDateValueIntent, MdyFileCandidate, MdyFileSelectionOptions, MdyFileSelectionTransition, MdyMultiselectOverlayAction, MdyMultiselectValueIntent, MdyOptionNavigationTarget, MdyOverlayDecision, MdyOverlayGeometry, MdyOverlayLifecycleIntent, MdyOverlayLifecycleState, MdyOverlayLifecycleTransition, MdySelectKeyboardAction, MdyTimeClockIntent, MdyTimeDraftIntent, MdyTimeDraftState, MdyTimeDraftTransition, MdyWidgetKeyIntent } from "./behavior.js";

export { createValueWidgetController } from "./value-controller.js";
export type { MdyValueWidgetController, MdyValueWidgetControllerOptions, MdyValueWidgetIntent, MdyValueWidgetState } from "./value-controller.js";

export { fieldCommandHandlers, subscribeController } from "./controller-binding.js";
export type { MdyCommandTarget, MdyControllerNotify } from "./controller-binding.js";

export { blocksFocus, blocksValueChange } from "./interactivity.js";
export { applyPart } from "./apply-part.js";
export { overlayControlledId, projectOverlayOpenerA11y } from "./opener-a11y.js";
export type { MdyOverlayOpenerA11yOptions } from "./opener-a11y.js";
