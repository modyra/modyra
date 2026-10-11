/**
 * Svelte primitive for the Modyra headless primitive field controller.
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
import type { Readable } from "svelte/store";

import { storeThrough } from "../reactivity.js";
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
  // Observed through the runtime that owns the handle's signals: a store tracking on any other
  // runtime would never hear a write to a field whose form runs there.
  const observer = observerFor(handle);
  const controller = createTextFieldController({ ...options, handle }, observer);

  const dispatch = (intent: MdyTextFieldIntent<TValue>) => {
    executeSvelteCommands(
      controller.dispatch(intent),
      () => undefined,
      fieldCommandHandlers(handle),
    );
  };

  return {
    state: storeThrough(controller.state, observer),
    view: storeThrough(controller.view, observer),
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
