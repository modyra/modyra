import { dateValueTransition } from "./date.js";
/** Two dates that have to stay in order, and the draft that is not a range until both are known. */
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
