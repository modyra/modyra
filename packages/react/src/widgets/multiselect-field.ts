/**
 * React hook for the Modyra headless multiselect field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createMultiselectFieldController,
  type MdyMultiselectFieldControllerOptions,
  type MdyMultiselectFieldIntent,
  type MdyMultiselectFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyMultiselectFieldOptions<TValue> = Omit<
  MdyMultiselectFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactMultiselectFieldApi<TValue> {
  readonly state: MdyMultiselectFieldState<TValue>;
  readonly filteredOptions: ReadonlyArray<{ readonly value: TValue; readonly label: string; readonly disabled?: boolean }>;
  dispatch(intent: MdyMultiselectFieldIntent): void;
  setValue(values: ReadonlyArray<TValue>): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyMultiselectField<TValue>(
  handle: MdyFieldHandle<ReadonlyArray<TValue>>,
  options: UseMdyMultiselectFieldOptions<TValue>,
): MdyReactMultiselectFieldApi<TValue> {
  const reactivity = useMemo(() => vanillaReactivity(), []);

  const controller = useMemo(
    () => createMultiselectFieldController({ ...options, handle }, reactivity),
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
      controller.filteredOptions();
      setVersion((v) => v + 1);
    });
    return () => {
      ref.destroy();
      controller.destroy();
    };
  }, [controller, reactivity]);

  const dispatch = useCallback(
    (intent: MdyMultiselectFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (values: ReadonlyArray<TValue>) => controller.setValue(values),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  return {
    state: controller.state(),
    filteredOptions: controller.filteredOptions(),
    dispatch,
    setValue,
    setReadonly,
    destroy: controller.destroy,
  };
}
