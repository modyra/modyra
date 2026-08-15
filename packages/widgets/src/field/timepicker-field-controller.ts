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

/**
 * The working copy a picker opens on, for a field that already holds a time.
 *
 * `parseAnyTime` is strict per format — a `"12h"` picker reads `"10:37 AM"` and not `"10:37"` — so a
 * value in the other notation parsed to nothing and the draft became the current wall-clock time.
 * Confirm writes the draft, so the user opened a field showing one time, saw another on the dial,
 * and pressed the button the dial is for: **the ordinary action lost their value**, while cancelling
 * preserved it.
 *
 * The notation a value arrives in is not something the value contracts constrain: a draft written by
 * a `"24h"` build, an API, a patch or a hand-written document all supply the other one. So both are
 * read, and the field's own format decides only how it is written back — which is the repair this
 * package already permits, the same shape as replacing a loosely-matched option value with the
 * option's own.
 *
 * `null` still opens at the current time. An empty picker has nothing to preserve, and opening it
 * anywhere else would be a worse answer than the one every picker gives.
 */
function draftFor(value: string | null, format: MdyTimeFormat): ParsedTime {
  return parseAnyTime(value, format)
    ?? parseAnyTime(value, format === "12h" ? "24h" : "12h")
    ?? currentTimeAsParsed();
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
  const draft = reactivity.signal<ParsedTime>(draftFor(handle.value(), format));
  // What the person typed while it is not a time. Held here for the same reason the datepicker holds
  // it: neither renderer held it, so an entry the control could not read was rewritten away by the
  // next sync and nobody had decided that it should be.
  const entryText = reactivity.signal<string | null>(null);

  const state: MdySignal<MdyTimepickerFieldState> = reactivity.computed(() => ({
    value: handle.value(),
    format,
    draft: draft(),
    open: open(),
    focusedField: focusedField(),
    viewMode: viewMode(),
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    disabled: handle.disabled(),
    // From the handle first, as `disabled` is: these are the two derived halves of one value, and
    // reading one from the form while the other waited for a host to call `setReadonly` is how a
    // field that refused every change announced nothing about it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    interactivity: handle.interactivity(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
    entryText: entryText(),
    entryUnreadable: entryText() !== null,
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
    draft.set(draftFor(handle.value(), format));
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

  /**
   * A typed entry, judged.
   *
   * Empty clears, as leaving a control empty always has. Readable commits. Unreadable keeps the text
   * and empties the value — a control showing `14:30` while holding a time it never took says "that
   * worked", and `acceptTimeField` one level down refuses exactly that for a single segment.
   */
  function takeEntry(text: string): readonly MdyUiCommand[] {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      entryText.set(null);
      return clearTime();
    }
    const value = options.parseEntry?.(trimmed) ?? null;
    if (value !== null) {
      entryText.set(null);
      setValue(value);
      handle.markAsDirty();
      handle.markAsTouched();
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    }
    entryText.set(text);
    handle.set(null);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function clearTime(): readonly MdyUiCommand[] {
    entryText.set(null);
    handle.set(null);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function confirm(): readonly MdyUiCommand[] {
    // A time arriving from the dial answers the outstanding entry.
    entryText.set(null);
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
      case "type":
        return takeEntry(intent.text);
      case "clear":
        return clearTime();
    }
  }

  function setValue(value: string | null): void {
    entryText.set(null);
    handle.set(value);
    draft.set(draftFor(value, format));
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
