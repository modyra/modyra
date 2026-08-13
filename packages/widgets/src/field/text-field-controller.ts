/**
 * Headless primitive field controller.
 *
 * Wraps a form-engine field handle and exposes a universal state/view
 * contract plus a small intent/command surface for focus/blur/input.
 */

import { blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectTextFieldA11y } from "./text-field-a11y.js";
import { narrowConstraints } from "../native-constraints.js";
import { showsAsInvalid } from "./verdict.js";
import type {
    MdyFieldState,
} from "./field-types.js";
import type { MdyTextFieldControllerOptions, MdyTextFieldIntent } from "./text-field-types.js";

export interface MdyTextFieldController<TValue>
  extends MdyWidgetController<MdyFieldState<TValue>, MdyTextFieldIntent<TValue>> {
  /** Set the value programmatically without producing a command. */
  setValue(value: TValue): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

export function createTextFieldController<TValue>(
  options: MdyTextFieldControllerOptions<TValue>,
  reactivity?: MdyReactivity,
): MdyTextFieldController<TValue> {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const {
    widgetId,
    handle,
    inputType,
    kind,
    constraints: narrowing,
    inputMode,
    readonly: initialReadonly = false,
    autocomplete,
  } = options;

  const readonly = reactivity.signal(initialReadonly);

  const state: MdySignal<MdyFieldState<TValue>> = reactivity.computed(() => ({
    value: handle.value(),
    // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
    // failing would show a verdict the form itself ignores. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    disabled: handle.disabled(),
    // The form owns this state; `setReadonly()` is an imperative override for a renderer with no
    // form behind it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    //
    // The imperative override can only ever narrow what is permitted: `setReadonly()` serves a
    // renderer with no form behind it, and must not re-enable a field the form disabled.
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
    const a11y = projectTextFieldA11y(currentState, handle.errors(), {
      widgetId,
      inputType,
      inputMode,
      autocomplete,
      kind,
      // The rules, narrowed by whatever this control asks for. Composed here rather than applied to
      // the element afterwards, so there is no order of application to get right — and one place
      // answers "what does this control offer".
      constraints: narrowConstraints(handle.constraints(), narrowing?.()),
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

  function dispatch(intent: MdyTextFieldIntent<TValue>): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }

    // A write: blocked for read-only as well as disabled.
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

/**
 * How much of a slider's track is filled, as a ratio.
 *
 * A slider is a numeric field with a track, so it is served by this controller — and this was the
 * whole content of a file called `slider-field-types.ts`, which declared no type at all. A module
 * named for what it does not contain is a module nobody finds.
 */
export function sliderFillRatio(value: unknown, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
