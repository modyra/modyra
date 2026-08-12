/**
 * React hook for the Modyra headless boolean field controller
 * (checkbox / toggle) — mirrors field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
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
  const reactivity = useMemo(() => observerFor(handle), [handle]);

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

  // Both signals. Today the view is a function of the state and nothing else, so watching one is
  // enough — but that is a property of the current controllers, not of the contract, and a host that
  // subscribes to half of what it renders is right by coincidence.
  useEffect(
    () => subscribeController(controller, reactivity, () => setVersion((v) => v + 1)),
    [controller, reactivity],
  );

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
