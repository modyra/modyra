import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";
import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "./contract.js";

export type MdyValueWidgetIntent<T> =
  | { readonly type: "input"; readonly value: T }
  | { readonly type: "select"; readonly value: T }
  | { readonly type: "toggle" }
  | { readonly type: "increment"; readonly step?: number; readonly max?: number | null }
  | { readonly type: "decrement"; readonly step?: number; readonly min?: number | null }
  | { readonly type: "blur" }
  | { readonly type: "focus" };

export interface MdyValueWidgetState<T> {
  readonly value: T;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly invalid: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
}

export interface MdyValueWidgetController<T>
  extends MdyWidgetController<MdyValueWidgetState<T>, MdyValueWidgetIntent<T>> {
  setValue(value: T): void;
  setDisabled(disabled: boolean): void;
  setReadonly(readonly: boolean): void;
  setInvalid(invalid: boolean): void;
}

export interface MdyValueWidgetControllerOptions<T> {
  readonly kind: MdyWidgetKind;
  readonly value: T;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly invalid?: boolean;
  readonly onChange?: (value: T) => void;
}

/** Controller shared by scalar fields whose semantic transition is value + dirty/touched. */
export function createValueWidgetController<T>(
  options: MdyValueWidgetControllerOptions<T>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyValueWidgetController<T> {
  const definition = MDY_WIDGET_CONTRACTS[options.kind];
  const value = reactivity.signal(options.value);
  const disabled = reactivity.signal(options.disabled ?? false);
  const readonly = reactivity.signal(options.readonly ?? false);
  const invalid = reactivity.signal(options.invalid ?? false);
  const touched = reactivity.signal(false);
  const dirty = reactivity.signal(false);

  const state: MdySignal<MdyValueWidgetState<T>> = reactivity.computed(() => ({
    value: value(), disabled: disabled(), readonly: readonly(), invalid: invalid(),
    touched: touched(), dirty: dirty(),
  }));
  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => ({
    root: definition.parts.root,
    parts: definition.parts,
    structure: definition.structure,
  }));

  function commit(next: T): readonly MdyUiCommand[] {
    value.set(next);
    // One act, two flags: the value is no longer what it arrived as, and the field has had an
    // answer — which is what decides whether a refusal is shown to anybody yet. ADR 0167.
    dirty.set(true);
    touched.set(true);
    options.onChange?.(next);
    return [{ type: "emit-change" }, { type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function dispatch(intent: MdyValueWidgetIntent<T>): readonly MdyUiCommand[] {
    // A leaving is not an answer. Tab is how a person reads a form, and reading is not declining.
    // ADR 0167.
    if (intent.type === "blur") return [];
    if (intent.type === "focus") return [];
    if (disabled() || readonly()) return [];
    if (intent.type === "input" || intent.type === "select") return commit(intent.value);
    if (intent.type === "toggle") return commit((!value()) as T);
    const current = Number(value());
    if (!Number.isFinite(current)) return [];
    const step = intent.step ?? 1;
    const stepped = intent.type === "increment"
      ? Math.min(intent.max ?? Number.POSITIVE_INFINITY, current + step)
      : Math.max(intent.min ?? Number.NEGATIVE_INFINITY, current - step);
    return commit(snapToStep(stepped, step) as T);
  }

  return {
    state, view, dispatch,
    setValue: value.set,
    setDisabled: disabled.set,
    setReadonly: readonly.set,
    setInvalid: invalid.set,
    destroy() {
      // no-op
    },
  };
}

/**
 * A stepped value, at the precision the step describes.
 *
 * `0 + 0.1` five times is `0.5`; the third one along the way is `0.30000000000000004`, and a price,
 * a rating or a weight steps by a fraction. That value is what the field shows and what the form
 * submits: it fails a `multipleOf` rule, prints at full width in any control that does not format
 * it, and is not equal to the `0.3` a server or a fixture compares against.
 *
 * The platform is the standard being met rather than a preference — `<input type="number"
 * step="0.1">` stepped up five times gives `"0.1" "0.2" "0.3" "0.4" "0.5"`, and one holding `0.3`
 * steps down to `"0.2"`. A widget standing in for that control answers the same way.
 *
 * Rounded to the step's own decimal places rather than to a fixed precision: a whole-number step
 * leaves large integers exactly as they are, and a step of `0.001` keeps three places.
 */
function snapToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step)) return value;
  const decimals = decimalPlaces(step);
  if (decimals === 0) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** How many digits a step declares after the point, exponent notation included. */
function decimalPlaces(step: number): number {
  const text = String(Math.abs(step));
  const exponent = text.indexOf("e-");
  if (exponent !== -1) {
    const fraction = text.slice(0, exponent).split(".")[1]?.length ?? 0;
    return fraction + Number(text.slice(exponent + 2));
  }
  return text.split(".")[1]?.length ?? 0;
}
