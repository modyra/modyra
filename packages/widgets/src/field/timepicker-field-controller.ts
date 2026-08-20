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
import type { MdyReactivity, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";
import {
  angleToMinute,
  dialHour,
  formatTimeAs,
  getCurrentTime,
  parseAnyTime,
  parseTime,
  type MdyTimeFormat,
  type ParsedTime,
} from "@modyra/core/datetime";
import { blocksValueChange } from "../interactivity.js";
import { closeOverlayWhenOutOfPlay } from "./leaving-play.js";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectTimepickerFieldA11y } from "./timepicker-field-a11y.js";
import type {
  MdyTimepickerFieldControllerOptions,
  MdyTimepickerFieldIntent,
  MdyTimepickerFieldState,
  MdyTimepickerViewMode,
} from "./timepicker-field-types.js";
import { showsAsInvalid } from "./verdict.js";

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
/** A held time in the notation this field shows, or "" when it holds none. */
function shownTime(value: string | null, format: MdyTimeFormat): string {
  if (value === null || value === "") return "";
  const parsed = parseAnyTime(value, "24h") ?? parseAnyTime(value, format);
  return parsed ? formatTimeAs(parsed, format) : value;
}

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
  const {
    widgetId,
    handle,
    format = "12h" as MdyTimeFormat,
    readonly: initialReadonly = false,
    viewMode: initialViewMode = "input",
  } = options;

  const readonly = reactivity.signal(initialReadonly);
  const open = reactivity.signal(false);
  // A field taken out of play does not keep an overlay open over it: the popup looked live, said
  // `aria-expanded="true"` to a screen reader, and answered nothing.
  const stopWatchingPlay = closeOverlayWhenOutOfPlay(reactivity, () => handle.interactivity(), open);
  const focusedField = reactivity.signal<"hour" | "minute">("hour");
  const viewMode = reactivity.signal<MdyTimepickerViewMode>(initialViewMode);
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
    display: entryText() ?? shownTime(handle.value(), format),
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

  /**
   * The hour a caller means, as the working copy holds it — or `null` when this clock has no such
   * hour.
   *
   * The draft is canonically 12-hour and every *surface* of a 24-hour picker speaks 0–23: the face
   * draws `00` and 13–23, `timeFieldBounds` answers `{min: 0, max: 23}`, `acceptTimeField` accepts
   * `"13"`, `stepTimeField` wraps 23 to 0, and the keyboard's End key asks for 23. The one seam that
   * *writes* took 1–12 and refused the rest in silence, so a 24-hour picker could not be moved off
   * whichever half of the day it opened on — by dial, by typing, or by arrow key.
   *
   * The conversion is here rather than in each host. The design said the host converts at the
   * boundary and published nothing to convert with; three renderers were each asked to reinvent it
   * and none did, for the life of the feature. A contract that is only implementable by remembering
   * an undocumented step is one that produces this defect again.
   */
  function hourFromFormat(hour: number): Pick<ParsedTime, "hour" | "period"> | null {
    if (!Number.isInteger(hour)) return null;
    if (format === "12h") {
      return hour >= 1 && hour <= 12 ? { hour, period: draft().period } : null;
    }
    if (hour < 0 || hour > 23) return null;
    // Midnight is `00` and noon is `12`, which is what the face's own labels say.
    return { hour: hour % 12 === 0 ? 12 : hour % 12, period: hour < 12 ? "AM" : "PM" };
  }

  /**
   * A refusal that reaches somebody.
   *
   * `return []` was the whole of what happened to an hour this clock does not have, and that silence
   * is why the seam above survived the life of the feature: nothing failed, nothing was reported,
   * and the draft simply did not move. ADR 0078 is the same sentence about a read-only field.
   */
  function refuse(message: string): readonly MdyUiCommand[] {
    return [{ type: "announce", message }];
  }

  function openPicker(): readonly MdyUiCommand[] {
    draft.set(draftFor(handle.value(), format));
    focusedField.set("hour");
    // Every opening starts on the hours, in the view the host configured: where the last session
    // left the popup is not where the next one should resume.
    viewMode.set(initialViewMode);
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
    // Canonical, whatever this field shows. `HH:mm` is what the value contract declares a time is,
    // so a twelve-hour picker committing `02:30 PM` handed the form a value its own rules refuse —
    // the field was invalid the moment it was answered, and the payload carried a notation nothing
    // downstream parses. The notation belongs to the control, which reads it back from `display`.
    handle.set(formatTimeAs(draft(), "24h"));
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
        // The hour arrives in the picker's own format. A 24-hour picker draws `00` and 13–23 on its
        // face, and the working copy is canonically 12-hour, so those twelve numbers had no word in
        // this vocabulary: `set-hour` refused every one of them and refused them *silently*, which
        // is why a 24-hour picker could not be moved off whichever half of the day it opened on.
        //
        // The half of the day now travels with the hour instead of only with `set-period`, which a
        // 24-hour picker correctly has no control for.
        const chosen = hourFromFormat(intent.hour);
        if (chosen === null) return refuse(`${intent.hour} is not an hour this clock shows.`);
        draft.set({ ...draft(), ...chosen });
        return [];
      }
      case "set-minute": {
        if (intent.minute < 0 || intent.minute > 59) return refuse(`${intent.minute} is not a minute.`);
        draft.set({ ...draft(), minute: intent.minute });
        return [];
      }
      case "set-period": {
        draft.set({ ...draft(), period: intent.period });
        return [];
      }
      case "set-from-angle": {
        const current = draft();
        if (intent.field !== "hour") {
          draft.set({ ...current, minute: angleToMinute(intent.angle) });
          return [];
        }
        // The ring is what tells 3 from 15: one direction, two numbers, and the arithmetic for it
        // lives in `@modyra/core/datetime` with the rest of the dial's.
        const shown = dialHour(intent.angle, format === "24h" ? intent.ring ?? "outer" : "outer");
        const chosen = hourFromFormat(shown);
        if (chosen === null) return refuse(`${shown} is not an hour this clock shows.`);
        draft.set({ ...current, ...chosen });
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
    stopWatchingPlay();
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
