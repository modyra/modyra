/**
 * React hook for the Modyra headless boolean field controller
 * (checkbox / toggle) — mirrors field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createBooleanFieldController,
  type MdyBooleanFieldControllerOptions,
  type MdyBooleanFieldIntent,
  type MdyBooleanFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyBooleanFieldOptions = Omit<
  MdyBooleanFieldControllerOptions,
  "handle"
>;

export interface MdyReactBooleanFieldApi {
  readonly state: MdyBooleanFieldState;
  dispatch(intent: MdyBooleanFieldIntent): void;
  setChecked(checked: boolean): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyBooleanField(
  handle: MdyFieldHandle<boolean>,
  options: UseMdyBooleanFieldOptions,
): MdyReactBooleanFieldApi {
  const reactivity = useMemo(() => vanillaReactivity(), []);

  const controller = useMemo(
    () => createBooleanFieldController({ ...options, handle }, reactivity),
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
    (intent: MdyBooleanFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setChecked = useCallback(
    (checked: boolean) => controller.setChecked(checked),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  return {
    state: controller.state(),
    dispatch,
    setChecked,
    setReadonly,
    destroy: controller.destroy,
  };
}
