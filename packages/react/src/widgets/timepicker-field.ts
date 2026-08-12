/**
 * React hook for the Modyra headless timepicker field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createTimepickerFieldController,
  type MdyTimepickerFieldControllerOptions,
  type MdyTimepickerFieldIntent,
  type MdyTimepickerFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyTimepickerFieldOptions = Omit<
  MdyTimepickerFieldControllerOptions,
  "handle"
>;

export interface MdyReactTimepickerFieldApi {
  readonly state: MdyTimepickerFieldState;
  dispatch(intent: MdyTimepickerFieldIntent): void;
  setValue(value: string | null): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyTimepickerField(
  handle: MdyFieldHandle<string | null>,
  options: UseMdyTimepickerFieldOptions,
): MdyReactTimepickerFieldApi {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  const controller = useMemo(
    () => createTimepickerFieldController({ ...options, handle }, reactivity),
    [options, handle, reactivity],
  );

  const { execute } = useMdyCommandQueue(
    () => undefined, // no overlay/focus target beyond the control itself
    {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    },
  );

  const [, setVersion] = useState(0);

  // Both signals. Today the view is a function of the state and nothing else, so watching one is
  // enough — but that is a property of the current controllers, not of the contract, and a host that
  // subscribes to half of what it renders is right by coincidence.
  useEffect(
    () => subscribeController(controller, reactivity, () => setVersion((v) => v + 1)),
    [controller, reactivity],
  );

  const dispatch = useCallback(
    (intent: MdyTimepickerFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: string | null) => controller.setValue(value),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  return {
    state: controller.state(),
    dispatch,
    setValue,
    setReadonly,
    destroy: controller.destroy,
  };
}
