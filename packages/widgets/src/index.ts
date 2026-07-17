/**
 * @modyra/widgets — headless widget controllers and universal
 * interaction/accessibility contract.
 */

export type {
  MdyPartContract,
  MdyWidgetController,
  MdyWidgetViewContract,
} from "./contract.js";

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
