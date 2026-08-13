/**
 * Colour field controller.
 *
 * One value, three doors — the platform picker, the text box, the presets — and the whole reason
 * this needs a controller is that they do not agree on when a value is a decision. A preset closes
 * the overlay because choosing one is an answer. Typing does not, because `#0` is on its way to
 * being a colour and a field that committed or rejected on every keystroke would take the half-typed
 * value away from the person typing it.
 *
 * The text being edited is therefore separate from the value being held, which is the same shape the
 * range picker's draft has and for the same reason.
 */
import { observerFor, type MdyReactivity, type MdySignal } from "@modyra/core";
import { colorValueEquals, colorValueTransition } from "../behavior.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { blocksValueChange } from "../interactivity.js";
import { fieldShellRootClasses, projectFieldShellA11y } from "./shell-a11y.js";
import type {
  MdyColorsFieldControllerOptions,
  MdyColorsFieldIntent,
  MdyColorsFieldPreset,
  MdyColorsFieldState,
} from "./colors-field-types.js";
import { showsAsInvalid } from "./verdict.js";

export interface MdyColorsFieldController
  extends MdyWidgetController<MdyColorsFieldState, MdyColorsFieldIntent> {
  setValue(value: string): void;
  setReadonly(readonly: boolean): void;
}

export function createColorsFieldController(
  options: MdyColorsFieldControllerOptions,
  reactivity?: MdyReactivity,
): MdyColorsFieldController {
  reactivity = observerFor(options.handle, reactivity);
  const { widgetId, handle, presets = [], readonly: initialReadonly = false } = options;

  const readonly = reactivity.signal(initialReadonly);
  const open = reactivity.signal(false);
  /**
   * What is in the box while the user is typing, and `null` the rest of the time.
   *
   * The box shows the value; the only reason it is a separate thing at all is the keystroke that is
   * not yet a colour — `#00` on its way to `#0084ff`. Held as a signal seeded from the value and
   * written beside every commit, it was a copy: a value written from anywhere else — a draft
   * restored, a server response, `patch()` — left the box showing the old colour for good.
   */
  const typed = reactivity.signal<string | null>(null);
  const text = reactivity.computed(() => typed() ?? handle.value() ?? "");

  const state: MdySignal<MdyColorsFieldState> = reactivity.computed(() => {
    const value = handle.value() ?? "";
    const offered: MdyColorsFieldPreset[] = presets.map((preset) => ({
      value: preset,
      // Case-insensitively: `#0084FF` and `#0084ff` are one colour, and a swatch that fails to mark
      // itself selected because of capitalisation is a swatch nobody can tell is chosen.
      selected: colorValueEquals(value, preset),
    }));
    return {
      value,
      text: text(),
      presets: offered,
      open: open(),
      // Out of play, no verdict. See verdict.ts.
      invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
      disabled: handle.disabled(),
      readonly: handle.readonly() || readonly(),
      interactivity: handle.interactivity() === "enabled" && readonly()
        ? ("readonly" as const)
        : handle.interactivity(),
      required: handle.required(),
      touched: handle.touched(),
      dirty: handle.dirty(),
      pending: handle.pending(),
    };
  });

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const current = state();
    const shell = projectFieldShellA11y(current, handle.errors(), { widgetId, kind: "colors" });
    const definition = MDY_WIDGET_CONTRACTS.colors;
    return {
      root: { classes: fieldShellRootClasses(current as unknown as Readonly<Record<string, unknown>>), attributes: {} },
      parts: {
        label: shell.label,
        control: shell.control,
        description: shell.description,
        error: shell.error,
        preview: {
          classes: [...definition.parts.preview.classes],
          // Decoration, and said so: the colour is already announced by the control's own value, and
          // a swatch that repeats it is a second thing for a screen reader to read out.
          attributes: { "aria-hidden": "true" },
        },
        presets: {
          classes: [...definition.parts.presets.classes],
          attributes: { role: "listbox", "aria-label": "Colour presets" },
        },
        ...Object.fromEntries(current.presets.map((preset) => [preset.value, {
          classes: [
            ...definition.parts.swatch.classes,
            ...(preset.selected ? ["mdy-colors__swatch--selected"] : []),
          ],
          attributes: {
            role: "option",
            "aria-selected": String(preset.selected),
            "aria-label": preset.value,
          },
        }])),
      },
    };
  });

  function commit(value: string, close: boolean, touched: boolean): readonly MdyUiCommand[] {
    handle.set(value);
    handle.markAsDirty();
    const commands: MdyUiCommand[] = [{ type: "mark-dirty" }];
    if (touched) {
      handle.markAsTouched();
      commands.push({ type: "mark-touched" });
    }
    if (close && open()) {
      open.set(false);
      commands.push({ type: "close-overlay" }, { type: "restore-focus", target: { part: "toggle" } });
    }
    return commands;
  }

  function dispatch(intent: MdyColorsFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "focus") return [];
    if (blocksValueChange(state().interactivity)) return [];

    switch (intent.type) {
      case "open":
        open.set(true);
        return [{ type: "open-overlay", anchor: { part: "toggle" } }];
      case "close":
        open.set(false);
        return intent.restoreFocus
          ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "toggle" } }]
          : [{ type: "close-overlay" }];
      case "native":
      case "text":
      case "preset": {
        // What is in the box is what was typed, always. Whether it also becomes the value is the
        // transition's answer, and `undefined` means "not yet a colour" rather than "clear it".
        const next = colorValueTransition(intent);
        if (next.value === undefined) {
          // Still on its way to a colour: the box keeps the keystrokes and the value keeps what it
          // had.
          typed.set(intent.value);
          return [];
        }
        // It became a colour, so the box goes back to showing the value — which is now this one.
        typed.set(null);
        return commit(next.value, next.close, next.touched);
      }
    }
  }

  function setValue(value: string): void {
    typed.set(null);
    handle.set(value);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    open.set(false);
  }

  return { state, view, dispatch, setValue, setReadonly, destroy };
}
