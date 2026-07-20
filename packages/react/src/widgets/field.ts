/**
 * React hook for the Modyra headless primitive field controller.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createFieldController,
  type MdyFieldControllerOptions,
  type MdyFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactFieldApi<TValue> {
  readonly state: MdyFieldState<TValue>;
  readonly view: MdyWidgetViewContract;
  dispatch(intent: MdyFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyFieldOptions<TValue>,
): MdyReactFieldApi<TValue> {
  const reactivity = useMemo(() => vanillaReactivity(), []);

  const controller = useMemo(
    () => createFieldController({ ...options, handle }, reactivity),
    // Recreate only when the identity of options/handle changes.
    [options, handle, reactivity],
  );

  const { execute } = useMdyCommandQueue(
    () => undefined,
    {
      setOpen: () => undefined, // no overlay in this control
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    },
  );

  const [, setVersion] = useState(0);

  useEffect(() => {
    const ref = reactivity.effect(() => {
      controller.state();
      controller.view();
      setVersion((v) => v + 1);
    });
    return () => {
      ref.destroy();
      controller.destroy();
    };
  }, [controller, reactivity]);

  const dispatch = useCallback(
    (intent: MdyFieldIntent<TValue>) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: TValue) => controller.setValue(value),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  return {
    state: controller.state(),
    view: controller.view(),
    dispatch,
    setValue,
    setReadonly,
    destroy: controller.destroy,
  };
}
