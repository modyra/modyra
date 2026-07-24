/**
 * React hook for the Modyra headless option field controller
 * (radio group / segmented) — mirrors boolean-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createOptionFieldController,
  type MdyOptionFieldControllerOptions,
  type MdyOptionFieldIntent,
  type MdyOptionFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyOptionFieldOptions<TValue> = Omit<
  MdyOptionFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactOptionFieldApi<TValue> {
  readonly state: MdyOptionFieldState<TValue>;
  dispatch(intent: MdyOptionFieldIntent): void;
  setValue(value: TValue | null): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyOptionField<TValue>(
  handle: MdyFieldHandle<TValue | null>,
  options: UseMdyOptionFieldOptions<TValue>,
): MdyReactOptionFieldApi<TValue> {
  const reactivity = useMemo(() => vanillaReactivity(), []);

  const controller = useMemo(
    () => createOptionFieldController({ ...options, handle }, reactivity),
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
    (intent: MdyOptionFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: TValue | null) => controller.setValue(value),
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
