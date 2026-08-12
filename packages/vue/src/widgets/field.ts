/**
 * Vue composable for the Modyra headless primitive field controller.
 */

import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "@vue/reactivity";
import type { MdyFieldHandle } from "@modyra/core";
import {
  fieldCommandHandlers,
  createTextFieldController,
  type MdyTextFieldControllerOptions,
  type MdyTextFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";

import { vueReactivity } from "../reactivity.js";
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
  const reactivity = vueReactivity();
  const controller = createTextFieldController({ ...options, handle }, reactivity);

  const stateRef = shallowRef(controller.state());
  const viewRef = shallowRef(controller.view());

  const effectRef = reactivity.effect(() => {
    stateRef.value = controller.state();
    viewRef.value = controller.view();
    triggerRef(stateRef);
    triggerRef(viewRef);
  });

  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      effectRef.destroy();
      controller.destroy();
    });
  }

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
    destroy: controller.destroy,
  };
}
