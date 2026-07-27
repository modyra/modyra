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

export { MDY_CANONICAL_UI_CLASSES, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "./catalog.js";
export type { MdyWidgetDefinition, MdyWidgetKind, MdyWidgetPart } from "./catalog.js";

export { createCatalogWidgetController } from "./catalog-controller.js";
export type { MdyCatalogWidgetIntent, MdyCatalogWidgetState } from "./catalog-controller.js";

export { dateValueTransition, dateWithinBounds, decideOverlayPlacement, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, selectKeyboardAction, shouldCloseMultiselectOverlay, widgetKeyIntent } from "./behavior.js";
export type { MdyDateValueIntent, MdyMultiselectOverlayAction, MdyMultiselectValueIntent, MdyOptionNavigationTarget, MdyOverlayDecision, MdyOverlayGeometry, MdySelectKeyboardAction, MdyWidgetKeyIntent } from "./behavior.js";

export { createValueWidgetController } from "./value-controller.js";
export type { MdyValueWidgetController, MdyValueWidgetControllerOptions, MdyValueWidgetIntent, MdyValueWidgetState } from "./value-controller.js";
