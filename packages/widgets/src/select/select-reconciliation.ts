import type { MdySelectOption } from "@modyra/core";

export interface MdySelectReconciliationState<TValue> {
  readonly value: TValue | null;
  readonly parkedValue: TValue | null;
}

/**
 * Reconciles a programmatic value against a changing option set without
 * treating option loading/filtering as a user edit.
 */
export function reconcileSelectValue<TValue>(
  state: MdySelectReconciliationState<TValue>,
  options: readonly MdySelectOption<TValue>[],
): MdySelectReconciliationState<TValue> {
  const match = (value: TValue) =>
    options.find((option) => String(option.value) === String(value));

  if (state.value !== null) {
    const matched = match(state.value);
    if (matched) return { value: matched.value, parkedValue: null };
    return options.length > 0
      ? { value: null, parkedValue: state.value }
      : state;
  }

  if (state.parkedValue !== null) {
    const matched = match(state.parkedValue);
    if (matched) return { value: matched.value, parkedValue: null };
  }
  return state;
}
