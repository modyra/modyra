/**
 * Thin adapter over @modyra/widgets' own framework-agnostic command runtime
 * — reused as-is rather than hand-rolled, since it already does exactly
 * what a vanilla-DOM host needs (focus/scroll scheduling, a shared
 * screen-reader announcer, open/close callbacks).
 */
import {
  createMdyAnnouncer,
  processWidgetCommands,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

const announcer = createMdyAnnouncer("mdy-plain-announcer");

export function runCommands(
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  processWidgetCommands(commands, {
    lookup,
    handlers,
    scheduleFocus: (el) => el.focus(),
    // Real browsers always have scrollIntoView; some minimal DOM
    // implementations (e.g. jsdom, used by this package's own tests) don't
    // implement it at all — guard rather than let a missing scroll affordance
    // crash the whole interaction.
    scheduleScroll: (el) => el.scrollIntoView?.({ block: "nearest" }),
    announce: (message) => announcer.announce(message),
  });
}
