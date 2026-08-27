/** Choosing many: what a pick does to a value, and when the overlay has served its purpose. */
import type { MdyMultiselectMode } from "@modyra/core";
import type { MdyOptionNavigationTarget } from "./keys.js";
export type MdyMultiselectValueIntent<T> =
  | { readonly type: "toggle"; readonly value: T }
  | { readonly type: "increment"; readonly value: T }
  | { readonly type: "decrement"; readonly value: T }
  | { readonly type: "clear" };

/** Pure multiselect value transition using the same loose key semantics as select. */
export function multiselectValueTransition<T>(
  values: readonly T[],
  intent: MdyMultiselectValueIntent<T>,
  keyFor: (value: T) => string = String,
): readonly T[] {
  if (intent.type === "clear") return [];
  const key = keyFor(intent.value);
  if (intent.type === "increment") return [...values, intent.value];
  const index = values.findIndex((value) => keyFor(value) === key);
  if (intent.type === "decrement") {
    if (index < 0) return values;
    return [...values.slice(0, index), ...values.slice(index + 1)];
  }
  return index < 0
    ? [...values, intent.value]
    : values.filter((value) => keyFor(value) !== key);
}

export type MdyMultiselectOverlayAction =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "search"; readonly query: string }
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "move"; readonly target: MdyOptionNavigationTarget };

/** Canonical multiselect overlay policy. The host only supplies event facts and executes the action. */
export function multiselectOverlayAction(input: {
  readonly key: string;
  readonly open: boolean;
  /**
   * What the search box holds, where the kind has one.
   *
   * Still required though nothing reads it today: it is a fact about the moment that a policy
   * deciding what a key means may need again, every caller already passes it, and making it optional
   * would move the published surface for no gain. It stopped being read when Backspace stopped
   * answering with a no-op.
   */
  readonly query: string;
  readonly activeKey: string | null;
}): MdyMultiselectOverlayAction | null {
  const { key, open, activeKey } = input;
  if (key === "Escape" && open) return { type: "close", restoreFocus: true };
  if (key === "Enter") {
    if (!open) return { type: "open" };
    return activeKey ? { type: "select", optionKey: activeKey } : null;
  }
  const moves: Record<string, MdyOptionNavigationTarget | undefined> = {
    ArrowDown: "next",
    ArrowUp: "previous",
    Home: "first",
    End: "last",
  };
  const target = moves[key];
  if (target) {
    // A closed list has nothing to move through, so a vertical arrow reaches for the options and
    // opens it — either one. `MDY_WIDGET_KEYBOARD` declares both, and a single-select combobox
    // answers both; a policy that opened on one of them made the same widget behave two ways
    // depending on which key a user happened to press, and disagreed with the table describing it.
    //
    // `Home` and `End` still do nothing here: they mean "the first" and "the last" of a list that is
    // not on screen, and opening on them would be inventing an intent the contract does not declare.
    if (!open) return key === "ArrowDown" || key === "ArrowUp" ? { type: "open" } : null;
    return { type: "move", target };
  }
  // Tab closes and lets focus go where it was headed. A list left open follows the user to the next
  // field, and focus pulled back traps them in the one they just left.
  if (key === "Tab" && open) return { type: "close", restoreFocus: false };
  // Backspace answers nothing here.
  //
  // It used to return "clear the search" when the search was *already empty* — an action that changes
  // nothing, handed to a caller that prevents the default because it was given an action. All three
  // renderers therefore swallowed the key at the trigger and did nothing with it, including with the
  // panel closed, where there is no search box to clear.
  //
  // The key is declared on the chip, where it takes a chosen value off. Claimed at the control it was
  // taken away from the person and given to nobody: a key that is prevented and unanswered is worse
  // than one nothing claims, because the platform's own meaning is gone too.
  return null;
}

/** Single-mode closes only when no unselected result remains after the commit. */
export function shouldCloseMultiselectOverlay(
  mode: MdyMultiselectMode,
  remainingResultCount: number,
): boolean {
  return mode === "single" && remainingResultCount === 0;
}

/** ISO date bound policy shared by typed input, calendar selection and future hosts. */
