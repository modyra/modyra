/**
 * Solid primitive for the Modyra headless primitive field controller.
 */

import type { MdyFieldHandle } from "@modyra/core";
import {
  fieldCommandHandlers,
  createTextFieldController,
  type MdyTextFieldControllerOptions,
  type MdyTextFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";
import { getOwner, onCleanup } from "solid-js";

import { solidReactivity } from "../reactivity.js";
import { executeSolidCommands } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyTextFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdySolidFieldApi<TValue> {
  readonly state: MdyFieldState<TValue>;
  readonly view: MdyWidgetViewContract;
  dispatch(intent: MdyTextFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyFieldOptions<TValue>,
): MdySolidFieldApi<TValue> {
  const reactivity = solidReactivity();
  const controller = createTextFieldController({ ...options, handle }, reactivity);

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

  const dispatch = (intent: MdyTextFieldIntent<TValue>) => {
    executeSolidCommands(
      controller.dispatch(intent),
      () => undefined,
      fieldCommandHandlers(handle),
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
