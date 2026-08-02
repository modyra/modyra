/**
 * Runtime capabilities contract.
 *
 * Adapters report what the current runtime can do, and pass the report to
 * {@link processWidgetCommands}, which drops the commands that need a DOM when there is none —
 * focus, scrolling, announcing — and runs the rest.
 *
 * The header used to say a *controller* consulted the report to avoid emitting such commands. No
 * controller took one, both report functions had no consumer at all, and `processWidgetCommands`
 * relied on its element lookup returning nothing. The claim described behaviour that existed
 * nowhere, which is worse than no claim: it reads as a guarantee. The execution point is the honest
 * place for it — a controller decides what should happen, and whether it *can* happen is a property
 * of the runtime doing it.
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

/**
 * Runtime capabilities of the environment this is called in.
 *
 * Every capability is probed, `dom` included. A report that asserts a DOM rather than looking for
 * one is worse than no report at all: the controller consults it precisely to decide whether a
 * command can be executed, so on a server it would be told to focus something that does not exist.
 * With no DOM the answer is {@link ssrRuntimeCapabilities} exactly.
 *
 * `hydrated` is the one dimension no global can answer — a browser that has parsed server markup
 * but not yet attached to it is indistinguishable from one that has. It follows `dom` by default,
 * which is right once the client owns the page, and a renderer that knows it is still hydrating
 * says so.
 */
export function browserRuntimeCapabilities(
  options: { readonly hydrated?: boolean } = {},
): MdyWidgetRuntimeCapabilities {
  const g = globalThis as typeof globalThis & {
    document?: unknown;
    HTMLElement?: { prototype: Record<string, unknown> };
    ResizeObserver?: unknown;
    PointerEvent?: unknown;
  };
  const dom = typeof g.document !== "undefined" && typeof g.HTMLElement !== "undefined";
  if (!dom) return ssrRuntimeCapabilities;
  return {
    dom: true,
    hydrated: options.hydrated ?? true,
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
