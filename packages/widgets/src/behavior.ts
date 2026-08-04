import { angleToHour, angleToMinute, buildTimeString, parseTime, type MdyTimeFormat } from "@modyra/core/time-utils";
import type { MdyMultiselectMode } from "@modyra/core";
import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetKind } from "./catalog.js";
import { isDateInRange, parseIsoDate } from "@modyra/core/date-utils";
import { keyBindingFor } from "./transitions.js";
import { acceptTimeField } from "./time-bounds.js";

export type MdyWidgetKeyIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  | { readonly type: "commit" }
  | { readonly type: "cancel"; readonly restoreFocus: boolean }
  | { readonly type: "toggle" }
  | { readonly type: "increment" }
  | { readonly type: "decrement" };

/**
 * How close to the viewport edge a popup may sit. Exported because it is part of the placement
 * arithmetic an adapter or a test has to be able to reproduce: room above an anchor is
 * `anchorTop - MDY_OVERLAY_VIEWPORT_MARGIN`, not `anchorTop`.
 */
export const MDY_OVERLAY_VIEWPORT_MARGIN = 12;

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
  /**
   * How tall the popup wants to be, gap included, when the host has measured it.
   *
   * This is what turns "a side with enough room" into "the side where the content is whole": a
   * calendar with 200px below it and 500px above belongs above, and a policy that only knows
   * `minSpace` puts it below and lets it scroll. Left out when nothing measured the popup, in which
   * case the choice falls back to the minimum-space rule.
   */
  readonly desiredHeight?: number;
  /** How wide the popup wants to be, when measured. Used to pick the edge its content fits from. */
  readonly desiredWidth?: number;
  /**
   * The edge the widget says its popup hangs from, from `capabilities.anchoring`.
   *
   * A widget knows where its trigger is — the arrow, the calendar button, the swatch all sit at the
   * end of the control — and that is the edge a popup should open from, every time. When a widget
   * states it, it wins: the pointer and the anchor's position on the page decide nothing, because a
   * popup that opens from a different corner depending on where you clicked inside the same field is
   * the behaviour this exists to stop. Only the viewport can overrule it, and only when the content
   * would not fit.
   */
  readonly preferredAlignment?: "left" | "right";
}

export interface MdyOverlayDecision {
  readonly placement: "above" | "below" | "overlay";
  readonly alignment: "left" | "right";
  readonly maxHeight: number;
  readonly width: number;
  /**
   * Whether the content fits the space decided for it, so the popup shows whole and does not
   * scroll. `true` when nothing measured the popup: no measurement is not evidence of a squeeze.
   */
  readonly fits: boolean;
}

/** Room between an anchor and the viewport edge on either side, margin already taken off. */
function roomAround(input: MdyOverlayGeometry): { readonly above: number; readonly below: number } {
  return {
    above: Math.max(0, input.anchorTop - MDY_OVERLAY_VIEWPORT_MARGIN),
    below: Math.max(0, input.viewportHeight - input.anchorBottom - MDY_OVERLAY_VIEWPORT_MARGIN),
  };
}

/** Pure framework-independent overlay collision policy. Hosts only measure and apply coordinates. */
export function decideOverlayPlacement(input: MdyOverlayGeometry): MdyOverlayDecision {
  const { above, below } = roomAround(input);
  const desired = input.desiredHeight;
  const other = input.preferred === "below" ? "above" : "below";
  const roomOn = (side: "above" | "below"): number => (side === "above" ? above : below);

  let placement: MdyOverlayDecision["placement"];
  if (desired !== undefined && roomOn(input.preferred) >= desired) {
    // The side asked for holds the whole popup: nothing to weigh up.
    placement = input.preferred;
  } else if (desired !== undefined && roomOn(other) >= desired) {
    // The preferred side would have cut the content; the other side shows it whole.
    placement = other;
  } else if (input.preferred === "below" && below >= input.minSpace) placement = "below";
  else if (input.preferred === "above" && above >= input.minSpace) placement = "above";
  else if (Math.max(above, below) >= input.minSpace) placement = above > below ? "above" : "below";
  else placement = "overlay";

  // When the content is measured and neither side holds it, the roomier side is the one that cuts
  // it least. Without a measurement this cannot be known, so the rule above stands.
  if (desired !== undefined && placement !== "overlay" && roomOn(placement) < desired) {
    placement = above > below ? "above" : "below";
    if (roomOn(placement) < input.minSpace) placement = "overlay";
  }

  const alignment = decideOverlayAlignment(input);
  const modalHeight = Math.round(input.viewportHeight * 0.7);
  const maxHeight = placement === "overlay"
    ? modalHeight
    : Math.max(input.minSpace, roomOn(placement));
  const fits = desired === undefined
    ? true
    : (placement === "overlay" ? modalHeight : roomOn(placement)) >= desired;
  return { placement, alignment, maxHeight, width: Math.max(input.anchorWidth, input.minWidth), fits };
}

/**
 * Which edge of the anchor the popup hangs from.
 *
 * In order: the edge the widget declares, then — for a widget that declares none — the half of the
 * control the pointer landed in, and its position on the page when it was opened from the keyboard.
 * A measured width then overrules all of that when the chosen edge has no room for it: hanging left
 * off a control near the right edge is how a content-sized calendar ends up half off-screen.
 *
 * Note which comparison is *not* here any more: the pointer against the middle of the viewport. It
 * made the edge a popup opened from depend on where its field happened to sit on the page, so the
 * same calendar opened from the left corner on one form and the right corner on another.
 */
export function decideOverlayAlignment(input: MdyOverlayGeometry): MdyOverlayDecision["alignment"] {
  const anchorMiddle = (input.anchorLeft + input.anchorRight) / 2;
  const preferred = input.preferredAlignment
    ?? (input.pointerX !== undefined
      ? (input.pointerX >= anchorMiddle ? "right" : "left")
      : (anchorMiddle > input.viewportWidth / 2 ? "right" : "left"));
  const width = input.desiredWidth;
  if (width === undefined) return preferred;
  const fromLeft = input.viewportWidth - input.anchorLeft - MDY_OVERLAY_VIEWPORT_MARGIN;
  const fromRight = input.anchorRight - MDY_OVERLAY_VIEWPORT_MARGIN;
  const room = preferred === "right" ? fromRight : fromLeft;
  if (room >= width) return preferred;
  const otherRoom = preferred === "right" ? fromLeft : fromRight;
  // Only swap when the other edge is genuinely better; otherwise the coordinates get clamped and
  // swapping would just move the same overflow to the opposite side.
  return otherRoom > room ? (preferred === "right" ? "left" : "right") : preferred;
}

/**
 * Keeps an open overlay's shape steady while its anchor moves.
 *
 * Re-deciding from scratch on every scroll frame is what makes a popup flip sides and change
 * height as the page moves under it. The coordinates must follow the anchor — that is what keeps
 * the popup attached — but the *shape* is a decision taken when it opened: placement, size and
 * alignment only change when the side it was opened on has genuinely stopped fitting.
 *
 * Hosts call this with the decision they are holding and the one they just measured.
 */
export function stabilizeOverlayPlacement(
  previous: MdyOverlayDecision | null,
  next: MdyOverlayDecision,
  input: MdyOverlayGeometry,
): MdyOverlayDecision {
  if (previous === null) return next;
  const { above, below } = roomAround(input);
  const room = previous.placement === "above" ? above : below;
  // The side it opened on no longer holds the popup: re-deciding is the lesser evil.
  if (previous.placement !== "overlay" && room < input.minSpace) return next;
  return {
    placement: previous.placement,
    alignment: previous.alignment,
    maxHeight: previous.maxHeight,
    width: next.width,
    // Reported against the room the anchor has now: the shape is held, but whether the content
    // still shows whole is a fact about this frame, not about the frame it opened in.
    fits: input.desiredHeight === undefined
      ? true
      : (previous.placement === "overlay" ? previous.maxHeight : room) >= input.desiredHeight,
  };
}

/** Canonical keyboard mapping. Framework adapters must not reinterpret these keys. */
export function widgetKeyIntent(kind: MdyWidgetKind, key: string, open: boolean): MdyWidgetKeyIntent | null {
  // Reads the kind's declared bindings rather than answering the same way for all seventeen. It used
  // to special-case `number` and the four togglable kinds and give everything else list navigation,
  // so a text field claimed ArrowDown, a textarea claimed Enter, and a slider — whose arrows must
  // change its value — was told to move through options it does not have.
  const binding = keyBindingFor(kind, key, open);
  if (!binding) return null;
  switch (binding.intent) {
    case "cancel": return { type: "cancel", restoreFocus: binding.restoresFocus ?? true };
    case "open": return { type: "open" };
    case "commit": return { type: "commit" };
    case "toggle": return { type: "toggle" };
    case "step":
      return key === "ArrowUp" ? { type: "increment" } : { type: "decrement" };
    case "move":
      return {
        type: "move",
        target: key === "ArrowDown" ? "next" : key === "ArrowUp" ? "previous" : key === "Home" ? "first" : "last",
      };
  }
}

export function overlayCloseCommands(restoreFocus: boolean): readonly MdyUiCommand[] {
  return restoreFocus
    ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
    : [{ type: "close-overlay" }];
}

export type MdyOptionNavigationTarget = "next" | "previous" | "first" | "last";

/** Resolves roving option navigation without any framework or DOM dependency. */
/**
 * Listbox navigation: clamps at the ends, and ArrowUp from "nothing active" lands on the last
 * option. Distinct from `optionNavigationIndex`, which wraps because a segmented control is a
 * closed ring. Adapters take both from here so a listbox never quietly behaves like a ring.
 */
export { listboxNextIndex as listboxNavigationIndex } from "@modyra/core/keyboard";

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
    // Both directions, matching the declared bindings. Opening does not also move: the list opens
    // with nothing active, and the next arrow lands where the direction says, because
    // `listboxNavigationIndex` answers `ArrowUp` from nothing-active with the last option.
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
  if (key === "Backspace" && query.length === 0) return { type: "search", query: "" };
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
export function dateWithinBounds(
  iso: string,
  minIso: string | null | undefined,
  maxIso: string | null | undefined,
): boolean {
  // Delegates rather than comparing strings of its own. The calendar bounds its cells with
  // `isDateInRange` over parsed dates, and this took the same decision by lexicographic comparison
  // — two spellings of one rule, which is the shape that drifts. The shape check stays here because
  // it is the half a parsed comparison cannot make: `parseIsoDate` is what rejects a malformed one.
  const parsed = parseIsoDate(iso.slice(0, 10));
  if (!parsed) return false;
  return isDateInRange(parsed, parseIsoDate(minIso ?? null), parseIsoDate(maxIso ?? null));
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

export interface MdyDateRangeValue {
  readonly start: string | null;
  readonly end: string | null;
}

/** Canonical range transition: bounds/filter invalid dates and keep end >= start. */
export function dateRangeValueTransition(
  value: MdyDateRangeValue,
  options: {
    readonly minIso?: string | null;
    readonly maxIso?: string | null;
    readonly accepts?: ((iso: string) => boolean) | null;
  } = {},
): MdyDateRangeValue {
  const normalize = (iso: string | null): string | null => {
    if (iso === null) return null;
    const canonical = dateValueTransition(
      { type: "select", iso },
      options.minIso,
      options.maxIso,
    );
    if (canonical === null || options.accepts?.(canonical) === false) return null;
    return canonical;
  };
  const start = normalize(value.start);
  let end = normalize(value.end);
  if (start !== null && end !== null && end < start) end = start;
  return { start, end };
}

export interface MdyDateRangeDraftState {
  readonly committed: MdyDateRangeValue;
  readonly draft: MdyDateRangeValue;
  readonly open: boolean;
}

export type MdyDateRangeDraftIntent =
  | { readonly type: "open"; readonly committed: MdyDateRangeValue }
  | { readonly type: "select"; readonly value: MdyDateRangeValue }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" };

export interface MdyDateRangeDraftTransition {
  readonly state: MdyDateRangeDraftState;
  readonly commit: MdyDateRangeValue | undefined;
  readonly restoreFocus: boolean;
}

/** Modal date-range draft policy. Incomplete drafts close without committing. */
export function dateRangeDraftTransition(
  state: MdyDateRangeDraftState,
  intent: MdyDateRangeDraftIntent,
  options: {
    readonly minIso?: string | null;
    readonly maxIso?: string | null;
    readonly accepts?: ((iso: string) => boolean) | null;
  } = {},
): MdyDateRangeDraftTransition {
  if (intent.type === "open") {
    const committed = dateRangeValueTransition(intent.committed, options);
    return { state: { committed, draft: committed, open: true }, commit: undefined, restoreFocus: false };
  }
  if (intent.type === "select") {
    return { state: { ...state, draft: dateRangeValueTransition(intent.value, options) }, commit: undefined, restoreFocus: false };
  }
  if (intent.type === "confirm") {
    const complete = state.draft.start !== null && state.draft.end !== null;
    const next = complete ? state.draft : state.committed;
    return {
      state: { committed: next, draft: next, open: false },
      commit: complete ? next : undefined,
      restoreFocus: true,
    };
  }
  return {
    state: { committed: state.committed, draft: state.committed, open: false },
    commit: undefined,
    restoreFocus: true,
  };
}

export interface MdyTimeDraftState {
  readonly committed: string | null;
  readonly draft: string;
  readonly open: boolean;
}

export type MdyTimeDraftIntent =
  | { readonly type: "open"; readonly committed: string | null; readonly fallback: string }
  | { readonly type: "select"; readonly value: string }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" };

export interface MdyTimeDraftTransition {
  readonly state: MdyTimeDraftState;
  readonly commit: string | null | undefined;
  readonly restoreFocus: boolean;
}

/** Framework-independent picker draft lifecycle; parsing/format conversion stays at the host boundary. */
export function timeDraftTransition(
  state: MdyTimeDraftState,
  intent: MdyTimeDraftIntent,
): MdyTimeDraftTransition {
  if (intent.type === "open") {
    const draft = intent.committed ?? intent.fallback;
    return { state: { committed: intent.committed, draft, open: true }, commit: undefined, restoreFocus: false };
  }
  if (intent.type === "select") {
    return { state: { ...state, draft: intent.value }, commit: undefined, restoreFocus: false };
  }
  if (intent.type === "confirm") {
    return { state: { committed: state.draft, draft: state.draft, open: false }, commit: state.draft, restoreFocus: true };
  }
  const draft = state.committed ?? state.draft;
  return { state: { committed: state.committed, draft, open: false }, commit: undefined, restoreFocus: true };
}

/** Canonical typed-input transition. Invalid text leaves the committed value untouched. */
export function timeInputTransition(
  raw: string,
  parseAndFormat: (value: string) => string | null,
): string | null | undefined {
  const value = raw.trim().toUpperCase();
  if (value.length === 0) return null;
  return parseAndFormat(value) ?? undefined;
}


export type MdyTimeClockIntent =
  | { readonly type: "hour"; readonly value: number; readonly format: MdyTimeFormat }
  | { readonly type: "minute"; readonly value: number }
  | { readonly type: "period"; readonly value: "AM" | "PM" }
  | { readonly type: "dial"; readonly field: "hour" | "minute"; readonly angle: number };

/** Canonical clock transition. Hosts only extract native input or pointer geometry. */
export function timeClockTransition(
  currentValue: string | null,
  intent: MdyTimeClockIntent,
): string | null {
  const current = parseTime(currentValue) ?? { hour: 12, minute: 0, period: "AM" as const };
  // The ranges come from `timeFieldBounds`, not from literals here. They were stated in three
  // places with the hour's two variants easy to keep straight and the minute's 0–59 easy to lose.
  if (intent.type === "hour") {
    if (!Number.isInteger(intent.value)) return null;
    if (acceptTimeField("hour", intent.format, intent.value).type === "rejected") return null;
    if (intent.format === "24h") {
      const hour = intent.value % 12 === 0 ? 12 : intent.value % 12;
      return buildTimeString(hour, current.minute, intent.value >= 12 ? "PM" : "AM");
    }
    return buildTimeString(intent.value, current.minute, current.period);
  }
  if (intent.type === "minute") {
    if (!Number.isInteger(intent.value)) return null;
    if (acceptTimeField("minute", "24h", intent.value).type === "rejected") return null;
    return buildTimeString(current.hour, intent.value, current.period);
  }
  if (intent.type === "period") return buildTimeString(current.hour, current.minute, intent.value);
  return intent.field === "hour"
    ? buildTimeString(angleToHour(intent.angle), current.minute, current.period)
    : buildTimeString(current.hour, angleToMinute(intent.angle), current.period);
}

export type MdyColorValueIntent =
  | { readonly type: "native"; readonly value: string }
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "preset"; readonly value: string };

export interface MdyColorValueTransition {
  readonly value: string | undefined;
  readonly close: boolean;
  readonly touched: boolean;
}

/** Canonical HEX transition. Invalid partial text preserves the committed value. */
export function colorValueTransition(intent: MdyColorValueIntent): MdyColorValueTransition {
  const raw = intent.value.trim();
  const candidate = raw.startsWith("#") ? raw : `#${raw}`;
  const valid = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(candidate);
  return {
    value: valid ? candidate : undefined,
    close: intent.type === "preset" && valid,
    touched: intent.type === "preset" && valid,
  };
}

/** Case-insensitive comparison for equivalent HEX spellings. */
export function colorValueEquals(left: string | null, right: string): boolean {
  return (left ?? "").toLowerCase() === right.toLowerCase();
}

export interface MdyFileCandidate {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface MdyFileSelectionOptions {
  readonly accept?: string;
  readonly multiple: boolean;
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
}

export interface MdyFileSelectionTransition<TFile extends MdyFileCandidate> {
  readonly value: TFile | readonly TFile[] | null | undefined;
  readonly accepted: readonly TFile[];
  readonly rejected: readonly TFile[];
  readonly touched: boolean;
}

/** Shared picker/drop policy. `undefined` means no accepted candidate and preserves the committed value. */
export function fileSelectionTransition<TFile extends MdyFileCandidate>(
  candidates: readonly TFile[],
  options: MdyFileSelectionOptions,
): MdyFileSelectionTransition<TFile> {
  if (candidates.length === 0) {
    return { value: undefined, accepted: [], rejected: [], touched: false };
  }
  const tokens = (options.accept ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const matchesAccept = (file: TFile): boolean => tokens.length === 0 || tokens.some((token) => {
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    if (token.endsWith("/*")) return file.type.toLowerCase().startsWith(token.slice(0, -1));
    return file.type.toLowerCase() === token;
  });
  const maxSize = options.maxFileSize ?? 0;
  let accepted = candidates.filter((file) => matchesAccept(file) && (maxSize <= 0 || file.size <= maxSize));
  const rejected = candidates.filter((file) => !accepted.includes(file));
  const maxFiles = options.maxFiles ?? 0;
  if (options.multiple && maxFiles > 0 && accepted.length > maxFiles) {
    rejected.push(...accepted.slice(maxFiles));
    accepted = accepted.slice(0, maxFiles);
  }
  if (!options.multiple && accepted.length > 1) {
    rejected.push(...accepted.slice(1));
    accepted = accepted.slice(0, 1);
  }
  return {
    value: accepted.length === 0 ? undefined : options.multiple ? accepted : accepted[0]!,
    accepted,
    rejected,
    touched: accepted.length > 0,
  };
}

export function clearFileSelection<TFile extends MdyFileCandidate>(): MdyFileSelectionTransition<TFile> {
  return { value: null, accepted: [], rejected: [], touched: false };
}

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
