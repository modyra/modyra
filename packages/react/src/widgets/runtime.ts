/**
 * Executing widget commands, in this host's terms.
 *
 * The execution is `@modyra/widgets`' — collecting focus and scroll, running the rest now, draining
 * the queue once the host has rendered. What belongs to this adapter is the last part: **when** it
 * has rendered.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DependencyList } from "react";
import {
  createCommandRuntime,
  comparableControllerOptions,
  sameControllerOptions,
  stableControllerOptions,
  type MdyElementLookup,
  type MdyUiCommand,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

export type { MdyElementLookup };
export type { MdyWidgetCommandHandlers as MdyReactCommandHandlers };

/** React commits before the next frame, and focusing inside the commit moves focus to a node React is about to replace. */
const runtime = createCommandRuntime({
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
 * another render. What the configuration *says* is compared instead, and its handlers are replaced
 * by stable functions that call whatever the latest render passed — both rules live in
 * `@modyra/widgets`, so the two hook-shaped adapters cannot answer differently.
 */
export function useMdyStableOptions<T>(options: T): T {
  const latest = useRef(options);
  latest.current = options;
  const compared = useRef<unknown>(null);
  const built = useRef<T | null>(null);
  if (built.current === null || !sameControllerOptions(compared.current, comparableControllerOptions(options))) {
    compared.current = comparableControllerOptions(options);
    built.current = stableControllerOptions(options, () => latest.current);
  }
  return built.current;
}

/** Controllers whose component has run an effect cleanup since they were built. */
const retired = new WeakSet<object>();

/**
 * A widget controller, memoized on `deps`, that is built again if a cleanup ended it while the
 * component stayed mounted.
 *
 * Strict Mode mounts a component, runs every effect cleanup, and mounts it again with the same
 * memoized values. The cleanup that unsubscribes a controller also destroys it, so the remount would
 * hold a controller that answers nothing. Destroying is final in `@modyra/widgets`, and that is
 * right for every host that unmounts only once; the rehearsal belongs to this host, so it is
 * answered here: a controller that comes back from a cleanup is replaced, and the component renders
 * with the new one.
 */
export function useMdyController<C extends object>(create: () => C, deps: DependencyList): C {
  const [generation, rebuild] = useState(0);
  const controller = useMemo(create, [...deps, generation]);
  useEffect(() => {
    if (retired.has(controller)) {
      rebuild((g) => g + 1);
      return undefined;
    }
    return () => { retired.add(controller); };
  }, [controller]);
  return controller;
}
