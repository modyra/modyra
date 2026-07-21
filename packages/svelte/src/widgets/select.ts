/**
 * Svelte primitive for the Modyra headless select controller.
 */

import type { MdySelectOption } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createSelectController,
  type MdySelectController,
  type MdySelectControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import type { Readable } from "svelte/store";

import { toStore } from "../index.js";

export interface UseMdySelectOptions<TValue>
  extends Omit<MdySelectControllerOptions<TValue>, "onChange"> {
  readonly onChange?: (value: TValue | null) => void;
}

export interface MdySvelteSelectApi<TValue> {
  readonly state: Readable<MdySelectState<TValue>>;
  readonly view: Readable<ReturnType<MdySelectController<TValue>["view"]>>;
  dispatch(intent: MdySelectIntent): readonly import("@modyra/widgets").MdyUiCommand[];
  setValue(value: TValue | null): void;
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

/**
 * Svelte primitive that creates a reactive headless select controller.
 *
 * State and view are exposed as real Svelte stores — use the native
 * `$state`/`$view` syntax in a `.svelte` template to subscribe.
 */
export function useMdySelect<TValue>(
  options: UseMdySelectOptions<TValue>,
): MdySvelteSelectApi<TValue> {
  const reactivity = vanillaReactivity();
  const controller = createSelectController(options, reactivity);

  return {
    state: toStore(controller.state),
    view: toStore(controller.view),
    dispatch(intent) {
      return controller.dispatch(intent);
    },
    setValue(value) {
      controller.setValue(value);
    },
    setOptions(opts) {
      controller.setOptions(opts);
    },
  };
}
