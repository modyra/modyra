/**
 * React hook for the Modyra headless multiselect field controller —
 * mirrors option-field.ts's exact structure.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  createMultiselectFieldController,
  type MdyMultiselectFieldControllerOptions,
  type MdyMultiselectFieldIntent,
  type MdyMultiselectFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions, type MdyElementLookup } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyMultiselectFieldOptions<TValue> = Omit<
  MdyMultiselectFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactMultiselectFieldApi<TValue> {
  readonly state: MdyMultiselectFieldState<TValue>;
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
  readonly filteredOptions: ReadonlyArray<{ readonly value: TValue; readonly label: string; readonly disabled?: boolean }>;
  dispatch(intent: MdyMultiselectFieldIntent): void;
  setValue(values: ReadonlyArray<TValue>): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

/**
 * `elements` is how the runtime turns a part the contract names into an element it can act on.
 *
 * A controller answers "close and put focus back on the trigger" as a command naming the part, not
 * as a DOM call, so a host that supplies no lookup gets a command that resolves to nothing and
 * silently does nothing.
 */
export function useMdyMultiselectField<TValue>(
  handle: MdyFieldHandle<ReadonlyArray<TValue>>,
  options: UseMdyMultiselectFieldOptions<TValue>,
  elements?: MdyElementLookup,
): MdyReactMultiselectFieldApi<TValue> {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createMultiselectFieldController({ ...stableOptions, handle }, reactivity),
    [stableOptions, handle, reactivity],
  );

  // Held in a ref so the queue built once calls the lookup this render passed: a component's
  // elements are refs that are still null on the render that creates the queue.
  const lookupRef = useRef(elements);
  lookupRef.current = elements;
  const { execute } = useMdyCommandQueue(
    (part, key) => lookupRef.current?.(part, key),
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
      controller.filteredOptions();
      setVersion((v) => v + 1);
    });
    return () => {
      ref.destroy();
      controller.destroy();
    };
  }, [controller, reactivity]);

  const dispatch = useCallback(
    (intent: MdyMultiselectFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (values: ReadonlyArray<TValue>) => controller.setValue(values),
    [controller],
  );

  const setReadonly = useCallback(
    (readonly: boolean) => controller.setReadonly(readonly),
    [controller],
  );

  return {
    state: controller.state(),
    view: controller.view(),
    filteredOptions: controller.filteredOptions(),
    dispatch,
    setValue,
    setReadonly,
    destroy: controller.destroy,
  };
}
