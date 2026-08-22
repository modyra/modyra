/**
 * The controls that sit at a field's trailing edge.
 *
 * A calendar button, a clock button, a colour swatch, a multiselect's search button, a number's
 * steppers, and the caret that marks a select as openable. Down a form they occupy the same column,
 * and a user reads them as one row of controls whether or not anyone designed them that way.
 *
 * They were not designed that way. Measured on the framework-free renderer, their centres sat at
 * 17, 19, 25 and 31 pixels from their field's inline end, in boxes of 16, 24, 28 and 44 — so the
 * column visibly wandered, and three of the interactive ones missed the 44px target size.
 *
 * ## Derived, not listed
 *
 * There is no table here, because the contract already knows both halves:
 *
 * - {@link MDY_POPUP_OPENERS} names the part that opens each popup;
 * - the catalogue declares each part's element, which says whether it is a control or a button.
 *
 * An opener that is a **button** is an affordance. An opener that is the field's own control is not:
 * for the pickers the typeable input carries `role="combobox"` and opens the popup, and it is the
 * field, not an ornament beside it. `arrow` joins them as the one affordance that is decorative
 * rather than interactive, and buttons parented to `inputWrapper` cover the steppers.
 *
 * A table restating this would be a second place to forget, and the catalogue has already been
 * caught carrying keys that matched nothing.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "./catalog.js";
import type { MdyWidgetKind } from "./catalog.js";

/** What an affordance is for, which decides whether it needs a hit target. */
export type MdyAffordanceRole =
  /** Operable: it opens something, or it steps a value. Needs a target a finger can hit. */
  | "control"
  /** Decorative: it says the field opens, and the field itself is what you press. */
  | "indicator";

export interface MdyAffordance {
  readonly part: string;
  readonly role: MdyAffordanceRole;
}

/**
 * The trailing affordances a kind draws, in the order the catalogue declares them.
 *
 * Empty for a kind that has none — a plain text field ends at its own edge.
 */
export function trailingAffordances(kind: MdyWidgetKind): readonly MdyAffordance[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  const found: MdyAffordance[] = [];

  for (const node of definition.structure.nodes) {
    // The one decorative member: `pointer-events: none`, with the whole trigger as the target.
    if (node.part === "arrow") {
      found.push({ part: node.part, role: "indicator" });
      continue;
    }
    // An opener that is a button is an ornament beside the field; an opener that is the field's own
    // control is the field.
    const isOpener = node.part === opener;
    // …with one shape in between: an opener drawn inside the field's header is pressed like an
    // ornament while holding the field's value like a control, so it carries `role="combobox"` and
    // still needs a target a finger can hit. Keying on the element alone lost it the moment the
    // role made it honest.
    if (node.element !== "button" && !(isOpener && node.parent === "header")) continue;
    // Beside the control, in whichever box the kind lays its own parts out in. A widget with a box
    // of its own declares its parts under it (ADR 0143), and keying only on the shell's name lost
    // the multiselect's clear-all and overflow the moment they were declared where they are drawn.
    const isStepper = node.parent === "inputWrapper" || node.parent === "box";
    if (isOpener || isStepper) found.push({ part: node.part, role: "control" });
  }

  return Object.freeze(found);
}

/** Every kind that draws at least one trailing affordance. */
export function kindsWithAffordances(): readonly MdyWidgetKind[] {
  return Object.freeze(
    (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).filter(
      (kind) => trailingAffordances(kind).length > 0,
    ),
  );
}

/**
 * The classes a renderer or a theme selects an affordance by, across every kind.
 *
 * A theme needs one selector list to give them all the same geometry, and building it from the
 * catalogue is what stops that list going stale the day a kind gains a button.
 */
export function affordanceClasses(role?: MdyAffordanceRole): readonly string[] {
  const classes = new Set<string>();
  for (const kind of kindsWithAffordances()) {
    // The part map is keyed by each kind's own part union, so it is read through a widened view —
    // the part name came from that kind's own structure and is therefore present by construction.
    const parts = MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, { readonly classes: readonly string[] }>>;
    for (const affordance of trailingAffordances(kind)) {
      if (role !== undefined && affordance.role !== role) continue;
      for (const cls of parts[affordance.part]?.classes ?? []) classes.add(cls);
    }
  }
  return Object.freeze([...classes].sort());
}
