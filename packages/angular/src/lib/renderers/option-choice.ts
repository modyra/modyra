import { defaultOptionKey } from "@modyra/widgets";

/**
 * Whether a held value is this option's, asked the way the contract keys options.
 *
 * Identity first, then the key: a draft, a refetch or an import hands the field a fresh object that
 * is an option's value without being the same reference. Asked through `String()`, every plain
 * object would match every other.
 */
export function isChosenOption(held: unknown, optionValue: unknown): boolean {
  if (held === optionValue) return true;
  if (held === null || held === undefined || optionValue === null || optionValue === undefined) {
    return false;
  }
  return defaultOptionKey(held) === defaultOptionKey(optionValue);
}
