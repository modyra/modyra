/**
 * The chip.
 *
 * A chip is one primitive with variants, not one shape per place it appears: an option you can
 * take, a counter you can step, a value already taken. The foundation styles exactly that —
 * `.mdy-chip` carries the box, the variants carry the difference.
 *
 * Naming it here is what lets the variants stay derived. A renderer that wrote `"mdy-chip--counter"`
 * as a string is a renderer deciding what a counter chip is, and the next one spells it differently
 * or forgets the selected modifier — at which point the theme's `.mdy-chip--selected` rule quietly
 * styles nothing. {@link multiselectChipClasses} answers "what classes does this chip carry" once,
 * from the widget's mode and the option's state, and every renderer applies the answer.
 */

import type { MdyMultiselectMode } from "@modyra/core";

import { stateClass } from "./state.js";

/** Canonical class vocabulary for the chip primitive. */
export const MDY_CHIP_CLASSES = Object.freeze({
  /** The chip itself. Every chip carries this, whatever it is for. */
  block: "mdy-chip",
  /** An option in single-select mode: it reserves the room its tick will need. */
  centered: "mdy-chip--centered",
  /** An option that can be taken several times: a label between two step buttons. */
  counter: "mdy-chip--counter",
  /** A value already taken, shown on the control rather than offered in the list. */
  value: "mdy-chip--value",
  /** Taken. The state a theme paints; it applies in either mode. */
  selected: "mdy-chip--selected",
  /** Carries a control for taking the value off again, which changes the room the label has. */
  removable: "mdy-chip--removable",
  /** The tick. Drawn by the theme when a renderer supplies no icon of its own. */
  check: "mdy-chip__check",
  /** The chip's text. */
  label: "mdy-chip__label",
  /** How many times this option has been taken, in counter mode. */
  count: "mdy-chip__count",
  /** A step button — one down, one up. */
  step: "mdy-chip__btn",
  /** The control that takes a chosen value off, on the chip standing for it. */
  remove: "mdy-chip__remove",
  /** Wraps a chip a renderer did not draw itself, so a custom option still sits in the grid. */
  wrapper: "mdy-chip-wrapper",
});

export type MdyChipPart = keyof typeof MDY_CHIP_CLASSES;

/**
 * How a multiselect treats its options: taken or not, or taken a number of times.
 *
 * The mode is a field of the Dynamic Form Contract, so the name that owns it lives in `@modyra/core`
 * and everything else refers to it. A chip's appearance follows the value a document carries; a
 * second declaration of the same two strings is a place for the two to disagree.
 */
export type MdyChipMode = MdyMultiselectMode;

/** Where a chip appears: offered among the options, or standing for a value already taken. */
export type MdyChipRole = "option" | "value";

export interface MdyChipAppearance {
  readonly mode?: MdyChipMode;
  readonly role?: MdyChipRole;
  readonly selected?: boolean;
  /** Carries a dismiss affordance. A value chip you can take back off the control. */
  readonly removable?: boolean;
}

/**
 * The classes a chip carries, in order: the primitive, then its variant, then its state.
 *
 * The variant follows the mode, because that is what the difference *is*: an option that can be
 * taken once shows a tick and reserves room for it (`centered`), one that can be taken repeatedly
 * shows a count between two steppers (`counter`). Selection is a state on top of either, never a
 * variant of its own — a theme that styled "selected" twice, once per mode, would drift.
 */
export function multiselectChipClasses(appearance: MdyChipAppearance = {}): readonly string[] {
  const { mode = "single", role = "option", selected = false, removable = false } = appearance;
  const classes: string[] = [MDY_CHIP_CLASSES.block];
  if (role === "value") classes.push(MDY_CHIP_CLASSES.value);
  else classes.push(mode === "multi" ? MDY_CHIP_CLASSES.counter : MDY_CHIP_CLASSES.centered);
  // Both are states of the chip, spelled by the shared state vocabulary rather than by this
  // function: `--selected` means the same thing on a chip as it does on an option or a calendar
  // cell, and two places deciding how to spell it is how the two drift apart.
  if (selected) classes.push(stateClass(MDY_CHIP_CLASSES.block, "selected"));
  if (removable) classes.push(stateClass(MDY_CHIP_CLASSES.block, "removable"));
  return Object.freeze(classes);
}

/**
 * Where focus goes when a chip is taken off, named as the chip it should land on.
 *
 * `null` means the strip has nothing left and focus belongs on the control itself.
 *
 * The next chip, or the previous one when the last was removed. Stated rather than left to the
 * browser, because the browser's answer is *whatever now occupies that position in the DOM* — which
 * is the next chip while one exists and nothing at all at the end of the strip, so removing from the
 * middle looked deliberate and removing the last dropped focus to the document. Somebody clearing a
 * strip from the right loses their place on the first press.
 */
export function chipFocusAfterRemoval(
  order: readonly string[],
  removed: string,
  /**
   * Which way the removal was going.
   *
   * `"backward"` — `Backspace` — lands on the chip *before* the one removed, `"forward"` —
   * `Delete` — on the one after. That is what every text field on every platform does, and a strip
   * of chips is close enough to a line of text that a person brings the expectation with them.
   * Absent is forward, which is what a pointer on the chip's own remove control means: there was no
   * direction in the gesture.
   */
  direction: "forward" | "backward" = "forward",
): string | null {
  const at = order.indexOf(removed);
  if (at === -1) return null;
  const left = order.filter((key) => key !== removed);
  if (left.length === 0) return null;
  const wanted = direction === "backward" ? at - 1 : at;
  return left[Math.max(0, Math.min(wanted, left.length - 1))] ?? null;
}

/**
 * What a live region says when a selection changes: the change, and the new total.
 *
 * **The delta, never the list.** A polite region queues rather than replaces, so a full selection
 * announced on every click builds a backlog of stale lists and the person hears a selection several
 * actions out of date. At any size, not only at twelve. The list itself is an on-demand fact and
 * belongs in the field's description, where a reader can ask for it.
 *
 * Empty while the popup is open: the options there carry `aria-selected` and announce natively, so
 * a region firing at the same time makes every toggle speak twice. The row's own removals are the
 * case nothing else speaks for.
 */
export function multiselectAnnouncement(
  previous: readonly string[],
  next: readonly string[],
  words: { readonly added: string; readonly removed: string; readonly empty: string },
  labelOf: (key: string) => string,
  open = false,
): string {
  if (open) return "";
  const before = new Set(previous);
  const after = new Set(next);
  const added = next.find((key) => !before.has(key));
  const removed = previous.find((key) => !after.has(key));
  if (added === undefined && removed === undefined) return "";
  if (after.size === 0) return words.empty;
  const template = added !== undefined ? words.added : words.removed;
  return template
    .replace("{value}", labelOf((added ?? removed)!))
    .replace("{count}", String(after.size));
}
