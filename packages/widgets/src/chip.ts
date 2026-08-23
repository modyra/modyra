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
  /**
   * The controls that move a chosen value one place, on the chip standing for it.
   *
   * A pointer path that is **not** a drag. WCAG 2.5.7 asks for one independently of any keyboard
   * path: somebody using a pointer who cannot hold and drag — a tremor, a head pointer, a switch —
   * has no way to reorder otherwise, and a keyboard alternative does not discharge it. Drawn only
   * where the field asked to be reorderable, so a set of filters gains no furniture.
   */
  move: "mdy-chip__move",
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
 * What the button that takes a chip off is called.
 *
 * The verb alone — "Remove", "Rimuovi" — names the action and not its object, so a strip of eight
 * chips offers eight controls with one name between them. Someone reading the page one control at a
 * time hears "Remove" and has to leave it, find the chip beside it, and come back to know what they
 * would be removing; someone listing the controls hears the same word eight times.
 *
 * The words stay with the renderer, which is where the language lives. The rule that the object
 * belongs in the name lives here, so all of them compose it the same way.
 */
export function chipRemoveName(verb: string, label: string): string {
  const object = label.trim();
  return object === "" ? verb : `${verb} ${object}`;
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
/**
 * What the one way back says it is putting back.
 *
 * "Undo" alone is ambiguous once a single reversal covers three acts, so the affordance names the
 * act. A clear has no value to name and says how many it took; a removal and a move name the value,
 * because that is what the person is deciding whether they meant to lose.
 */
export function wayBackSentence(
  way: { readonly act: "remove" | "move" | "clear"; readonly optionKey: string | null; readonly count: number },
  templates: { readonly removed: string; readonly moved: string; readonly cleared: string },
  labelOf: (key: string) => string,
): string {
  if (way.act === "clear") return templates.cleared.replace("{count}", String(way.count));
  const label = way.optionKey === null ? "" : labelOf(way.optionKey);
  return (way.act === "move" ? templates.moved : templates.removed).replace("{value}", label);
}

/**
 * What a live region says when a choice lands: the change, and the new total.
 *
 * The **change**, not the list — a polite region queues rather than replaces, so announcing the whole
 * selection builds a backlog of stale lists and a person hears a selection several acts out of date.
 *
 * Said whether or not the popup is open. It used to be suppressed while open, on the reasoning that
 * the options there announce themselves and a region firing too would speak twice — which holds only
 * for somebody choosing with the keyboard, where focus is on the option. A choice made with a pointer
 * moves no focus and announces nothing at all, so the suppression was silence for exactly the person
 * with no other confirmation. The count is not in the native announcement either way.
 */
export function multiselectAnnouncement(
  previous: readonly string[],
  next: readonly string[],
  words: { readonly added: string; readonly removed: string; readonly empty: string },
  labelOf: (key: string) => string,
): string {
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

/**
 * What a live region says when a quantity settles.
 *
 * A quantity that changes says nothing today: the sentence a selection change produces compares the
 * *distinct values* held, and stepping three of something down to two changes none of them. So the
 * only step that spoke was the one that removed the value — a person stepping down heard nothing
 * until what they were counting was gone.
 *
 * **Said on arriving at the smallest quantity, not on leaving it.** Warning at the moment of deletion
 * is too late: the value is already gone and the person is being told rather than asked. Said on
 * arrival, the next step down is a known act.
 */
export function quantityAnnouncement(
  label: string,
  count: number,
  words: { readonly settled: string; readonly atMinimum: string },
  minimum = 1,
): string {
  const template = count <= minimum ? words.atMinimum : words.settled;
  return template.replace("{value}", label).replace("{count}", String(count));
}

/**
 * A voice that says the value a gesture ended on, rather than every value it passed through.
 *
 * A live region is a queue, and a held arrow key fills it: eleven presses from twelve to one leave
 * eleven polite sentences to be read out after the person has stopped pressing, each describing a
 * state several steps in the past. A `spinbutton` does not have this problem because the platform
 * reads a *value* and coalesces rapid changes itself — so a control that gives up the role takes on
 * the coalescing, which is what this is.
 *
 * `schedule` is injected so a test can settle the voice without waiting: the default is the clock.
 */
export function settledVoice(
  say: (sentence: string) => void,
  options: {
    readonly delayMs?: number;
    readonly schedule?: (run: () => void, ms: number) => unknown;
    readonly cancel?: (handle: unknown) => void;
  } = {},
): { announce: (sentence: string) => void; stop: () => void } {
  const delayMs = options.delayMs ?? 300;
  const schedule = options.schedule ?? ((run, ms) => setTimeout(run, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let pending: unknown = null;
  return {
    announce(sentence) {
      if (pending !== null) cancel(pending);
      pending = schedule(() => { pending = null; say(sentence); }, delayMs);
    },
    stop() {
      if (pending !== null) cancel(pending);
      pending = null;
    },
  };
}

/**
 * What a live region says when a chosen value is moved.
 *
 * The `Alt`-plus-arrow way of reordering has no *grabbed* state — nothing is picked up and nothing
 * is put down — so the movement itself is the only thing there is to announce. Unannounced, a
 * reorder is invisible to somebody who cannot see the strip: the value changed and the control said
 * nothing about it.
 */
export function chipMovedAnnouncement(
  template: string,
  label: string,
  position: number,
  count: number,
): string {
  return template
    .replace("{value}", label)
    .replace("{position}", String(position))
    .replace("{count}", String(count));
}

/**
 * Where a dragged chip would land, from where the pointer is.
 *
 * Takes the horizontal midpoints of the chips as they are drawn, in order, and answers the index the
 * dragged one would occupy on release. Shared rather than written per renderer for the same reason
 * the dial's angle arithmetic is: three implementations of "which one is the pointer over" is three
 * answers, and the one a person sees is whichever renderer they happen to be using.
 *
 * Reads midpoints rather than edges so the drop follows what the eye does — a chip is "passed" when
 * the pointer is more than halfway across it, not when it clears the far edge.
 *
 * Direction-agnostic: the midpoints arrive in drawing order, so a right-to-left strip answers with
 * the same arithmetic and no renderer has to know which way its own text runs.
 */
export function chipDropIndex(
  midpoints: readonly number[],
  clientX: number,
  from: number,
): number {
  if (midpoints.length === 0) return from;
  const ascending = (midpoints[midpoints.length - 1] ?? 0) >= (midpoints[0] ?? 0);
  let landed = 0;
  for (const midpoint of midpoints) {
    if (ascending ? clientX > midpoint : clientX < midpoint) landed += 1;
  }
  // A chip dragged rightwards passes its own midpoint on the way, which would count it as one place
  // further than the eye reads. Its own slot is not a place it can land on.
  if (landed > from) landed -= 1;
  return Math.max(0, Math.min(midpoints.length - 1, landed));
}

/**
 * How far a wheel turn should move a horizontal strip.
 *
 * ADR 0127 lets the chip row scroll on the condition that there is a **mechanism**, not only a cue,
 * for reaching what has scrolled out — and many desktop mice have no horizontal axis at all, so a
 * strip that only answers `deltaX` is a strip a large number of people cannot move. The larger of
 * the two deltas is taken, so a vertical wheel drives it and a trackpad's horizontal gesture still
 * behaves as its owner expects.
 *
 * Answers `0` when the strip has nothing hidden, so the page keeps its own scrolling: a wheel
 * swallowed by a row that had nowhere to go is a page that will not move.
 */
/**
 * A wheel reaches what has scrolled out of a chip strip.
 *
 * ADR 0127 allows the row to scroll only where a mechanism reaches what leaves the viewport, and
 * many desktop mice have no horizontal axis at all — so a vertical wheel over the strip has to move
 * it sideways. The event is cancelled only when the strip actually has something hidden, or the
 * gesture stops scrolling the page for no result.
 */
export function scrollChipStripByWheel(event: WheelEvent): void {
  const strip = event.currentTarget as HTMLElement;
  const delta = chipStripWheelDelta(event.deltaX, event.deltaY, strip.scrollWidth, strip.clientWidth);
  if (delta === 0) return;
  event.preventDefault();
  strip.scrollLeft += delta;
}

/**
 * Where a chip's tooltip sits, in the control's own coordinates.
 *
 * Above the strip rather than inside it: the strip clips its overflow, which is the whole reason the
 * name needed revealing. The chip's offset is taken against the strip it scrolls in, so a chip
 * scrolled halfway out is named where it is drawn and not where it began.
 */
export function chipTooltipOffset(chip: HTMLElement, strip: HTMLElement): number {
  return chip.offsetLeft - strip.scrollLeft + strip.offsetLeft;
}

/**
 * How many chips the strip is not showing.
 *
 * A chip counts as hidden when it is not wholly inside the strip's own box — clipped at either edge,
 * because the row scrolls both ways and a chip half off the leading edge is as unreadable as one off
 * the trailing edge. `0` when nothing overflows, which is the case a control must not draw an
 * affordance for.
 *
 * Measured rather than derived from the count: how many fit depends on the labels, the theme's
 * spacing and the width the host gave the field, and a renderer guessing at it would be wrong on the
 * first long name.
 */
export function hiddenChipCount(strip: HTMLElement): number {
  if (strip.scrollWidth <= strip.clientWidth) return 0;
  const box = strip.getBoundingClientRect();
  let hidden = 0;
  for (const chip of Array.from(strip.children)) {
    const at = chip.getBoundingClientRect();
    if (at.left < box.left - 1 || at.right > box.right + 1) hidden += 1;
  }
  return hidden;
}

/**
 * Brings the chip that has focus back into the strip, after something changed the strip's width.
 *
 * The browser scrolls a focused element into view once, at the moment focus lands. An affordance
 * that appears on the same beat — the count of what is hidden, a clear-all — takes its width out of
 * the scrollport *afterwards*, and the chip the browser had just brought in is outside again by
 * about the width of the control that appeared. Nothing scrolls a second time on its own.
 *
 * Called after the measurement that may have changed the box, so the rule is: whatever the strip
 * ends up as wide as, the focused chip is inside it.
 */
export function keepFocusedChipInView(strip: HTMLElement): void {
  const focused = strip.ownerDocument.activeElement;
  if (!(focused instanceof HTMLElement) || !strip.contains(focused)) return;
  const chip = focused.closest(".mdy-chip");
  if (!(chip instanceof HTMLElement)) return;
  const box = strip.getBoundingClientRect();
  const at = chip.getBoundingClientRect();
  if (at.left >= box.left - 1 && at.right <= box.right + 1) return;
  // `nearest` in both axes: the strip is the only thing that should move, and a chip that is already
  // vertically where it belongs must not drag the page to it.
  chip.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function chipStripWheelDelta(
  deltaX: number,
  deltaY: number,
  scrollWidth: number,
  clientWidth: number,
): number {
  if (scrollWidth <= clientWidth) return 0;
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}
