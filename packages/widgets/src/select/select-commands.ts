/**
 * Select command helpers.
 *
 * Convenience builders for the commands a select controller commonly emits.
 */

import type { MdyElementTarget, MdyUiCommand } from "../commands.js";

export function focusTrigger(): MdyUiCommand {
  return { type: "focus", target: { part: "trigger" } };
}

export function restoreFocusTrigger(): MdyUiCommand {
  return { type: "restore-focus", target: { part: "trigger" } };
}

export function scrollOptionIntoView(key: string): MdyUiCommand {
  return { type: "scroll-into-view", target: { part: "option", key } };
}

export function openOverlay(anchor: MdyElementTarget = { part: "trigger" }): MdyUiCommand {
  return { type: "open-overlay", anchor };
}

export function closeOverlay(): MdyUiCommand {
  return { type: "close-overlay" };
}
