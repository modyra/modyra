/** Open, close, and what a toggle does when the thing it would open has nothing to show. */
export interface MdyOverlayLifecycleState {
  readonly open: boolean;
}

export type MdyOverlayLifecycleIntent =
  | { readonly type: "toggle"; readonly disabled: boolean; readonly available: boolean }
  | { readonly type: "open"; readonly disabled: boolean; readonly available: boolean }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "escape" }
  | { readonly type: "outside"; readonly outside: boolean }
  | { readonly type: "destroy" };

export interface MdyOverlayLifecycleTransition {
  readonly state: MdyOverlayLifecycleState;
  readonly effect: "none" | "setup" | "teardown";
  readonly restoreFocus: boolean;
  readonly announce: "opened" | "closed" | null;
}

/**
 * Framework-independent overlay lifecycle. Hosts install/remove concrete DOM
 * listeners and execute focus restoration, but do not decide when to close.
 */
export function overlayLifecycleTransition(
  state: MdyOverlayLifecycleState,
  intent: MdyOverlayLifecycleIntent,
): MdyOverlayLifecycleTransition {
  const unchanged = (): MdyOverlayLifecycleTransition => ({
    state,
    effect: "none",
    restoreFocus: false,
    announce: null,
  });
  if (intent.type === "destroy") {
    return state.open
      ? { state: { open: false }, effect: "teardown", restoreFocus: false, announce: null }
      : unchanged();
  }
  if (intent.type === "toggle") {
    if (intent.disabled || !intent.available) return unchanged();
    return state.open
      ? { state: { open: false }, effect: "teardown", restoreFocus: false, announce: "closed" }
      : { state: { open: true }, effect: "setup", restoreFocus: false, announce: "opened" };
  }
  if (intent.type === "open") {
    if (state.open || intent.disabled || !intent.available) return unchanged();
    return { state: { open: true }, effect: "setup", restoreFocus: false, announce: "opened" };
  }
  const shouldClose = state.open && (
    intent.type === "close" ||
    intent.type === "escape" ||
    (intent.type === "outside" && intent.outside)
  );
  if (!shouldClose) return unchanged();
  return {
    state: { open: false },
    effect: "teardown",
    restoreFocus: intent.type === "escape" || (intent.type === "close" && intent.restoreFocus === true),
    announce: "closed",
  };
}
