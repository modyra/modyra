/** A time, typed or turned: the draft the dial edits and what an angle becomes. */
import { MdyTimeFormat, angleToHour, angleToMinute, buildTimeString, parseTime } from "@modyra/core/datetime";
import { acceptTimeField } from "../time-bounds.js";
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
