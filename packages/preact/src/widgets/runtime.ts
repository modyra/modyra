/**
 * Executing widget commands, in this host's terms.
 *
 * The execution is `@modyra/widgets`' — collecting focus and scroll, running the rest now, draining
 * the queue once the host has rendered. What belongs to this adapter is the last part: **when** it
 * has rendered.
 */
import { useCallback, useMemo, useRef } from "preact/hooks";
import {
  createCommandRuntime,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdyPreactCommandHandlers };

/** Same reasoning as the framework this adapter mirrors: the commit finishes before the frame. */
const runtime = createCommandRuntime({
  announcerId: "mdy-preact-announcer",
  defer: (run) => { requestAnimationFrame(run); },
});

export function executePreactCommands(
  commands: readonly MdyUiCommand[],
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): void {
  runtime.execute(commands, lookup, handlers);
}

/**
 * The same execution, queued across a render rather than run inside one.
 *
 * A component dispatches an intent while rendering; running the commands there would touch the DOM
 * the host is in the middle of producing. So they accumulate and drain on a microtask, and the
 * execution itself is the shared one — this hook owns *when*, not *what*.
 */
export function useMdyCommandQueue(
  lookup: MdyElementLookup,
  handlers: MdyWidgetCommandHandlers,
): {
  execute(commands: readonly MdyUiCommand[]): void;
} {
  const queueRef = useRef<readonly MdyUiCommand[]>([]);
  // Kept fresh without recreating the stable callback below.
  const liveRef = useRef({ lookup, handlers });
  liveRef.current = { lookup, handlers };

  const flush = useCallback((): void => {
    const commands = queueRef.current;
    if (commands.length === 0) return;
    queueRef.current = [];
    runtime.execute(commands, liveRef.current.lookup, liveRef.current.handlers);
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
