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

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyBooleanFieldOptions = Omit<
  MdyBooleanFieldControllerOptions,
  "handle"
>;

export interface MdyReactBooleanFieldApi {
  readonly state: MdyBooleanFieldState;
  /**
   * The parts the controller projects: ids, roles, ARIA relations and the classes each part
   * carries.
   *
   * Published because drawing is what a consumer of a headless hook does, and every answer here
   * is one they would otherwise write themselves — which is the contract logic this library
   * exists to keep out of their code. The text hook published it from the start; the other eight
   * did not, so a component built on them had the state and none of the anatomy.
   */
  readonly view: MdyWidgetViewContract;
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

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createBooleanFieldController({ ...stableOptions, handle }, reactivity),
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
    view: controller.view(),
    dispatch,
    setChecked,
    setReadonly,
    destroy: controller.destroy,
  };
}
