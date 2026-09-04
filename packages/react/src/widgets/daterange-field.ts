/**
 * React hook for the Modyra headless daterange field controller —
 * mirrors datepicker-field.ts's exact structure.
 *
 * A range's bounds are a third thing to hand back beside the value and the readonly flag: a host
 * whose bounds move — a return date that cannot precede a departure — tells the controller rather
 * than building a new one, which would forget the month on screen and which end the next pick
 * closes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createDaterangeFieldController,
  type MdyDateRangeValue,
  type MdyDaterangeFieldControllerOptions,
  type MdyDaterangeFieldIntent,
  type MdyDaterangeFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyDaterangeFieldOptions = Omit<
  MdyDaterangeFieldControllerOptions,
  "handle"
>;

export interface MdyReactDaterangeFieldApi {
  readonly state: MdyDaterangeFieldState;
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
  dispatch(intent: MdyDaterangeFieldIntent): void;
  setValue(value: MdyDateRangeValue): void;
  setReadonly(readonly: boolean): void;
  setBounds(minDate: string | null, maxDate: string | null): void;
  destroy(): void;
}

export function useMdyDaterangeField(
  handle: MdyFieldHandle<MdyDateRangeValue>,
  options: UseMdyDaterangeFieldOptions,
): MdyReactDaterangeFieldApi {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createDaterangeFieldController({ ...stableOptions, handle }, reactivity),
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

  useEffect(
    () => subscribeController(controller, reactivity, () => setVersion((v) => v + 1)),
    [controller, reactivity],
  );

  const dispatch = useCallback(
    (intent: MdyDaterangeFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: MdyDateRangeValue) => controller.setValue(value),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  const setBounds = useCallback(
    (minDate: string | null, maxDate: string | null) => controller.setBounds(minDate, maxDate),
    [controller],
  );

  return {
    state: controller.state(),
    view: controller.view(),
    dispatch,
    setValue,
    setReadonly,
    setBounds,
    destroy: controller.destroy,
  };
}
