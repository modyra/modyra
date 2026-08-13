/**
 * Lit runtime for Modyra widget commands.
 *
 * Executes UI commands produced by headless widget controllers inside a
 * LitElement host. Focus/scroll operations are deferred until
 * `updateComplete` so the DOM is guaranteed to be up to date.
 */

import type { MdyUiCommand } from "@modyra/widgets";
import {
  createCommandRuntime,
  createMdyAnnouncer,
  type MdyElementLookup,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";
import type { LitElement } from "lit";

/**
 * Host callbacks for command side effects.
 *
 * An alias, not a restatement: written out member by member it drifts the moment the contract gains
 * one, and the five reactivity adapters have always aliased it.
 */
export type MdyLitCommandHandlers = MdyWidgetCommandHandlers;

/**
 * This host publishes its own promise for "I have finished rendering", so that is what focus waits
 * on. A microtask would fire before the update lands and focus would go to a node about to be
 * replaced; the runtime is built per host because the promise is the host's.
 */
export function executeLitCommands(
  host: LitElement,
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  createCommandRuntime({
    announcerId: "mdy-lit-announcer",
    defer: (run) => { void host.updateComplete.then(run); },
  }).execute(commands, lookup, handlers);
}

/** Visually hidden live region for screen reader announcements. */
export function announceLit(message: string): void {
  createMdyAnnouncer("mdy-lit-announcer").announce(message);
}

export type { MdyElementLookup } from "@modyra/widgets";
