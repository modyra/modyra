/**
 * Executing widget commands, and the beat this renderer waits for.
 *
 * The execution is `@modyra/widgets`'. What this renderer contributes is *when*: it writes to the
 * document itself, so it has no framework render to wait for — but it does have its own. Its parts
 * are synced from a reactive effect that runs after the dispatch returns, and until that effect has
 * run the popup is still `hidden`.
 *
 * Focus was taken immediately on the strength of "there is nothing scheduled between a command and
 * its effect", and that is true of everything except the thing the effect does. Focusing an element
 * inside a hidden popup is a silent no-op — no error, no warning, and a keyboard user left on the
 * body — which is what an opening picker did.
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
  defer: (run) => queueMicrotask(run),
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
