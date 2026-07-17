/**
 * Vue composable for the Modyra headless select controller.
 */

import type { MdySelectOption } from "@modyra/core";
import {
  createSelectController,
  type MdySelectController,
  type MdySelectControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  triggerRef,
} from "@vue/reactivity";

import { vueReactivity } from "../index.js";

export interface UseMdySelectOptions<TValue>
  extends Omit<MdySelectControllerOptions<TValue>, "onChange"> {
  readonly onChange?: (value: TValue | null) => void;
}

export interface MdyVueSelectApi<TValue> {
  readonly state: Readonly<MdySelectState<TValue>>;
  readonly view: ReturnType<MdySelectController<TValue>["view"]>;
  dispatch(intent: MdySelectIntent): readonly import("@modyra/widgets").MdyUiCommand[];
  setValue(value: TValue | null): void;
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

/**
 * Vue composable that creates a reactive headless select controller.
 *
 * State and view are exposed as shallowRefs; templates and computed
 * properties react to them natively.
 */
export function useMdySelect<TValue>(
  options: UseMdySelectOptions<TValue>,
): MdyVueSelectApi<TValue> {
  const reactivity = vueReactivity();
  const controller = createSelectController(options, reactivity);

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

  return {
    get state(): Readonly<MdySelectState<TValue>> {
      return stateRef.value;
    },
    get view(): ReturnType<MdySelectController<TValue>["view"]> {
      return viewRef.value;
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
