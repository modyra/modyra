/**
 * Solid primitive for the Modyra headless select controller.
 */

import type { MdySelectOption } from "@modyra/core";
import {
  createSelectController,
  type MdySelectController,
  type MdySelectControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import { getOwner, onCleanup } from "solid-js";

import { solidReactivity } from "../index.js";

export interface UseMdySelectOptions<TValue>
  extends Omit<MdySelectControllerOptions<TValue>, "onChange"> {
  readonly onChange?: (value: TValue | null) => void;
}

export interface MdySolidSelectApi<TValue> {
  readonly state: Readonly<MdySelectState<TValue>>;
  readonly view: ReturnType<MdySelectController<TValue>["view"]>;
  dispatch(intent: MdySelectIntent): readonly import("@modyra/widgets").MdyUiCommand[];
  setValue(value: TValue | null): void;
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

/**
 * Solid primitive that creates a reactive headless select controller.
 *
 * State and view are exposed as getters over Solid signals — read them
 * inside a `createMemo`/`createEffect`/JSX expression to track natively.
 */
export function useMdySelect<TValue>(
  options: UseMdySelectOptions<TValue>,
): MdySolidSelectApi<TValue> {
  const reactivity = solidReactivity();
  const controller = createSelectController(options, reactivity);

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

  return {
    get state(): Readonly<MdySelectState<TValue>> {
      return stateSig();
    },
    get view(): ReturnType<MdySelectController<TValue>["view"]> {
      return viewSig();
    },
    dispatch(intent) {
      return controller.dispatch(intent);
    },
    setValue(value) {
      controller.setValue(value);
    },
    setOptions(options) {
      controller.setOptions(options);
    },
  };
}
