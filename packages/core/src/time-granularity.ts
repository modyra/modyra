/**
 * Which times a picker offers, when it does not offer all of them.
 *
 * A booking form takes appointments every fifteen minutes; a shift planner takes them every five
 * before noon and every thirty after. The times in between are not *invalid* in any general sense —
 * they are simply not on offer here, which is a property of this field rather than of time.
 *
 * The shape is data and not a callback, deliberately: a granularity has to survive being written in
 * a JSON document, sent from a server and read back, and a predicate cannot. What it costs is that
 * an arbitrary rule — "every 7 minutes, but not on Tuesdays" — cannot be expressed at all.
 *
 * Two rules decide what a declaration means:
 *
 * - **A window's step overrides the field's**, rather than composing with it. Composition has no
 *   answer when 5 and 15 disagree, and the narrower rule winning is what a reader expects.
 * - **A window runs from `from` inclusive to `to` exclusive.** Adjacent windows then tile with
 *   neither a gap between them nor an overlap to refuse, and nobody writes `to: "11:59"`.
 *
 * What this never does is round. A value that is already off the step — chosen before the rule
 * changed, or sent by a server that does not share it — is kept and shown as it is, and reported
 * invalid. Snapping it would silently answer a different question from the one that was asked.
 */

export type { MdyTimeGranularity, MdyTimeWindow } from "./dynamic/schema.js";
import type { MdyTimeGranularity } from "./dynamic/schema.js";

/** The steps in force. Always concrete: 1 is "every one", which is what no declaration means. */
export interface MdyTimeSteps {
  readonly hourStep: number;
  readonly minuteStep: number;
}

/** Every time is on offer. */
export const MDY_EVERY_TIME: MdyTimeSteps = { hourStep: 1, minuteStep: 1 };

/** Minutes since midnight, or `null` when the text is not an `HH:MM` this can read. */
export function minutesOfDay(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * The steps in force at a given hour.
 *
 * The hour is enough to place a window because a window's boundaries are minutes and its step
 * applies to the whole hour it covers — a window that began mid-hour would offer one set of minutes
 * before the boundary and another after, inside a single dial the user is looking at.
 *
 * The **first** matching window wins. Overlaps are refused where a granularity is declared, so at
 * that point there is at most one; taking the first keeps this total for a granularity that was
 * never validated, rather than making the answer depend on declaration order in a way a caller
 * would have to know about.
 */
export function timeStepsAt(
  granularity: MdyTimeGranularity | undefined,
  hour24: number,
): MdyTimeSteps {
  if (!granularity) return MDY_EVERY_TIME;
  const hourStep = granularity.hourStep ?? 1;
  const minuteStep = granularity.minuteStep ?? 1;
  if (!Number.isFinite(hour24)) return { hourStep, minuteStep };

  const start = Math.trunc(hour24) * 60;
  for (const window of granularity.windows ?? []) {
    const from = minutesOfDay(window.from);
    const to = minutesOfDay(window.to);
    if (from === null || to === null) continue;
    // The hour is inside when any of it is: `from` inclusive, `to` exclusive, so a window ending at
    // 12:00 does not claim noon.
    if (start + 59 >= from && start < to) return { hourStep, minuteStep: window.minuteStep };
  }
  return { hourStep, minuteStep };
}

/** Whether a value sits on the step. Step 1 accepts everything, which is what it means. */
export function isOnStep(value: number, step: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (!Number.isFinite(step) || step <= 1) return true;
  return value % step === 0;
}

/** Every value a unit offers under `step`, from 0 up. */
export function stepValues(size: number, step: number): readonly number[] {
  const by = Number.isFinite(step) && step >= 1 ? Math.trunc(step) : 1;
  const values: number[] = [];
  for (let value = 0; value < size; value += by) values.push(value);
  return values;
}

/** Why a declared granularity was refused. Each names the member at fault. */
export type MdyGranularityProblem =
  | { readonly member: "minuteStep" | "hourStep"; readonly reason: "must-divide"; readonly unit: number; readonly value: number }
  | { readonly member: "windows"; readonly reason: "unreadable-time"; readonly index: number; readonly value: string }
  | { readonly member: "windows"; readonly reason: "empty-range"; readonly index: number }
  | { readonly member: "windows"; readonly reason: "must-divide"; readonly index: number; readonly unit: number; readonly value: number }
  | { readonly member: "windows"; readonly reason: "overlap"; readonly index: number; readonly other: number };

/**
 * Everything wrong with a declaration, rather than the first thing.
 *
 * A step that does not divide its unit is the defect this exists for: `minuteStep: 7` offers 0, 7,
 * 14 … 56 and then jumps four minutes to the next hour, so the rule the author thought they wrote —
 * "every seven minutes" — is not the one the field would enforce. Refusing by name is the difference
 * between a document that fails where it is written and a picker that behaves oddly at 56 past.
 */
export function validateTimeGranularity(granularity: MdyTimeGranularity): readonly MdyGranularityProblem[] {
  const problems: MdyGranularityProblem[] = [];
  const divides = (value: number, unit: number): boolean =>
    Number.isInteger(value) && value >= 1 && value <= unit && unit % value === 0;

  if (granularity.minuteStep !== undefined && !divides(granularity.minuteStep, 60)) {
    problems.push({ member: "minuteStep", reason: "must-divide", unit: 60, value: granularity.minuteStep });
  }
  if (granularity.hourStep !== undefined && !divides(granularity.hourStep, 24)) {
    problems.push({ member: "hourStep", reason: "must-divide", unit: 24, value: granularity.hourStep });
  }

  const spans: Array<{ from: number; to: number; index: number }> = [];
  (granularity.windows ?? []).forEach((window, index) => {
    const from = minutesOfDay(window.from);
    const to = minutesOfDay(window.to);
    for (const [text, minutes] of [[window.from, from], [window.to, to]] as const) {
      if (minutes === null) problems.push({ member: "windows", reason: "unreadable-time", index, value: text });
    }
    if (!divides(window.minuteStep, 60)) {
      problems.push({ member: "windows", reason: "must-divide", index, unit: 60, value: window.minuteStep });
    }
    if (from === null || to === null) return;
    // Half-open, so `from === to` covers nothing at all — a declaration that says something and
    // means nothing, which is worth refusing rather than silently ignoring.
    if (to <= from) { problems.push({ member: "windows", reason: "empty-range", index }); return; }
    for (const earlier of spans) {
      if (from < earlier.to && earlier.from < to) {
        problems.push({ member: "windows", reason: "overlap", index, other: earlier.index });
      }
    }
    spans.push({ from, to, index });
  });

  return problems;
}

/** A refusal in a sentence, for a diagnostic a person reads. */
export function explainGranularityProblem(problem: MdyGranularityProblem): string {
  switch (problem.reason) {
    case "must-divide":
      return problem.member === "windows"
        ? `windows[${problem.index}].minuteStep is ${problem.value}, which does not divide ${problem.unit}`
        : `${problem.member} is ${problem.value}, which does not divide ${problem.unit}`;
    case "unreadable-time":
      return `windows[${problem.index}] names "${problem.value}", which is not an HH:MM time of day`;
    case "empty-range":
      return `windows[${problem.index}] ends at or before it starts, so it covers no time at all`;
    case "overlap":
      return `windows[${problem.index}] overlaps windows[${problem.other}], so two steps claim the same minutes`;
  }
}
