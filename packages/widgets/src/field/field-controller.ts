/**
 * Headless primitive field controller.
 *
 * Wraps a form-engine field handle and exposes a universal state/view
 * contract plus a small intent/command surface for focus/blur/input.
 */

import { blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectFieldA11y } from "./field-a11y.js";
import type {
  MdyFieldControllerOptions,
  MdyFieldIntent,
  MdyFieldState,
} from "./field-types.js";

export interface MdyFieldController<TValue>
  extends MdyWidgetController<MdyFieldState<TValue>, MdyFieldIntent<TValue>> {
  /** Set the value programmatically without producing a command. */
  setValue(value: TValue): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

export function createFieldController<TValue>(
  options: MdyFieldControllerOptions<TValue>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyFieldController<TValue> {
  const {
    widgetId,
    handle,
    inputType,
    inputMode,
    readonly: initialReadonly = false,
    autocomplete,
  } = options;

  const readonly = reactivity.signal(initialReadonly);

  const state: MdySignal<MdyFieldState<TValue>> = reactivity.computed(() => ({
    value: handle.value(),
    invalid: !handle.valid(),
    disabled: handle.disabled(),
    // The form owns this state; `setReadonly()` stays an imperative override for a renderer
    // that has no form behind it. Read from the handle like every other field of this
    // projection — `readonly` alone came from the local signal, which is why a form could
    // set it and nothing downstream ever saw it.
    readonly: handle.readonly() || readonly(),
    // One value the whole controller agrees on; `disabled`/`readonly` above are its derived
    // halves, kept for renderers that still read them.
    //
    // The local override can only ever *reduce* what is permitted. `setReadonly()` is a published
    // escape hatch for a renderer with no form behind it, and it must not be able to re-enable a
    // field the form disabled.
    interactivity: handle.interactivity() === "enabled" && readonly()
      ? ("readonly" as const)
      : handle.interactivity(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectFieldA11y(currentState, handle.errors(), {
      widgetId,
      inputType,
      inputMode,
      autocomplete,
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

  function dispatch(intent: MdyFieldIntent<TValue>): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }

    // A write. Blocked for read-only as well as disabled — this is the half the two states share.
    if (blocksValueChange(state().interactivity)) {
      return [];
    }

    switch (intent.type) {
      case "focus": {
        return [];
      }
      case "input": {
        handle.set(intent.value);
        handle.markAsDirty();
        return [{ type: "mark-dirty" }];
      }
    }
  }

  function setValue(value: TValue): void {
    handle.set(value);
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
    setValue,
    setReadonly,
    destroy,
  };
}
