/**
 * React hook for the Modyra headless primitive field controller.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createTextFieldController,
  type MdyTextFieldControllerOptions,
  type MdyTextFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyTextFieldOptions<TValue> = Omit<
  MdyTextFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactTextFieldApi<TValue> {
  readonly state: MdyFieldState<TValue>;
  readonly view: MdyWidgetViewContract;
  dispatch(intent: MdyTextFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyTextField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyTextFieldOptions<TValue>,
): MdyReactTextFieldApi<TValue> {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  const controller = useMemo(
    () => createTextFieldController({ ...options, handle }, reactivity),
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

  useEffect(
    () => subscribeController(controller, reactivity, () => setVersion((v) => v + 1)),
    [controller, reactivity],
  );

  const dispatch = useCallback(
    (intent: MdyTextFieldIntent<TValue>) => {
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
