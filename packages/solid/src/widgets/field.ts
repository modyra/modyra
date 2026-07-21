/**
 * Solid primitive for the Modyra headless primitive field controller.
 */

import type { MdyFieldHandle } from "@modyra/core";
import {
  createFieldController,
  type MdyFieldControllerOptions,
  type MdyFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";
import { getOwner, onCleanup } from "solid-js";

import { solidReactivity } from "../index.js";
import { executeSolidCommands } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdySolidFieldApi<TValue> {
  readonly state: MdyFieldState<TValue>;
  readonly view: MdyWidgetViewContract;
  dispatch(intent: MdyFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyFieldOptions<TValue>,
): MdySolidFieldApi<TValue> {
  const reactivity = solidReactivity();
  const controller = createFieldController({ ...options, handle }, reactivity);

  const stateSig = reactivity.signal(controller.state());
  const viewSig = reactivity.signal(controller.view());

  const effectRef = reactivity.effect(() => {
    stateSig.set(controller.state());
    viewSig.set(controller.view());
  });

  if (getOwner() !== null) {
    onCleanup(() => {
      effectRef.destroy();
      controller.destroy();
    });
  }

  const dispatch = (intent: MdyFieldIntent<TValue>) => {
    executeSolidCommands(
      controller.dispatch(intent),
      () => undefined,
      {
        setOpen: () => undefined, // no overlay in this control
        onTouched: () => handle.markAsTouched(),
        onDirty: () => handle.markAsDirty(),
      },
    );
  };

  return {
    get state() {
      return stateSig();
    },
    get view() {
      return viewSig();
    },
    dispatch,
    setValue(value) {
      controller.setValue(value);
    },
    setReadonly(readonly) {
      controller.setReadonly(readonly);
    },
    destroy: controller.destroy,
  };
}
