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
  MDY_FORM_SHELL_CLASSES,
  MDY_FORM_SHELL_STRUCTURE,
  MDY_PART_PRESENCE,
  MDY_PART_PRESENCES,
  MDY_PART_NAMES,
  MDY_PRESENCE_RESOLUTION,
  shellStateClasses,
  MDY_WIDGET_CONTRACT_VERSION,
} from "./structure.js";
export type {
  MdyFieldShellPart,
  MdyFormShellPart,
  MdyWidgetSemanticElement,
  MdyWidgetStructure,
  MdyPartPresence,
  MdyWidgetStructureNode,
} from "./structure.js";

export {
  comparableControllerOptions,
  sameControllerOptions,
  stableControllerOptions,
} from "./controller-options.js";
export { dynamicParts, isFullyServerRenderable, staticParts } from "./ssr.js";
export {
  MDY_SEMANTICS_REQUIRING_NAME,
  MDY_WIDGET_RELATIONS,
  partsRequiringName,
  openPlatformChooser,
} from "./relations.js";
export type {
  MdyAccessibleNameSource,
  MdyRelationAttribute,
  MdyWidgetRelation,
} from "./relations.js";

export {
  MDY_ANY_PRINTABLE_KEY,
  MDY_DISABLED_BLOCKS_TRANSITIONS,
  MDY_WIDGET_KEYBOARD,
  MDY_WIDGET_TRANSITIONS,
  keyBindingFor, matchesKeyGesture, type MdyKeyOrPress,
  transitionsFrom,
  widgetKeyGuide,
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
  calendarDayId,
  reportIdCollision,
  defaultWidgetIdFactory, idSafeKey,
  assertUsableWidgetId,
  formScopeOf,
  widgetScopeOf,
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
  MDY_SHARED_REGION_ATTRIBUTE,
  MDY_SHARED_REGION_ID,
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
export { narrowConstraints, nativeConstraintAttributes, sliderTrack } from "./native-constraints.js";
export type { MdyNativeAttributes } from "./native-constraints.js";
export * from "./field/index.js";

export { beginChipReorder, chipDropIndex, chosenKeyOrder, elementByDataKey, MDY_CHIP_DRAG_THRESHOLD, chipFocusAfterRemoval, chipActionName, quantityAnnouncement, settledVoice, chipStripWheelDelta, chipTooltipOffset, hiddenChipCount, keepFocusedChipInView, scrollChipStripByWheel, chipMovedAnnouncement, wayBackSentence, wayBackActionName, MDY_CHIP_CLASSES, multiselectAnnouncement, multiselectChipClasses, type MdyChipAppearance, type MdyChipMode, type MdyChipPart, type MdyChipRole } from "./chip.js";
export { stateClass, type MdyPartState, type MdyStateName } from "./state.js";
export { MDY_CSS_PROPERTIES, type MdyOverlayProperty } from "./css.js";
export { partClasses, partSelector, partStates, widgetStateClasses } from "./part-classes.js";
export { MDY_LAYOUT_BREAKPOINTS, MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTIES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY, MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES, MDY_LAYOUT_COLUMN_START_PROPERTIES, layoutNodeAttributes, layoutSlotStyle, type MdyLayoutBreakpoint, type MdyLayoutColumnCounts, type MdyLayoutPart, type MdyLayoutSlotPlacement } from "./layout.js";
export { anchorOverlay, overlayAnchoringFor, overlayStyleProperties, popupAlignmentClass, popupPlacementClass, MDY_OVERLAY_GAP, type MdyAnchorRect, type MdyOverlayAlignment, type MdyOverlayAnchorOptions, type MdyOverlayAnchoring, type MdyOverlayCoords, type MdyOverlayPlacement, type MdyOverlayPlacementResult, type MdyViewportSize } from "./overlay.js";
export { applyOverlayProperties, inlineDirectionOf, MDY_BACKDROP_ATTRIBUTE, measureOverlayContent, setOverlayOpen, stepOutOfOverlay, syncOverlayBackdrop, trackAnchoredOverlay, viewportSize } from "./overlay-dom.js";
export type { MdyAnchoredOverlayTracking } from "./overlay-dom.js";
export { MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS, MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "./catalog.js";
export type { MdyPopupWidgetKind, MdyWidgetDefinition, MdyWidgetKind, MdyWidgetPart, MdyWidgetVariant } from "./catalog.js";

export { createCatalogWidgetController } from "./catalog-controller.js";
export type { MdyCatalogWidgetIntent, MdyCatalogWidgetState } from "./catalog-controller.js";

export { acceptTimeField, stepTimeField, timeFieldBounds } from "./time-bounds.js";
export type { MdyTimeEntry, MdyTimeField, MdyTimeFieldBounds, MdyTimeRejection } from "./time-bounds.js";
export { createFocusCustodian, focusWhenShown, keepKeyboardInPlay } from "./focus.js";
export { createPointerDrag, dragPointOf } from "./pointer-drag.js";
export type { MdyDragPoint, MdyPointerDrag, MdyPointerDragOptions } from "./pointer-drag.js";
/**
 * The UI vocabulary that used to live in the engine.
 *
 * Icons, the keyboard policy a listbox and a calendar answer to, and the filter a search box runs:
 * all of it is what a widget *is*, and it sat in `@modyra/core` because that is where it was
 * written. This package imported it from there — the UI contract reaching sideways into the engine
 * for its own material, which ADR 0006 says cannot happen and which was happening in five files.
 */
export { MDY_ICONS, MDY_ICON_GRID, MDY_ICON_SPANS, MDY_ICON_STROKE } from "./icons.js";
/**
 * The words a widget shows, and the locales they are written in.
 *
 * They are the UI contract's for the same reason the icons are: a search box's placeholder and a
 * clock's confirm button are what a widget *says*, and the engine has no opinion about either. Left
 * in the engine they had one consumer — two renderers hardcoded English instead, and the same
 * button was "Open the calendar" in one, "Open date picker" in another and "Toggle calendar" in the
 * table neither of them read.
 */
export {
  MDY_I18N_DEFAULT_TAGS,
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  MDY_I18N_PRESETS,
  messagesForLocale,
} from "./i18n.js";
export type { MdyBuiltInLocale, MdyI18nMessages } from "./i18n.js";
export type { MdyIconName } from "./icons.js";
export { calendarKeyboardTarget, listboxNextIndex, rowRovingIndex } from "./keyboard.js";
export { defaultOptionKey, filterOptionsByQuery } from "./options-utils.js";

export { portalRootFor } from "./portal.js";
export { createLightDismiss, isPrimaryInteraction } from "./dismissal.js";
export { overlayBranchContains, type MdyOverlayBranch, type MdyOverlayRoot } from "./overlay-branch.js";
export {
  explainGranularityProblem,
  isOnStep,
  MDY_EVERY_TIME,
  minutesOfDay,
  timeStepsAt,
  validateTimeGranularity,
  type MdyGranularityProblem,
  type MdyTimeGranularity,
  type MdyTimeSteps,
  type MdyTimeWindow,
} from "./time-granularity.js";
export { bindLightDismiss } from "./dismissal-dom.js";
export { bindFormReset } from "./form-reset-dom.js";
export { adoptSilentWrites, type MdySilentWriteBinding } from "./silent-writes-dom.js";
export { submissionFor, submissionNames, submissionDefects, submitFalsePart, groupSubmitName, syncSubmitValues, applySubmissionNames, type MdySubmissionShape } from "./submission.js";
export type { MdyFormResetBinding } from "./form-reset-dom.js";
export type { MdyDismissalBindingOptions } from "./dismissal-dom.js";
export { affordanceClasses, kindsWithAffordances, trailingAffordances } from "./affordance.js";
export type { MdyAffordance, MdyAffordanceRole } from "./affordance.js";
export { createTypeahead, isTypeaheadCharacter, typeaheadMatch, MDY_TYPEAHEAD_IDLE_MS } from "./typeahead.js";
export type { MdyTypeahead, MdyTypeaheadOptions } from "./typeahead.js";
export type { MdyDismissalPhase, MdyLightDismiss, MdyLightDismissOptions, MdyOutsideDismiss, MdyPointerOrigin } from "./dismissal.js";
export type { MdyFocusCustodian } from "./focus.js";
export { MDY_COLOR_PRESETS, colorPresetsOf, colorValueEquals, colorValueTransition, dateDraftTransition, dateRangeDraftTransition, dateRangeValueTransition, dateValueTransition, dateWithinBounds, decideOverlayAlignment, decideOverlayPlacement, MDY_OVERLAY_VIEWPORT_MARGIN, fileSelectionTransition, clearFileSelection, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, overlayLifecycleTransition, selectKeyboardAction, shouldCloseMultiselectOverlay, stabilizeOverlayPlacement, timeClockTransition, timeDraftTransition, timeInputTransition, widgetKeyIntent } from "./behavior.js";
export type { MdyColorValueIntent, MdyColorValueTransition, MdyDateDraftIntent, MdyDateDraftState, MdyDateDraftTransition, MdyDateRangeDraftIntent, MdyDateRangeDraftState, MdyDateRangeDraftTransition, MdyDateRangeValue, MdyDateValueIntent, MdyFileCandidate, MdyFileSelectionOptions, MdyFileSelectionTransition, MdyMultiselectOverlayAction, MdyMultiselectValueIntent, MdyOptionNavigationTarget, MdyOverlayDecision, MdyOverlayGeometry, MdyOverlayLifecycleIntent, MdyOverlayLifecycleState, MdyOverlayLifecycleTransition, MdySelectKeyboardAction, MdyTimeClockIntent, MdyTimeDraftIntent, MdyTimeDraftState, MdyTimeDraftTransition, MdyWidgetKeyIntent } from "./behavior.js";

export { createValueWidgetController } from "./value-controller.js";
export type { MdyValueWidgetController, MdyValueWidgetControllerOptions, MdyValueWidgetIntent, MdyValueWidgetState } from "./value-controller.js";

export { fieldCommandHandlers, subscribeController } from "./controller-binding.js";
export type { MdyCommandTarget, MdyControllerNotify } from "./controller-binding.js";

export { blocksFocus, blocksValueChange } from "./interactivity.js";
export { applyPart } from "./apply-part.js";
export { overlayControlledId, projectOverlayOpenerA11y } from "./opener-a11y.js";
export type { MdyOverlayOpenerA11yOptions } from "./opener-a11y.js";

export { MDY_CONTRACT_VOCABULARIES } from "./vocabularies.js";
export type { MdyVocabulary, MdyVocabularyShape } from "./vocabularies.js";

export { bindingForIntent, capabilityOf, isWidgetKind, keyMeans } from "./ask.js";

export { fieldIsRequired, inputWasRefused, undoIsOnOffer, valueIsAbsent, valueIsPresent, viewIsActive, workIsInFlight } from "./presence.js";
