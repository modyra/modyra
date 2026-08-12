/**
 * Headless timepicker field controller.
 *
 * The picker edits a draft: turning the dial, typing a segment and switching period all change a
 * working copy, and nothing reaches the field until `"confirm"`. Cancelling discards it, so a
 * dismissed picker leaves the value exactly as it found it.
 *
 * The working copy is canonical 12h whatever the field's own `format` says, which keeps one
 * representation for the dial to move through; `formatTimeAs` converts on the way out. The angle and
 * parsing maths lives in `@modyra/core/datetime` — a renderer drawing its own clock face needs the
 * same functions.
 */
import { blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  angleToHour,
  angleToMinute,
  formatTimeAs,
  getCurrentTime,
  parseAnyTime,
  parseTime,
  type MdyTimeFormat,
  type ParsedTime,
} from "@modyra/core/datetime";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectTimepickerFieldA11y } from "./timepicker-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
import type {
  MdyTimepickerFieldControllerOptions,
  MdyTimepickerFieldIntent,
  MdyTimepickerFieldState,
  MdyTimepickerViewMode,
} from "./timepicker-field-types.js";

export interface MdyTimepickerFieldController
  extends MdyWidgetController<MdyTimepickerFieldState, MdyTimepickerFieldIntent> {
  /** Set the committed value (in `format`) programmatically without producing a command. */
  setValue(value: string | null): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

function currentTimeAsParsed(): ParsedTime {
  // getCurrentTime() always returns a canonical "HH:MM AM/PM" string parseTime() accepts.
  return parseTime(getCurrentTime())!;
}

export function createTimepickerFieldController(
  options: MdyTimepickerFieldControllerOptions,
  reactivity?: MdyReactivity,
): MdyTimepickerFieldController {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, format = "12h" as MdyTimeFormat, readonly: initialReadonly = false } = options;

  const readonly = reactivity.signal(initialReadonly);
  const open = reactivity.signal(false);
  const focusedField = reactivity.signal<"hour" | "minute">("hour");
  // The clock is the picker; the number fields are the alternative a user asks for. Starting on the
  // dial is what makes "pick a time" mean the same gesture in every renderer.
  const viewMode = reactivity.signal<MdyTimepickerViewMode>("dial");
  const draft = reactivity.signal<ParsedTime>(parseAnyTime(handle.value(), format) ?? currentTimeAsParsed());

  const state: MdySignal<MdyTimepickerFieldState> = reactivity.computed(() => ({
    value: handle.value(),
    format,
    draft: draft(),
    open: open(),
    focusedField: focusedField(),
    viewMode: viewMode(),
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    disabled: handle.disabled(),
    readonly: readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    interactivity: handle.interactivity(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectTimepickerFieldA11y(currentState, handle.errors(), { widgetId });
    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        trigger: a11y.trigger,
        dialog: a11y.dialog,
        hour: a11y.hour,
        hourControl: a11y.hourControl,
        minute: a11y.minute,
        minuteControl: a11y.minuteControl,
        description: a11y.description,
        error: a11y.error,
      },
    };
  });

  function openPicker(): readonly MdyUiCommand[] {
    draft.set(parseAnyTime(handle.value(), format) ?? currentTimeAsParsed());
    focusedField.set("hour");
    // Every opening starts on the hours, on the clock: where the last session left the popup is
    // not where the next one should resume.
    viewMode.set("dial");
    open.set(true);
    return [{ type: "open-overlay", anchor: { part: "trigger" } }];
  }

  function closePicker(restoreFocus: boolean): readonly MdyUiCommand[] {
    open.set(false);
    return restoreFocus
      ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
      : [{ type: "close-overlay" }];
  }

  function confirm(): readonly MdyUiCommand[] {
    handle.set(formatTimeAs(draft(), format));
    handle.markAsDirty();
    handle.markAsTouched();
    open.set(false);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }, { type: "close-overlay" }];
  }

  function dispatch(intent: MdyTimepickerFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "focus") return [];

    if (blocksValueChange(state().interactivity)) return [];

    switch (intent.type) {
      case "open":
        return openPicker();
      case "close":
        return closePicker(intent.restoreFocus ?? false);
      case "confirm":
        return confirm();
      case "cancel":
        return closePicker(true);
      case "set-hour": {
        if (intent.hour < 1 || intent.hour > 12) return [];
        draft.set({ ...draft(), hour: intent.hour });
        return [];
      }
      case "set-minute": {
        if (intent.minute < 0 || intent.minute > 59) return [];
        draft.set({ ...draft(), minute: intent.minute });
        return [];
      }
      case "set-period": {
        draft.set({ ...draft(), period: intent.period });
        return [];
      }
      case "set-from-angle": {
        const current = draft();
        draft.set(
          intent.field === "hour"
            ? { ...current, hour: angleToHour(intent.angle) }
            : { ...current, minute: angleToMinute(intent.angle) },
        );
        return [];
      }
      case "focus-field":
        focusedField.set(intent.field);
        return [];
      case "set-view-mode":
        viewMode.set(intent.mode);
        return [];
      case "clear": {
        handle.set(null);
        handle.markAsDirty();
        handle.markAsTouched();
        return [{ type: "mark-dirty" }, { type: "mark-touched" }];
      }
    }
  }

  function setValue(value: string | null): void {
    handle.set(value);
    draft.set(parseAnyTime(value, format) ?? currentTimeAsParsed());
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
