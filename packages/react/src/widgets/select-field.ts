/**
 * React hook for the Modyra headless select field controller — mirrors `field.ts`'s exact structure.
 *
 * The one beside `useMdySelect`, and not the same thing: that one takes a value and a callback and is
 * for a host with no form, this one takes a field handle and reads it. A value changed anywhere else
 * — a draft restored, a server correction, another control's cross-field rule — reaches the widget
 * through the handle and never through a setter.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createSelectFieldController,
  type MdySelectFieldControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdySelectFieldOptions<TValue> = Omit<
  MdySelectFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyReactSelectFieldApi<TValue> {
  readonly state: MdySelectState<TValue>;
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
  dispatch(intent: MdySelectIntent): void;
  /** Which of the two texts under the field the trigger describes itself by. */
  setDescribedBy(shown: { readonly errorsVisible?: boolean; readonly descriptionVisible?: boolean }): void;
  setOpen(open: boolean): void;
  /** Whether the panel's contents are in the document — a host may build them only on open. */
  setPopupRendered(rendered: boolean): void;
  setLoading(loading: boolean): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdySelectField<TValue>(
  handle: MdyFieldHandle<TValue | null>,
  options: UseMdySelectFieldOptions<TValue>,
): MdyReactSelectFieldApi<TValue> {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createSelectFieldController<TValue>({ ...stableOptions, handle }, reactivity),
    [stableOptions, handle, reactivity],
  );

  const { execute } = useMdyCommandQueue(
    () => undefined,
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
    (intent: MdySelectIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setDescribedBy = useCallback(
    (shown: { readonly errorsVisible?: boolean; readonly descriptionVisible?: boolean }) =>
      controller.setDescribedBy(shown),
    [controller],
  );
  const setOpen = useCallback((open: boolean) => controller.setOpen(open), [controller]);
  const setPopupRendered = useCallback(
    (rendered: boolean) => controller.setPopupRendered(rendered),
    [controller],
  );
  const setLoading = useCallback((loading: boolean) => controller.setLoading(loading), [controller]);
  const setReadonly = useCallback((readonly: boolean) => controller.setReadonly(readonly), [controller]);

  return {
    state: controller.state(),
    view: controller.view(),
    dispatch,
    setDescribedBy,
    setOpen,
    setPopupRendered,
    setLoading,
    setReadonly,
    destroy: controller.destroy,
  };
}
