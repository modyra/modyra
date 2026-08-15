/**
 * Executing widget commands with no host to wait for.
 *
 * The execution is `@modyra/widgets`'. What this renderer contributes is the beat: it writes to the
 * document itself, so there is nothing scheduled between a command and its effect and focus can be
 * taken immediately. Every other adapter has to wait for its host to render first.
 */
import {
  createCommandRuntime,
  createMdyAnnouncer,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

const runtime = createCommandRuntime({
  announcerId: "mdy-plain-announcer",
  defer: (run) => { run(); },
});

/** This renderer's live region, so anything that has to be said reaches the same place. */
export function announcePlain(message: string): void {
  createMdyAnnouncer("mdy-plain-announcer").announce(message);
}

export function runCommands(
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  runtime.execute(commands, lookup, handlers);
}
