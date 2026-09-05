import { addMonths, CalendarDate } from "@modyra/core/datetime";
import { defaultOptionKey } from "@modyra/widgets";
import { MdySelectOption } from "../core/types";

/**
 * The key a value is identified by, which is the contract's and not this renderer's.
 *
 * `String(value)` renders every plain object as `[object Object]`, so two different choices held at
 * once arrived as one key: the field drew a single chip labelled as the first of them, taken twice,
 * with the counter agreeing. A person read a field asserting something they had not chosen.
 *
 * `defaultOptionKey` is what the controller derives its own keys with, so a renderer that spells the
 * derivation again is a second answer to a question already answered — and for primitives the two
 * agree exactly, which is why every fixture in this suite concurred and none of them could see it.
 */
export const projectionKey = (value: unknown): string => defaultOptionKey(value);

export function findProjectedOption<T>(
  options: readonly MdySelectOption<T>[],
  value: unknown,
): MdySelectOption<T> | undefined {
  const key = projectionKey(value);
  return options.find((option) => projectionKey(option.value) === key);
}

export const inputText = (event: Event): string =>
  (event.target as HTMLInputElement | HTMLTextAreaElement).value;

export const inputNumber = (event: Event): number | null => {
  const value = inputText(event);
  return value === "" ? null : Number(value);
};

export const inputChecked = (event: Event): boolean =>
  (event.target as HTMLInputElement).checked;

/**
 * The date part of an ISO value, and the empty string for anything that is not one.
 *
 * The model holds what a document put in it and reports the field invalid rather than refusing the
 * write, so this is handed values of any shape. Reading one as text throws during change detection,
 * which takes out the control that was going to show the verdict.
 */
export const isoDateText = (value: string | null | undefined): string =>
  typeof value === "string" ? value.substring(0, 10) : "";

export function moveCalendarMonth(
  year: number,
  month: number,
  focused: CalendarDate,
  delta: number,
): { readonly year: number; readonly month: number; readonly focused: CalendarDate } {
  const view = addMonths({ year, month, day: 1 }, delta);
  return { year: view.year, month: view.month, focused: addMonths(focused, delta) };
}

