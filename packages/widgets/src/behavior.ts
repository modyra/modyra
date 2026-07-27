import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetKind } from "./catalog.js";

export type MdyWidgetKeyIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  | { readonly type: "commit" }
  | { readonly type: "cancel"; readonly restoreFocus: boolean }
  | { readonly type: "toggle" }
  | { readonly type: "increment" }
  | { readonly type: "decrement" };

export interface MdyOverlayGeometry {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly anchorTop: number;
  readonly anchorBottom: number;
  readonly anchorLeft: number;
  readonly anchorRight: number;
  readonly anchorWidth: number;
  readonly minSpace: number;
  readonly minWidth: number;
  readonly preferred: "above" | "below";
  readonly pointerX?: number;
}

export interface MdyOverlayDecision {
  readonly placement: "above" | "below" | "overlay";
  readonly alignment: "left" | "right";
  readonly maxHeight: number;
  readonly width: number;
}

/** Pure framework-independent overlay collision policy. Hosts only measure and apply coordinates. */
export function decideOverlayPlacement(input: MdyOverlayGeometry): MdyOverlayDecision {
  const below = Math.max(0, input.viewportHeight - input.anchorBottom - 12);
  const above = Math.max(0, input.anchorTop - 12);
  let placement: MdyOverlayDecision["placement"];
  if (input.preferred === "below" && below >= input.minSpace) placement = "below";
  else if (input.preferred === "above" && above >= input.minSpace) placement = "above";
  else if (Math.max(above, below) >= input.minSpace) placement = above > below ? "above" : "below";
  else placement = "overlay";
  const pointer = input.pointerX ?? (input.anchorLeft + input.anchorRight) / 2;
  const alignment = pointer > input.viewportWidth / 2 ? "right" : "left";
  const maxHeight = placement === "overlay" ? Math.round(input.viewportHeight * 0.7) : Math.max(input.minSpace, placement === "above" ? above : below);
  return { placement, alignment, maxHeight, width: Math.max(input.anchorWidth, input.minWidth) };
}

/** Canonical keyboard mapping. Framework adapters must not reinterpret these keys. */
export function widgetKeyIntent(kind: MdyWidgetKind, key: string, open: boolean): MdyWidgetKeyIntent | null {
  if (key === "Escape" && open) return { type: "cancel", restoreFocus: true };
  if (key === "ArrowDown") return kind === "number" ? { type: "decrement" } : { type: "move", target: "next" };
  if (key === "ArrowUp") return kind === "number" ? { type: "increment" } : { type: "move", target: "previous" };
  if (key === "Home") return { type: "move", target: "first" };
  if (key === "End") return { type: "move", target: "last" };
  if (key === "Enter") return open ? { type: "commit" } : { type: "open" };
  if (key === " " && ["checkbox", "toggle", "radio", "segmented"].includes(kind)) return { type: "toggle" };
  return null;
}

export function overlayCloseCommands(restoreFocus: boolean): readonly MdyUiCommand[] {
  return restoreFocus
    ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
    : [{ type: "close-overlay" }];
}

export type MdyOptionNavigationTarget = "next" | "previous" | "first" | "last";

/** Resolves roving option navigation without any framework or DOM dependency. */
export function optionNavigationIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
): number | null {
  if (optionCount <= 0) return null;
  const current = Math.max(0, Math.min(currentIndex, optionCount - 1));
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % optionCount;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + optionCount) % optionCount;
    case "Home":
      return 0;
    case "End":
      return optionCount - 1;
    default:
      return null;
  }
}

export type MdySelectKeyboardAction =
  | { readonly type: "move"; readonly target: MdyOptionNavigationTarget }
  | { readonly type: "open" }
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "create" }
  | { readonly type: "close"; readonly restoreFocus: true };

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
    return { type: "move", target };
  }
  if (key === "Escape" && open) return { type: "close", restoreFocus: true };
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
  readonly query: string;
  readonly activeKey: string | null;
}): MdyMultiselectOverlayAction | null {
  const { key, open, query, activeKey } = input;
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
  if (target) return { type: "move", target };
  if (key === "Backspace" && query.length === 0) return { type: "search", query: "" };
  return null;
}

/** Single-mode closes only when no unselected result remains after the commit. */
export function shouldCloseMultiselectOverlay(
  mode: "single" | "multi",
  remainingResultCount: number,
): boolean {
  return mode === "single" && remainingResultCount === 0;
}

/** ISO date bound policy shared by typed input, calendar selection and future hosts. */
export function dateWithinBounds(
  iso: string,
  minIso: string | null | undefined,
  maxIso: string | null | undefined,
): boolean {
  const normalized = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  if (minIso && normalized < minIso.slice(0, 10)) return false;
  if (maxIso && normalized > maxIso.slice(0, 10)) return false;
  return true;
}

export type MdyDateValueIntent =
  | { readonly type: "select"; readonly iso: string }
  | { readonly type: "clear" };

/** Returns the canonical value transition, or null when a selection is rejected by bounds. */
export function dateValueTransition(
  intent: MdyDateValueIntent,
  minIso?: string | null,
  maxIso?: string | null,
): string | null {
  if (intent.type === "clear") return null;
  const iso = intent.iso.slice(0, 10);
  return dateWithinBounds(iso, minIso, maxIso) ? iso : null;
}

export interface MdyDateDraftState {
  readonly committed: string | null;
  readonly draft: string | null;
  readonly open: boolean;
}

export type MdyDateDraftIntent =
  | { readonly type: "open"; readonly committed: string | null }
  | { readonly type: "select"; readonly iso: string }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" };

export interface MdyDateDraftTransition {
  readonly state: MdyDateDraftState;
  readonly commit: string | null | undefined;
  readonly restoreFocus: boolean;
}

/** Modal date draft policy. Selection stays provisional until confirm; cancel discards it. */
export function dateDraftTransition(
  state: MdyDateDraftState,
  intent: MdyDateDraftIntent,
  minIso?: string | null,
  maxIso?: string | null,
): MdyDateDraftTransition {
  if (intent.type === "open") {
    return {
      state: { committed: intent.committed, draft: intent.committed, open: true },
      commit: undefined,
      restoreFocus: false,
    };
  }
  if (intent.type === "select") {
    const draft = dateValueTransition({ type: "select", iso: intent.iso }, minIso, maxIso);
    return {
      state: draft === null ? state : { ...state, draft },
      commit: undefined,
      restoreFocus: false,
    };
  }
  if (intent.type === "confirm") {
    return {
      state: { committed: state.draft, draft: state.draft, open: false },
      commit: state.draft,
      restoreFocus: true,
    };
  }
  return {
    state: { committed: state.committed, draft: state.committed, open: false },
    commit: undefined,
    restoreFocus: true,
  };
}
