/** A single date: bounds, the value transition, and the draft a modal picker edits. */
import { isDateInRange, parseIsoDate } from "@modyra/core/date-utils";
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
