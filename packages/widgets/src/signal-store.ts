/**
 * A subscribable view over reactive Modyra state, shaped for hosts that read external state through
 * a `subscribe` / `getSnapshot` pair.
 */

import { getFieldHandleOwner, handleFormOf, vanillaReactivity } from "@modyra/core";
import type { MdyFieldHandle, MdyReactivity, MdySignal } from "@modyra/core";

export interface MdySignalStore {
  /** Registers `onChange`; the returned function unregisters it. */
  subscribe(onChange: () => void): () => void;
  /** Monotonic version — bumps whenever any tracked signal changes. */
  getSnapshot(): number;
  /** Ends the store for good: it notifies no one afterwards and new subscriptions are inert. */
  destroy(): void;
}

/**
 * Builds a store that notifies whenever any of `signals` changes.
 *
 * `reactivity` must be the runtime that owns `signals`: an effect from an unrelated runtime does not
 * see their writes, and the store then never notifies, with no error.
 *
 * The tracking effect lives exactly as long as the store has a subscriber: the first `subscribe`
 * starts it and the last unsubscribe ends it. Losing every subscriber therefore never ends the store,
 * so a component that is cleaned up and mounted again over the same store finds one that still
 * answers. A value that moved while nobody was subscribed bumps the snapshot when tracking resumes, so
 * the next reader sees it. `destroy()` is the only final end.
 */
export function createSignalStore(
  signals: ReadonlyArray<MdySignal<unknown>>,
  reactivity: MdyReactivity,
): MdySignalStore {
  const listeners = new Set<() => void>();
  let version = 0;
  let ended = false;
  let ref: { destroy(): void } | null = null;
  // What the last snapshot was taken over, compared only when tracking resumes.
  let seen = signals.map((signal) => signal());

  function start(): void {
    let resuming = true;
    ref = reactivity.effect(() => {
      const now = signals.map((signal) => signal());
      const moved = !resuming || now.some((value, i) => !Object.is(value, seen[i]));
      resuming = false;
      seen = now;
      if (!moved) return;
      version++;
      for (const listener of [...listeners]) listener();
    });
  }

  function stop(): void {
    ref?.destroy();
    ref = null;
  }

  return {
    subscribe(onChange) {
      if (ended) return () => undefined;
      listeners.add(onChange);
      if (!ref) start();
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => version,
    destroy: () => {
      ended = true;
      listeners.clear();
      stop();
    },
  };
}

/**
 * Store over everything a field row usually renders, observed through the runtime that created
 * `handle`. A fresh runtime over another form's handle tracks nothing and fails silently: nothing
 * re-renders, and nothing says so.
 */
export function createFieldSignalStore(handle: MdyFieldHandle<unknown>): MdySignalStore {
  const store = createSignalStore(
    [
      handle.value,
      handle.errors,
      handle.touched,
      handle.dirty,
      handle.valid,
      handle.pending,
      handle.disabled,
      // Returned for `aria-required` and native bounds on the consumer's control, so a rule that
      // changes them has to re-render it like any other member a consumer reads.
      handle.required,
      handle.constraints,
    ],
    getFieldHandleOwner(handle) ?? vanillaReactivity(),
  );

  // The form's teardown reaches this one while anyone is subscribed. A component's cleanup and the
  // form's destroy race on unmount, and the consumer does not get to order them: a store still
  // notifying after the form ended re-renders a component against a form that is gone. The
  // registration is held only while the store is tracking, so a long-lived form does not keep one
  // entry for every component that ever mounted a field. Tearing down twice is harmless — the second
  // call finds the effect already gone.
  // `handleFormOf` is deliberately loose about what a form is — the registry predates any one
  // form type and a hand-built handle answers nothing — so the affordance is asked for rather than
  // assumed: a form from a version without it simply does not reach this store.
  const form = handleFormOf(handle) as { onDestroy?: (teardown: () => void) => () => void } | undefined;
  const onDestroy = form?.onDestroy?.bind(form);
  if (!onDestroy) return store;
  let release: (() => void) | undefined;
  let subscribers = 0;
  const unregister = () => {
    release?.();
    release = undefined;
  };
  return {
    ...store,
    subscribe(onChange) {
      const unsubscribe = store.subscribe(onChange);
      if (subscribers++ === 0) release = onDestroy(() => store.destroy());
      let done = false;
      return () => {
        if (done) return;
        done = true;
        unsubscribe();
        if (--subscribers === 0) unregister();
      };
    },
    destroy: () => {
      unregister();
      store.destroy();
    },
  };
}
