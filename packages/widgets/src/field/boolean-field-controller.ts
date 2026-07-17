/**
 * Headless boolean field controller (checkbox / toggle switch).
 */

import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectBooleanFieldA11y } from "./boolean-field-a11y.js";
import type {
  MdyBooleanFieldControllerOptions,
  MdyBooleanFieldIntent,
  MdyBooleanFieldState,
} from "./boolean-field-types.js";

export interface MdyBooleanFieldController
  extends MdyWidgetController<MdyBooleanFieldState, MdyBooleanFieldIntent> {
  /** Set the checked state programmatically without producing a command. */
  setChecked(checked: boolean): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

export function createBooleanFieldController(
  options: MdyBooleanFieldControllerOptions,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyBooleanFieldController {
  const { widgetId, handle, variant = "checkbox", readonly: initialReadonly = false } = options;

  const readonly = reactivity.signal(initialReadonly);

  const state: MdySignal<MdyBooleanFieldState> = reactivity.computed(() => ({
    checked: handle.value() === true,
    invalid: !handle.valid(),
    disabled: handle.disabled(),
    readonly: readonly(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const a11y = projectBooleanFieldA11y(state(), handle.errors(), {
      widgetId,
      variant,
    });

    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        input: a11y.input,
        description: a11y.description,
        error: a11y.error,
      },
    };
  });

  function dispatch(intent: MdyBooleanFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }

    if (state().disabled || state().readonly) {
      return [];
    }

    switch (intent.type) {
      case "check": {
        handle.set(true);
        handle.markAsDirty();
        return [{ type: "mark-dirty" }];
      }
      case "uncheck": {
        handle.set(false);
        handle.markAsDirty();
        return [{ type: "mark-dirty" }];
      }
      case "toggle": {
        handle.set(!handle.value());
        handle.markAsDirty();
        return [{ type: "mark-dirty" }];
      }
    }
  }

  function setChecked(checked: boolean): void {
    handle.set(checked);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return {
    state,
    view,
    dispatch,
    setChecked,
    setReadonly,
    destroy,
  };
}
