/**
 * Solid runtime for Modyra widget commands.
 */

import type { MdyUiCommand } from "@modyra/widgets";
import {
  createMdyAnnouncer,
  processWidgetCommands,
  type MdyElementLookup,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdySolidCommandHandlers };

/**
 * Executes commands in a Solid runtime context.
 *
 * Focus/scroll are deferred so they run after the next DOM update flush
 * (callers should await a microtask before invoking this if they need a
 * guaranteed fresh DOM).
 */
export function executeSolidCommands(
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  const focusQueue: Array<{ el: HTMLElement; type: "focus" | "scroll" }> = [];
  const announcer = createMdyAnnouncer("mdy-solid-announcer");

  processWidgetCommands(commands, {
    lookup,
    handlers,
    scheduleFocus: (el) => focusQueue.push({ el, type: "focus" }),
    scheduleScroll: (el) => focusQueue.push({ el, type: "scroll" }),
    announce: (message) => announcer.announce(message),
  });

  if (focusQueue.length > 0) {
    queueMicrotask(() => {
      for (const item of focusQueue) {
        if (item.type === "focus") item.el.focus();
        else item.el.scrollIntoView({ block: "nearest" });
      }
    });
  }
}
