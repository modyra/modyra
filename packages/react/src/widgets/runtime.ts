/**
 * React runtime for Modyra widget commands.
 */

import {
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { MdyUiCommand } from "@modyra/widgets";
import {
  createMdyAnnouncer,
  processWidgetCommands,
  type MdyElementLookup,
  type MdyWidgetCommandContext,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdyReactCommandHandlers };

/**
 * Schedules command execution after the next layout effect / paint.
 *
 * Returns a queue function; call it from event handlers to push commands
 * that will be flushed inside a layout effect.
 */
export function useMdyCommandQueue(
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): {
  execute(commands: readonly MdyUiCommand[]): void;
} {
  const queueRef = useRef<readonly MdyUiCommand[]>([]);
  const focusQueueRef = useRef<ReadonlyArray<{ el: HTMLElement; type: "focus" | "scroll" }>>([]);
  const announcerRef = useRef(createMdyAnnouncer("mdy-react-announcer"));
  const contextRef = useRef<MdyWidgetCommandContext>(null as unknown as MdyWidgetCommandContext);

  // Keep context fresh without recreating the stable execute callback.
  contextRef.current = {
    lookup,
    handlers,
    scheduleFocus: (el) => {
      focusQueueRef.current = [...focusQueueRef.current, { el, type: "focus" }];
    },
    scheduleScroll: (el) => {
      focusQueueRef.current = [...focusQueueRef.current, { el, type: "scroll" }];
    },
    announce: (message) => announcerRef.current.announce(message),
  };

  const flush = useCallback((): void => {
    const commands = queueRef.current;
    if (commands.length === 0) return;
    queueRef.current = [];

    processWidgetCommands(commands, contextRef.current);

    const items = focusQueueRef.current;
    if (items.length === 0) return;
    focusQueueRef.current = [];

    requestAnimationFrame(() => {
      for (const item of items) {
        if (item.type === "focus") item.el.focus();
        else item.el.scrollIntoView({ block: "nearest" });
      }
    });
  }, []);

  return useMemo(
    () => ({
      execute(commands) {
        queueRef.current = [...queueRef.current, ...commands];
        queueMicrotask(flush);
      },
    }),
    [flush],
  );
}
