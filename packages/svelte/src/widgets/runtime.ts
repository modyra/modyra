/**
 * Executing widget commands, in this host's terms.
 *
 * The execution is `@modyra/widgets`' — collecting focus and scroll, running the rest now, draining
 * the queue once the host has rendered. What belongs to this adapter is the last part: **when** it
 * has rendered.
 */
import {
  createCommandRuntime,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdySvelteCommandHandlers };

/** Svelte's own flush lands before the microtask queue drains. */
const runtime = createCommandRuntime({
  defer: (run) => { queueMicrotask(run); },
});

export function executeSvelteCommands(
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  runtime.execute(commands, lookup, handlers);
}
