/**
 * Vue composable for the Modyra headless primitive field controller.
 */

import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "@vue/reactivity";
import type { MdyFieldHandle } from "@modyra/core";
import {
  createFieldController,
  type MdyFieldControllerOptions,
  type MdyFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";

import { vueReactivity } from "../index.js";
import { executeVueCommands } from "./runtime.js";

export interface UseMdyFieldOptions<TValue>
  extends Omit<MdyFieldControllerOptions<TValue>, "handle"> {}

export interface MdyVueFieldApi<TValue> {
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
): MdyVueFieldApi<TValue> {
  const reactivity = vueReactivity();
  const controller = createFieldController({ ...options, handle }, reactivity);

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

  const dispatch = (intent: MdyFieldIntent<TValue>) => {
    executeVueCommands(
      controller.dispatch(intent),
      () => undefined,
      {
        setOpen: () => {},
        onTouched: () => handle.markAsTouched(),
        onDirty: () => handle.markAsDirty(),
      },
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
