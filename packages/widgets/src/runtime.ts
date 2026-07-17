/**
 * Runtime capabilities contract.
 *
 * Adapters report what the current runtime can do. The controller uses this
 * information to avoid emitting commands that cannot be executed (e.g. focus
 * commands during SSR or in a non-DOM environment).
 */

import type { MdyUiCommand } from "./commands.js";

export interface MdyWidgetRuntimeCapabilities {
  /** True when a real DOM is available. */
  readonly dom: boolean;
  /** True when the application has been hydrated. */
  readonly hydrated: boolean;
  /** True when native popover API can be used. */
  readonly popover: boolean;
  /** True when ResizeObserver is available. */
  readonly resizeObserver: boolean;
  /** True when pointer events are available. */
  readonly pointerEvents: boolean;
}

/** Runtime capabilities during SSR or non-DOM environments. */
export const ssrRuntimeCapabilities: MdyWidgetRuntimeCapabilities = {
  dom: false,
  hydrated: false,
  popover: false,
  resizeObserver: false,
  pointerEvents: false,
};

/** Runtime capabilities in a modern browser. */
export function browserRuntimeCapabilities(): MdyWidgetRuntimeCapabilities {
  const g = globalThis as typeof globalThis & {
    HTMLElement?: { prototype: Record<string, unknown> };
    ResizeObserver?: unknown;
    PointerEvent?: unknown;
  };
  return {
    dom: true,
    hydrated: true,
    popover:
      typeof g.HTMLElement !== "undefined" &&
      "popover" in g.HTMLElement.prototype,
    resizeObserver: typeof g.ResizeObserver !== "undefined",
    pointerEvents: typeof g.PointerEvent !== "undefined",
  };
}

/** Executor of UI commands produced by a controller. */
export interface MdyWidgetCommandExecutor {
  execute(commands: readonly MdyUiCommand[]): void | Promise<void>;
  destroy(): void;
}
