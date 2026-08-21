/**
 * Where focus is in an open timepicker, and what moves it.
 *
 * The picker keeps one piece of state about which of its two numbers is being edited —
 * `focusedField` on the controller — and that state had exactly one expression: which segment was
 * drawn as active. DOM focus was somewhere else entirely, usually on whatever the user had clicked,
 * and no renderer ever put it on a number box. So a person using a keyboard could reach the picker,
 * change nothing, and leave.
 *
 * **One state, two expressions.** Whatever moves the focused field — a pointer on the dial, `Enter`,
 * `Tab`, the hour handing over to the minute — moves DOM focus with it, because the second is derived
 * from the first rather than kept beside it. Two states that can disagree is the shape of half the
 * defects this widget has had.
 */
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import type { MdyTimeFormat } from "@modyra/core/datetime";

/**
 * How long the dial waits before handing the hour over to the minute, in milliseconds.
 *
 * A short delay is deliberate: the face redraws with twelve different numbers on it, and doing that
 * in the same frame as the press takes the number the person just chose off the screen before they
 * have seen it land. Published because it was three numbers — 0 in one renderer, 200 and 300 in
 * another, 300 in the third — which is three answers to a question about how people read.
 */
export const MDY_TIMEPICKER_ADVANCE_MS = 250;

/**
 * The part that carries DOM focus for a field.
 *
 * Named rather than selected: the parts already exist in the catalogue, and a renderer choosing its
 * own selector is a renderer that can disagree with the contract about where focus went.
 */
export function timepickerFocusPart(field: "hour" | "minute"): "hourControl" | "minuteControl" {
  return field === "hour" ? "hourControl" : "minuteControl";
}

/**
 * A CSS selector that reaches exactly one part of an open picker.
 *
 * A part's own class is not always enough to find it: `hourControl` and `minuteControl` carry the
 * *same* class — `mdy-timepicker-segment-input` — because they are the same kind of control twice.
 * Asked by class alone, both resolve to the hour, so a focus command naming the minute box put focus
 * on the hour and a Tab that looked like it did nothing was in fact arriving somewhere.
 *
 * What tells them apart is the parent the anatomy already declares, so the selector is composed from
 * it rather than from a second table: the wrapper's own class, then the control's.
 */
export function timepickerPartSelector(part: string): string | null {
  const contract = MDY_WIDGET_CONTRACTS.timepicker;
  const own = (contract.parts as Readonly<Record<string, { readonly classes: readonly string[] } | undefined>>)[part];
  const name = own?.classes[0];
  if (!name) return null;
  const parent = contract.structure.nodes.find((node) => node.part === part)?.parent;
  const above = parent
    ? (contract.parts as Readonly<Record<string, { readonly classes: readonly string[] } | undefined>>)[parent]
    : undefined;
  // The parent's *last* class, which is the one that distinguishes it — `mdy-timepicker-segment` is
  // shared by both segments and `--hour` is not.
  const scope = above?.classes[above.classes.length - 1];
  return scope ? `.${scope} .${name}` : `.${name}`;
}

/**
 * The controls a `Tab` walks inside an open picker, in order, as part names.
 *
 * Declared rather than left to DOM order, because the three renderers do not build the dialog in the
 * same order — one appends the dimmed layer before the hand and another after it — so "whatever
 * `tabindex` order falls out" is three orders. It is the same divergence this widget keeps closing,
 * one axis further out.
 *
 * The period toggle appears only on a twelve-hour picker, which is the one place the order is not a
 * constant: a 24-hour face has no AM/PM to reach.
 */
export function timepickerTabOrder(format: MdyTimeFormat): readonly string[] {
  const parts = MDY_WIDGET_CONTRACTS.timepicker.parts;
  const order = ["hourControl", "minuteControl"];
  if (format === "12h" && "periodOption" in parts) order.push("periodOption");
  order.push("modeToggle", "action");
  return Object.freeze(order.filter((part) => part in parts));
}

/**
 * The part a `Tab` moves to from `from`, wrapping at both ends.
 *
 * It wraps because the popup is a dialog: a picker whose Tab walked out of it left a confirm button
 * behind and a draft nobody could commit, which is the defect this whole contract exists to end.
 * `Escape` is how a keyboard user leaves, and it still cancels.
 */
export function timepickerTabTarget(
  from: string,
  format: MdyTimeFormat,
  direction: 1 | -1 = 1,
): string {
  const order = timepickerTabOrder(format);
  const at = order.indexOf(from);
  // Somewhere that is not on the ring at all — a press that arrived before focus was placed — starts
  // at the beginning going forward and at the end coming back.
  if (at < 0) return direction > 0 ? order[0]! : order[order.length - 1]!;
  return order[(at + direction + order.length) % order.length]!;
}
