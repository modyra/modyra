import { addMonths, CalendarDate } from "@modyra/core/date-utils";
import { MdySelectOption } from "../core/types";

export const projectionKey = (value: unknown): string => String(value);

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

export const isoDateText = (value: string | null | undefined): string =>
  value ? value.substring(0, 10) : "";

export function moveCalendarMonth(
  year: number,
  month: number,
  focused: CalendarDate,
  delta: number,
): { readonly year: number; readonly month: number; readonly focused: CalendarDate } {
  const view = addMonths({ year, month, day: 1 }, delta);
  return { year: view.year, month: view.month, focused: addMonths(focused, delta) };
}
