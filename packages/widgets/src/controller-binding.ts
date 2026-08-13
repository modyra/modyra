/**
 * The two things every host does with a controller, written once.
 *
 * A binding for a new framework is meant to be small: bind the reactivity, execute the commands.
 * Measured, it was not — the same subscription and the same handler triple appeared in every adapter,
 * and fourteen of the twenty-seven duplicated bodies in this workspace were one of them.
 *
 * Neither function knows a framework. One takes a runtime and a callback, the other takes a handle.
 */
import type { MdyReactivity } from "@modyra/core";
import type { MdyWidgetCommandHandlers } from "./command-runtime.js";
import type { MdyWidgetController } from "./contract.js";

/** What a controller subscription needs back from its host: "something changed, look again". */
export type MdyControllerNotify = () => void;

/**
 * Watch a controller's state and view, and hand back the teardown for both it and the controller.
 *
 * Both signals are read, and the reason is a guarantee rather than a bug: today every controller's
 * view is a function of its state, so watching one happens to be enough — six of the eight hooks in
 * this workspace did exactly that and were right by coincidence. The contract does not promise it. A
 * controller free to derive its view from something else is a controller a host must not have to
 * re-audit, so the subscription covers what the host renders.
 */
export function subscribeController(
  controller: MdyWidgetController<unknown, unknown>,
  reactivity: MdyReactivity,
  notify: MdyControllerNotify,
): () => void {
  const ref = reactivity.effect(() => {
    controller.state();
    controller.view();
    notify();
  });
  return () => {
    ref.destroy();
    controller.destroy();
  };
}

/** The half of a field handle a command executor writes back to. */
export interface MdyCommandTarget {
  markAsTouched(): void;
  markAsDirty(): void;
}

/**
 * The handlers a control with no overlay of its own gives a command executor.
 *
 * `setOpen` is a no-op rather than absent: the command vocabulary is one vocabulary, and a control
 * that cannot open still has to answer the question rather than crash on it.
 */
export function fieldCommandHandlers(handle: MdyCommandTarget): MdyWidgetCommandHandlers {
  return {
    setOpen: () => undefined,
    onTouched: () => handle.markAsTouched(),
    onDirty: () => handle.markAsDirty(),
  };
}
