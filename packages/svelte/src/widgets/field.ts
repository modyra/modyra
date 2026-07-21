/**
 * Svelte primitive for the Modyra headless primitive field controller.
 */

import type { MdyFieldHandle } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createFieldController,
  type MdyFieldControllerOptions,
  type MdyFieldIntent,
  type MdyFieldState,
  type MdyWidgetViewContract,
} from "@modyra/widgets";
import type { Readable } from "svelte/store";

import { toStore } from "../index.js";
import { executeSvelteCommands } from "./runtime.js";

export type UseMdyFieldOptions<TValue> = Omit<
  MdyFieldControllerOptions<TValue>,
  "handle"
>;

export interface MdySvelteFieldApi<TValue> {
  readonly state: Readable<MdyFieldState<TValue>>;
  readonly view: Readable<MdyWidgetViewContract>;
  dispatch(intent: MdyFieldIntent<TValue>): void;
  setValue(value: TValue): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

export function useMdyField<TValue>(
  handle: MdyFieldHandle<TValue>,
  options: UseMdyFieldOptions<TValue>,
): MdySvelteFieldApi<TValue> {
  const reactivity = vanillaReactivity();
  const controller = createFieldController({ ...options, handle }, reactivity);

  const dispatch = (intent: MdyFieldIntent<TValue>) => {
    executeSvelteCommands(
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
