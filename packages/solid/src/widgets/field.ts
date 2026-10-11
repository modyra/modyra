/**
 * Solid primitive for the Modyra headless primitive field controller.
 */

import { observerFor, type MdyFieldHandle } from "@modyra/core";
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
  // The controller reads the handle, so it observes through the runtime that owns the handle's
  // signals; only the mirrored state lives in Solid's graph. A Solid computation cannot track a
  // signal from another runtime, and a field whose form runs elsewhere would never update.
  const observer = observerFor(handle);
  const controller = createTextFieldController({ ...options, handle }, observer);

  const output = solidReactivity();
  const stateSig = output.signal(controller.state());
  const viewSig = output.signal(controller.view());

  const effectRef = observer.effect(() => {
    stateSig.set(controller.state());
    viewSig.set(controller.view());
  });

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    effectRef.destroy();
    controller.destroy();
  };

  if (getOwner() !== null) onCleanup(destroy);

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
    destroy,
  };
}
