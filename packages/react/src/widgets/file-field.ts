/**
 * React hook for the Modyra headless file field controller — mirrors `field.ts`'s exact structure.
 *
 * What it carries that a value cannot: the candidates the field *refused*. A size limit or an accept
 * list turns files away, and nothing in the form records that it happened — a host that shows its own
 * message about it has no other source, and refusing in silence leaves no evidence at all.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MdyFieldHandle } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  subscribeController,
  createFileFieldController,
  type MdyFileCandidate,
  type MdyFileFieldControllerOptions,
  type MdyFileFieldIntent,
  type MdyFileFieldState,
} from "@modyra/widgets";

import { useMdyCommandQueue, useMdyStableOptions } from "./runtime.js";
import type { MdyWidgetViewContract } from "@modyra/widgets";

export type UseMdyFileFieldOptions<TFile extends MdyFileCandidate> = Omit<
  MdyFileFieldControllerOptions<TFile>,
  "handle"
>;

export interface MdyReactFileFieldApi<TFile extends MdyFileCandidate> {
  readonly state: MdyFileFieldState<TFile>;
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
  dispatch(intent: MdyFileFieldIntent<TFile>): void;
  setValue(files: readonly TFile[]): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyFileField<TFile extends MdyFileCandidate>(
  handle: MdyFieldHandle<readonly TFile[]>,
  options: UseMdyFileFieldOptions<TFile>,
): MdyReactFileFieldApi<TFile> {
  const reactivity = useMemo(() => observerFor(handle), [handle]);

  // Held while it says the same thing: a configuration written at the call is a new object every
  // render, and rebuilding the controller on its identity never settles.
  const stableOptions = useMdyStableOptions(options);
  const controller = useMemo(
    () => createFileFieldController<TFile>({ ...stableOptions, handle }, reactivity),
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
    (intent: MdyFileFieldIntent<TFile>) => {
      execute(controller.dispatch(intent));
    },
    [controller, execute],
  );

  const setValue = useCallback(
    (files: readonly TFile[]) => controller.setValue(files),
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
