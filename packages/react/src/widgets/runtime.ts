/**
 * Executing widget commands, in this host's terms.
 *
 * The execution is `@modyra/widgets`' — collecting focus and scroll, running the rest now, draining
 * the queue once the host has rendered. What belongs to this adapter is the last part: **when** it
 * has rendered.
 */
import { useCallback, useMemo, useRef } from "react";
import {
  createCommandRuntime,
  sameControllerOptions,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdyReactCommandHandlers };

/** React commits before the next frame, and focusing inside the commit moves focus to a node React is about to replace. */
const runtime = createCommandRuntime({
  announcerId: "mdy-react-announcer",
  defer: (run) => { requestAnimationFrame(run); },
});

export function executeReactCommands(
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

/**
 * The configuration a controller was built from, kept while it still says the same thing.
 *
 * Every widget hook memoizes its controller on the configuration object, and a configuration written
 * at the call is a new object on every render: a new controller, a new subscription, a state write,
 * another render. Comparing what the configuration *says* rather than which object it is makes a
 * literal at the call site work, which is what an argument that is an object literal invites.
 *
 * A handler written at the call is a new function every render too, and it cannot be compared by
 * identity without defeating the whole thing. It is replaced by one stable function per member that
 * calls whatever the latest render passed — so the controller keeps the handler it was built with,
 * and that handler is never stale.
 */
export function useMdyStableOptions<T>(options: T): T {
  const latest = useRef(options);
  latest.current = options;
  const compared = useRef<unknown>(null);
  const built = useRef<T | null>(null);
  if (built.current === null || !sameControllerOptions(compared.current, withoutFunctions(options))) {
    compared.current = withoutFunctions(options);
    built.current = withStableFunctions(options, latest);
  }
  return built.current;
}

/** The configuration's members that can be compared at all — a function never compares equal. */
function withoutFunctions(options: unknown): unknown {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return options;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (typeof value !== "function") out[key] = value;
  }
  return out;
}

/** The same configuration with one stable function per handler, each calling the latest one given. */
function withStableFunctions<T>(options: T, latest: { current: T }): T {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return options;
  const out: Record<string, unknown> = { ...(options as Record<string, unknown>) };
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (typeof value !== "function") continue;
    out[key] = (...args: readonly unknown[]): unknown => {
      const now = (latest.current as Record<string, unknown>)[key];
      return typeof now === "function" ? (now as (...given: readonly unknown[]) => unknown)(...args) : undefined;
    };
  }
  return out as T;
}
