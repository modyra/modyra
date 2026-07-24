/**
 * React hook for the Modyra headless timepicker field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
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
  const reactivity = useMemo(() => vanillaReactivity(), []);

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

  useEffect(() => {
    const ref = reactivity.effect(() => {
      controller.state();
      setVersion((v) => v + 1);
    });
    return () => {
      ref.destroy();
      controller.destroy();
    };
  }, [controller, reactivity]);

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
