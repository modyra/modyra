/**
 * Lit runtime for Modyra widget commands.
 *
 * Executes UI commands produced by headless widget controllers inside a
 * LitElement host. Focus/scroll operations are deferred until
 * `updateComplete` so the DOM is guaranteed to be up to date.
 */

import type { MdyUiCommand } from "@modyra/widgets";
import {
  createMdyAnnouncer,
  processWidgetCommands,
  type MdyElementLookup,
} from "@modyra/widgets";
import type { LitElement } from "lit";

/** Host callbacks for command side effects. */
export interface MdyLitCommandHandlers {
  /** Called for open-overlay / close-overlay. */
  setOpen(open: boolean): void;
  /** Called for emit-change. */
  onChange?(): void;
  /** Called for mark-touched. */
  onTouched?(): void;
  /** Called for mark-dirty. */
  onDirty?(): void;
}

/**
 * Executes a list of UI commands in a Lit runtime context.
 *
 * Commands are run synchronously where possible; focus/scroll are queued
 * behind `host.updateComplete`.
 */
export function executeLitCommands(
  host: LitElement,
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyLitCommandHandlers,
): void {
  const focusQueue: Array<{ el: HTMLElement; type: "focus" | "scroll" }> = [];
  const announcer = createMdyAnnouncer("mdy-lit-announcer");

  processWidgetCommands(commands, {
    lookup,
    handlers,
    scheduleFocus: (el) => focusQueue.push({ el, type: "focus" }),
    scheduleScroll: (el) => focusQueue.push({ el, type: "scroll" }),
    announce: (message) => announcer.announce(message),
  });

  if (focusQueue.length > 0) {
    host.updateComplete.then(() => {
      for (const item of focusQueue) {
        if (item.type === "focus") item.el.focus();
        else item.el.scrollIntoView({ block: "nearest" });
      }
    });
  }
}

/** Visually hidden live region for screen reader announcements. */
export function announceLit(message: string): void {
  createMdyAnnouncer("mdy-lit-announcer").announce(message);
}

export type { MdyElementLookup } from "@modyra/widgets";
