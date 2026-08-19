/**
 * React hook for the Modyra headless datepicker field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createDatepickerFieldController,
  type MdyDatepickerFieldControllerOptions,
  type MdyDatepickerFieldIntent,
  type MdyDatepickerFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";

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
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createDatepickerFieldController({ ...stableOptions, handle }, reactivity),
    [stableOptions, handle, reactivity],
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
