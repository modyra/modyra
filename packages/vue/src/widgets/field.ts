/**
 * Vue composable for the Modyra headless primitive field controller.
 */

import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "vue";
import { observerFor, type MdyFieldHandle } from "@modyra/core";
import {
  fieldCommandHandlers,
  createTextFieldController,
  type MdyTextFieldControllerOptions,
  type MdyTextFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";

import { executeVueCommands } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyTextFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdyVueFieldApi<TValue> {
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
): MdyVueFieldApi<TValue> {
  // The controller reads the handle, so it observes through the runtime that owns the handle's
  // signals; only the mirrored state is a Vue ref. A Vue effect cannot track a signal from another
  // runtime, and a field whose form runs elsewhere would never update.
  const observer = observerFor(handle);
  const controller = createTextFieldController({ ...options, handle }, observer);

  const stateRef = shallowRef(controller.state());
  const viewRef = shallowRef(controller.view());

  const effectRef = observer.effect(() => {
    stateRef.value = controller.state();
    viewRef.value = controller.view();
    triggerRef(stateRef);
    triggerRef(viewRef);
  });

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    effectRef.destroy();
    controller.destroy();
  };

  if (getCurrentScope() !== undefined) onScopeDispose(destroy);

  const dispatch = (intent: MdyTextFieldIntent<TValue>) => {
    executeVueCommands(
      controller.dispatch(intent),
      () => undefined,
      fieldCommandHandlers(handle),
    );
  };

  return {
    get state() {
      return stateRef.value;
    },
    get view() {
      return viewRef.value;
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
