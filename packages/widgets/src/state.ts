/**
 * What a part can be in.
 *
 * A part's classes say what it *is*; these say what it currently *is doing* — selected, open,
 * disabled, today's date, the start of a range.
 *
 * A state is named once, here, and its class is derived from it: `--in-range` is spelled one way
 * because {@link MDY_STATE_MODIFIERS} spells it, and a part may only be put into a state it declares
 * in the catalog. Without that, a renderer spelling `"mdy-datepicker__cell--selected"` and a theme
 * writing a rule for it agree only by coincidence — and a theme styling `--focused` where a renderer
 * emits `--active` is a rule that matches nothing, silently, in a way no test here can see.
 *
 * The shape is the one {@link multiselectChipClasses} proves for the chip: ask the contract what
 * classes this thing carries, and apply the answer.
 */

/**
 * Every state a part may be in, and the modifier it becomes.
 *
 * The value is the suffix, not the class: a state hangs off whichever part carries it, so `selected`
 * is `mdy-select__option--selected` on an option and `mdy-chip--selected` on a chip. One name, one
 * spelling, wherever it appears.
 */
export const MDY_STATE_MODIFIERS = Object.freeze({
  /** Chosen — an option taken, a date picked, a segment on. */
  selected: "selected",
  /** Where the keyboard is, which is not the same as chosen. */
  active: "active",
  /** Under the pointer or holding focus, for a part that distinguishes it from `active`. */
  focused: "focused",
  /** Not available. */
  disabled: "disabled",
  /** Read but not written. */
  readonly: "readonly",
  /** Its overlay is showing. */
  open: "open",
  /** Failing validation. */
  error: "error",
  /** Failing validation, named as the projections name it on a control rather than a field. */
  invalid: "invalid",
  /** Waiting on something asynchronous — options being fetched, most often. */
  loading: "loading",
  /** Has a value — what a floating label rises for. */
  filled: "filled",
  /** Has an error to show, as distinct from `error`: the label reserves room, the wrapper paints. */
  hasError: "has-error",
  /** The user has been here and left. */
  touched: "touched",
  /** Filtered out of the list, still in the DOM. */
  hidden: "hidden",
  /** A file is being dragged over the dropzone. */
  dragover: "dragover",
  /** Today's date. */
  today: "today",
  /** A day belonging to the month either side of the one on show. */
  outside: "outside",
  /** Between the two ends of a selected range. */
  inRange: "in-range",
  /** The first day of a selected range. */
  rangeStart: "range-start",
  /** The last day of a selected range. */
  rangeEnd: "range-end",
  /** Can be taken off — a value chip with a dismiss affordance. */
  removable: "removable",
  /** Held and travelling: a chip a pointer has picked up and not yet put down. */
  dragging: "dragging",
  /** Laid out along the row rather than down the column. */
  horizontal: "horizontal",
  /** The dense form of a control that has one. */
  compact: "compact",
  /** Drawn where the pointer is rather than where the value is — a second hand, faintly. */
  ghost: "ghost",
  /** Moves rather than jumps. Asked for by the host: a thing in motion is briefly not where it is. */
  animated: "animated",
  /** The action that commits, as against the one that dismisses. */
  confirm: "confirm",
  /** The overlay sits above its anchor. */
  above: "above",
  /** The overlay gave up on its anchor and centred itself. */
  overlay: "overlay",
  /** The overlay hangs from the end of its anchor rather than the start. The start is the ordinary
   * case and carries no class, exactly as "below" does for placement. */
  right: "right",
  /**
   * On the inner ring of a face that has two.
   *
   * A clock face has twelve positions and 24-hour time has twenty-four hours, so the second twelve
   * sit at the same positions on a shorter radius. Which numbers those are is the contract's
   * (`timepickerDialNumbers`); this is how a renderer says which ring it drew one on.
   */
  inner: "inner",
});

/** A state a part may declare. */
export type MdyStateName = keyof typeof MDY_STATE_MODIFIERS;

/** Which of a part's states are currently on. Omitted is off. */
export type MdyPartState = Partial<Readonly<Record<MdyStateName, boolean>>>;

/**
 * The class a state becomes on a given part.
 *
 * The base is the part's *own* class — its first, the one that names it — because that is what every
 * theme in this repo already suffixes: `.mdy-datepicker__cell--today`, not `.mdy-popup--today` for a
 * part that happens to carry both.
 */
export function stateClass(base: string, state: MdyStateName): string {
  return `${base}--${MDY_STATE_MODIFIERS[state]}`;
}
