/**
 * Framework-agnostic widget command execution.
 *
 * Adapters supply an element lookup, host callbacks, a focus/scroll scheduler
 * and an announcer; this module turns the headless controller's
 * {@link MdyUiCommand}s into real DOM/overlay side effects.
 */

import type { MdyUiCommand } from "./commands.js";

/** Looks up a widget part element, optionally by item key. */
export type MdyElementLookup = (
  part: string,
  key?: string,
) => HTMLElement | undefined;

/** Host callbacks for command side effects that need framework cooperation. */
export interface MdyWidgetCommandHandlers {
  /** Called for open-overlay / close-overlay. */
  setOpen(open: boolean): void;
  /** Called for emit-change. */
  onChange?(): void;
  /** Called for mark-touched. */
  onTouched?(): void;
  /** Called for mark-dirty. */
  onDirty?(): void;
}

/** Context supplied by each adapter when processing commands. */
export interface MdyWidgetCommandContext {
  readonly lookup: MdyElementLookup;
  readonly handlers: MdyWidgetCommandHandlers;
  scheduleFocus(el: HTMLElement): void;
  scheduleScroll(el: HTMLElement): void;
  announce(message: string): void;
}

/**
 * Walks a list of UI commands and invokes framework-specific side effects
 * through the provided context. Focus/scroll operations are only scheduled;
 * the adapter flushes them with its own DOM timing.
 */
export function processWidgetCommands(
  commands: readonly MdyUiCommand[],
  context: MdyWidgetCommandContext,
): void {
  for (const command of commands) {
    switch (command.type) {
      case "focus":
      case "restore-focus": {
        const el = context.lookup(command.target.part, command.target.key);
        if (el) context.scheduleFocus(el);
        break;
      }
      case "scroll-into-view": {
        const el = context.lookup(command.target.part, command.target.key);
        if (el) context.scheduleScroll(el);
        break;
      }
      case "announce": {
        context.announce(command.message);
        break;
      }
      case "open-overlay": {
        context.handlers.setOpen(true);
        break;
      }
      case "close-overlay": {
        context.handlers.setOpen(false);
        break;
      }
      case "emit-change": {
        context.handlers.onChange?.();
        break;
      }
      case "mark-touched": {
        context.handlers.onTouched?.();
        break;
      }
      case "mark-dirty": {
        context.handlers.onDirty?.();
        break;
      }
    }
  }
}

/** Visually hidden live region used by all adapters for screen-reader announcements. */
export interface MdyAnnouncer {
  announce(message: string): void;
}

/**
 * Creates a lazy-initialized live region with the given element id.
 * Multiple callers with the same id share the same DOM element.
 */
export function createMdyAnnouncer(elementId: string): MdyAnnouncer {
  return {
    announce(message: string): void {
      if (typeof document === "undefined") return;
      let el = document.getElementById(elementId);
      if (!el) {
        el = document.createElement("div");
        el.id = elementId;
        el.setAttribute(
          "style",
          "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;",
        );
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-atomic", "true");
        document.body.appendChild(el);
      }
      el.textContent = "";
      setTimeout(() => {
        if (el) el.textContent = message;
      }, 100);
    },
  };
}
