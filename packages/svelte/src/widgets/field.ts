/**
 * Svelte primitive for the Modyra headless primitive field controller.
 */

import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  fieldCommandHandlers,
  createTextFieldController,
  type MdyTextFieldControllerOptions,
  type MdyTextFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";
import type { Readable } from "svelte/store";

import { toStore } from "../index.js";
import { executeSvelteCommands } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyTextFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdySvelteFieldApi<TValue> {
  readonly state: Readable<MdyFieldState<TValue>>;
  readonly view: Readable<MdyWidgetViewContract>;
  dispatch(intent: MdyTextFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyFieldOptions<TValue>,
): MdySvelteFieldApi<TValue> {
  const reactivity = vanillaReactivity();
  const controller = createTextFieldController({ ...options, handle }, reactivity);

  const dispatch = (intent: MdyTextFieldIntent<TValue>) => {
    executeSvelteCommands(
      controller.dispatch(intent),
      () => undefined,
      fieldCommandHandlers(handle),
    );
  };

  return {
    state: toStore(controller.state),
    view: toStore(controller.view),
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
