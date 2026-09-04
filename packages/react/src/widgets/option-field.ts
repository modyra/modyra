/**
 * React hook for the Modyra headless option field controller
 * (radio group / segmented) — mirrors boolean-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createOptionFieldController,
  type MdyOptionFieldControllerOptions,
  type MdyOptionFieldIntent,
  type MdyOptionFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyOptionFieldOptions<TValue> = Omit<
  MdyOptionFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactOptionFieldApi<TValue> {
  readonly state: MdyOptionFieldState<TValue>;
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
  dispatch(intent: MdyOptionFieldIntent): void;
  setValue(value: TValue | null): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyOptionField<TValue>(
  handle: MdyFieldHandle<TValue | null>,
  options: UseMdyOptionFieldOptions<TValue>,
): MdyReactOptionFieldApi<TValue> {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createOptionFieldController({ ...stableOptions, handle }, reactivity),
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
    view: controller.view(),
    dispatch,
    setValue,
    setReadonly,
    destroy: controller.destroy,
  };
}
