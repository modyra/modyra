import type { MdyOptionNavigationTarget } from "./keys.js";
/** The select's keyboard policy: one place, so three renderers cannot agree on the easy keys only. */
export type MdySelectKeyboardAction =
  | { readonly type: "move"; readonly target: MdyOptionNavigationTarget }
  | { readonly type: "open" }
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "create" }
  /**
   * `restoreFocus` is false when the key that closed the list is also taking focus somewhere else.
   * Escape returns the user to the trigger; Tab is already on its way to the next control, and
   * pulling focus back would trap them in the field they just left.
   */
  | { readonly type: "close"; readonly restoreFocus: boolean };

/** Canonical select keyboard policy. The host only prevents the native event and executes the action. */
export function selectKeyboardAction(input: {
  readonly key: string;
  readonly open: boolean;
  readonly searchFocused: boolean;
  readonly activeKey: string | null;
  readonly createAvailable: boolean;
}): MdySelectKeyboardAction | null {
  const { key, open, searchFocused, activeKey, createAvailable } = input;
  const move: Record<string, MdyOptionNavigationTarget | undefined> = {
    ArrowDown: "next",
    ArrowUp: "previous",
    Home: "first",
    End: "last",
  };
  const target = move[key];
  if (target && (!searchFocused || key === "ArrowDown" || key === "ArrowUp")) {
    // A closed list has nothing to move through. Either arrow on a collapsed combobox opens it —
    // the authoring practices' behaviour, and what a user reaching for the list expects — rather
    // than silently advancing an active option nobody can see.
    //
    // Both directions, matching the declared bindings. Opening does not also move, because opening
    // already places the reading position: the list opens on the option already chosen, or on the
    // first when none is, which is what the authoring practices describe and what the select
    // controller does. An earlier version of this comment said the opposite — that the list opens
    // with nothing active — and it very nearly bought a repair that made `Enter` straight after
    // opening choose nothing.
    if (!open) return key === "ArrowDown" || key === "ArrowUp" ? { type: "open" } : null;
    return { type: "move", target };
  }
  if (key === "Escape" && open) return { type: "close", restoreFocus: true };
  // Tab closes and lets focus go where it was headed. A list left open behind a user who has moved
  // to the next control is a popup floating over a form they are no longer in.
  if (key === "Tab" && open) return { type: "close", restoreFocus: false };
  if (key === "Enter") {
    if (createAvailable) return { type: "create" };
    if (!open) return { type: "open" };
    return activeKey ? { type: "select", optionKey: activeKey } : null;
  }
  if (key === " " && !searchFocused) {
    if (!open) return { type: "open" };
    return activeKey ? { type: "select", optionKey: activeKey } : null;
  }
  return null;
}
