import type { MdyWidgetKind } from "../catalog.js";

/**
 * The part that takes focus when a widget's panel opens.
 *
 * **The primary operable unit of the panel takes focus**, because it is what the person opened the
 * panel to operate. Five kinds already answered that way in every renderer — a select lands on its
 * search box, a datepicker on a day, a timepicker on the hour, a colours field on a swatch — and
 * this states the rule those five were each following privately.
 *
 * The sixth did not agree, and the disagreement was invisible: a multiselect landed on a chip in one
 * renderer, on its search box in another, and stayed on the trigger in a third. Three answers to one
 * question, so a person met different muscle memory depending on which adapter their team had
 * chosen. That is the same reason the timepicker's opening view was declared, in the same words its
 * own file uses. ADR 0197.
 *
 * Named as a **part**, not a selector: the parts exist in the catalogue, and a renderer choosing its
 * own selector is a renderer that can disagree with the contract about where focus went.
 *
 * `null` for a kind with no panel to open. A caller that gets `null` moves nothing — which is not
 * the same as a caller that gets a part and cannot find it, and the two must not be collapsed.
 */
export function focusPartOnOpen(
  kind: MdyWidgetKind,
  options: {
    /**
     * Whether this instance draws a box to type in. It changes the answer rather than the rule: the
     * primary operable unit of a panel with a filter is the filter, and of one without it is the
     * first thing that can be chosen.
     */
    readonly searchable?: boolean;
  } = {},
): string | null {
  switch (kind) {
    case "select":
      // A select with no filter renders the platform's own chooser, which has no panel of ours to
      // put focus into.
      return options.searchable === false ? null : "search";
    case "multiselect":
      // The chip a plain multiselect used to focus is an affordance for *correcting* a choice, and
      // opening a list to choose lands the person on the control that removes one. Right element,
      // wrong moment.
      return options.searchable ? "search" : "option";
    case "datepicker":
    case "daterange":
      return "gridcell";
    case "timepicker":
      // The opening part only. Which segment carries focus *afterwards* follows the field being
      // edited, and that question has its own answer in `timepickerFocusPart` — one question, one
      // reader, even when the two are next door to each other.
      return "hourControl";
    case "colors":
      return "swatch";
    default:
      return null;
  }
}
