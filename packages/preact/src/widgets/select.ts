/**
 * Preact hook for the Modyra headless select controller.
 */

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { MdySelectOption } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  subscribeController,
  createSelectController,
  type MdySelectController,
  type MdySelectControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";

import {
  useMdyCommandQueue,
  type MdyElementLookup,
  type MdyPreactCommandHandlers,
} from "./runtime.js";

export interface UseMdySelectOptions<TValue>
  extends Omit<MdySelectControllerOptions<TValue>, "onChange"> {
  readonly onChange?: (value: TValue | null) => void;
}

export interface MdySelectApi<TValue> {
  readonly state: MdySelectState<TValue>;
  readonly view: ReturnType<MdySelectController<TValue>["view"]>;
  readonly dispatch: (intent: MdySelectIntent) => void;
  readonly setValue: (value: TValue | null) => void;
  readonly setOptions: (options: readonly MdySelectOption<TValue>[]) => void;
}

/**
 * Preact hook that creates and drives a headless select controller.
 *
 * The component re-renders on every controller state change. Commands are
 * flushed after the DOM commit via the Preact runtime.
 */
export function useMdySelect<TValue>(
  options: UseMdySelectOptions<TValue>,
  lookup: MdyElementLookup,
  handlers: MdyPreactCommandHandlers,
): MdySelectApi<TValue> {
  // No handle to resolve an owner from: the select controller takes options and a callback rather
  // than a field, so there is no form whose runtime this could observe through. Its own runtime is
  // correct here and would not be for any other kind.
  const reactivity = useMemo(() => vanillaReactivity(), []);
  const controller = useMemo(
    () => createSelectController(options, reactivity),
    // Recreate only when the identity of options changes; callers should
    // memoize options or use a stable key.
    [options],
  );

  const { execute } = useMdyCommandQueue(lookup, handlers);

  const [, setVersion] = useState(0);

  useEffect(
    () => subscribeController(controller, reactivity, () => setVersion((v) => v + 1)),
    [controller, reactivity],
  );

  const dispatch = useCallback(
    (intent: MdySelectIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: TValue | null) => controller.setValue(value),
    [controller],
  );

  const setOptions = useCallback(
    (opts: readonly MdySelectOption<TValue>[]) => controller.setOptions(opts),
    [controller],
  );

  return {
    state: controller.state(),
    view: controller.view(),
    dispatch,
    setValue,
    setOptions,
  };
}
