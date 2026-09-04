/**
 * React hook for the Modyra headless colour field controller — mirrors `field.ts`'s exact structure.
 *
 * The kind has three doors onto one value: the platform's picker, the text box, and the swatches.
 * They disagree about when a value is a decision — a preset closes the palette because choosing one
 * is an answer, typing does not because `#0` is on its way to being a colour — and the controller is
 * where that is settled. A host driving this without a wrapper settles it again, differently.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createColorsFieldController,
  type MdyColorsFieldControllerOptions,
  type MdyColorsFieldIntent,
  type MdyColorsFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyColorsFieldOptions = Omit<
  MdyColorsFieldControllerOptions,
  "handle"
>;

export interface MdyReactColorsFieldApi {
  readonly state: MdyColorsFieldState;
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
  dispatch(intent: MdyColorsFieldIntent): void;
  setValue(value: string): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyColorsField(
  handle: MdyFieldHandle<string>,
  options: UseMdyColorsFieldOptions,
): MdyReactColorsFieldApi {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createColorsFieldController({ ...stableOptions, handle }, reactivity),
    [stableOptions, handle, reactivity],
  );

  // The palette is an overlay, so the queue's `setOpen` is the host's to answer — the controller
  // reports that it has served its purpose and where it lives is the host's business.
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
    (intent: MdyColorsFieldIntent) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (value: string) => controller.setValue(value),
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
