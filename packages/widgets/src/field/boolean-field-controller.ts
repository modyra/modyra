/**
 * Headless boolean field controller (checkbox / toggle switch).
 */

import { blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { fieldCanBeInvalid } from "./verdict.js";
import { projectBooleanFieldA11y } from "./boolean-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
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
  reactivity?: MdyReactivity,
): MdyBooleanFieldController {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, variant = "checkbox", readonly: initialReadonly = false } = options;

  const readonly = reactivity.signal(initialReadonly);

  const state: MdySignal<MdyBooleanFieldState> = reactivity.computed(() => ({
    checked: handle.value() === true,
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
    const a11y = projectBooleanFieldA11y(state(), handle.errors(), {
      widgetId,
      // The error container is reserved under any field that can fail a rule, which is a fact about
      // the field and not about the renderer — so the description names one element that never
      // changes, in every renderer, without each deciding it again.
      // Asked defensively: a handle is not obliged to offer either, and a controller that reads
      // both unguarded stops working for one that offers neither — which is a crash where the honest
      // answer is "this field declares no rule I can see".
      errorsReserved: fieldCanBeInvalid({
        required: handle.required?.() ?? false,
        constraints: handle.constraints?.() ?? null,
        disabled: handle.disabled?.() ?? false,
      }),

      variant,
      // The key a native submit reads this control's value under, taken from the handle: it is what
      // knows the field's place in the form, and a renderer passing it separately could pass another.
      submitName: handle.path,
    });

    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        input: a11y.input,
        submitFalse: a11y.submitFalse,
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

    if (blocksValueChange(state().interactivity)) {
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
