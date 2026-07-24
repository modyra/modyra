/**
 * React hook for the Modyra headless datepicker field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createDatepickerFieldController,
  type MdyDatepickerFieldControllerOptions,
  type MdyDatepickerFieldIntent,
  type MdyDatepickerFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue } from "./runtime.js";

export type UseMdyDatepickerFieldOptions = Omit<
  MdyDatepickerFieldControllerOptions,
  "handle"
>;

export interface MdyReactDatepickerFieldApi {
  readonly state: MdyDatepickerFieldState;
  dispatch(intent: MdyDatepickerFieldIntent): void;
  setValue(iso: string | null): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyDatepickerField(
  handle: MdyFieldHandle<string | null>,
  options: UseMdyDatepickerFieldOptions,
): MdyReactDatepickerFieldApi {
  const reactivity = useMemo(() => vanillaReactivity(), []);

  const controller = useMemo(
    () => createDatepickerFieldController({ ...options, handle }, reactivity),
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
    (intent: MdyDatepickerFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (iso: string | null) => controller.setValue(iso),
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
