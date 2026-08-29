/**
 * What a widget can be, and the shape of what a definition says about it.
 *
 * The vocabulary and the types only. Everything that reads a definition depends on this and not on
 * the eight hundred lines that build one.
 */
import type { MdyMultiselectMode } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type { MdyOutsideDismiss } from "../dismissal.js";
import type { MdyWidgetSemanticElement, MdyWidgetStructure } from "../structure.js";

export const MDY_WIDGET_KINDS = Object.freeze(["text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle", "radio", "segmented", "select", "multiselect", "datepicker", "daterange", "timepicker", "file", "colors"] as const);
export type MdyWidgetKind = (typeof MDY_WIDGET_KINDS)[number];

/**
 * Every configuration a varianted kind may be in, across the whole catalogue.
 *
 * An alias of the config's own union rather than a list of its own: the variant key *is* the value a
 * form document carries, so there is one place these words are defined and no way for the two to
 * disagree. Closed, so a name nothing describes cannot be asked for — a widget checked against an
 * anatomy that does not exist is the gap variants were added to close.
 *
 * **Two axes now, and the question this comment reserved is answered here.** A multiselect varies by
 * *mode* — what one choice does — and a select varies by *presentation*: it renders the platform's
 * own chooser unless it filters, and the two shapes have different anatomies. They are different
 * questions, and the union carries both.
 *
 * One type rather than one per kind, because a variant name is only meaningful for the kind that
 * declares it: `MDY_WIDGET_CONTRACTS[kind].variants` is what says which names a kind answers to, and
 * a name it does not declare matches nothing — asking a select about `multi` selects no anatomy
 * rather than the wrong one. That is what makes the shared vocabulary safe, and it is the property
 * to keep if a third axis arrives: the union may grow, and a lookup must stay a lookup.
 */
export type MdyWidgetVariant = MdyMultiselectMode | MdySelectPresentation;

/**
 * The two shapes a select is drawn in.
 *
 * A select that does not filter renders the **native** chooser — deliberately, for the platform's
 * typeahead and its mobile picker — and a native `<select>` has no element for the chosen option, no
 * separate arrow and no placeholder that is not an `<option>`. A select that filters draws the
 * combobox, which has all three and an overlay to point at.
 *
 * Declared because the difference is anatomy, not decoration: read as one shape, the contract owed
 * every select the combobox's parts and its opener relation, and two renderers were non-conforming
 * for drawing what the contract's own prose told them to draw.
 */
export type MdySelectPresentation = "native" | "custom";

/**
 * How a kind's value is read, which is what decides whether it is drawn in a box.
 *
 * **Every field has one place where its value shows — its slot.** Read it by looking *inside* a
 * surface and the field is a container: it gets the box, and it sits in the column with the others.
 * Is the slot *itself* the value — a position, an on or an off — and there is nothing to look inside
 * and no box. Everything around the slot is frame: buttons, openers, commands. Frame has no category.
 *
 * The test for which part is the slot is short: **take the part away — can the value still be seen?**
 * If yes it was frame; if no it was the slot.
 *
 * **Decided by how the value is *read*, never by how it is *entered*.** Every hesitation about this
 * table has turned out to be somebody looking at entry: a colour swatch is *pressed*, files arrive
 * from another window, chips are *removed* one by one, a segmented row has *words* in it. None of
 * that counts. A quantity with plus and minus reads like a container and is entered like a shape,
 * and it is a container — by the rule rather than as an exception to it.
 *
 * Two consequences a renderer gets wrong without being told:
 *
 * - **an empty slot is still the slot.** A file field holding no file keeps its box, with words
 *   inside saying there is nothing — otherwise the control changes shape at the first file;
 * - **read-only does not remove the box.** A container that no longer takes writing is still a
 *   container; that it is inert is said another way. Without its box it reads as ordinary text and
 *   stops looking like a value of the form.
 *
 * Where a kind draws several boxes for one value — the two halves of a time, the segments of a date
 * — the slot is the *set*, so there is one box with the parts inside it, not one box each.
 *
 * The one thing this does not decide: a control with two full slots, neither removable by any
 * configuration, is showing its value twice. That is a fault in the control, not a case of the rule.
 */
export type MdyValueSlot = "container" | "shape";

export interface MdyWidgetDefinition<TPart extends string = string> {
  readonly kind: MdyWidgetKind;
  readonly rootClasses: readonly string[];
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
  readonly structure: MdyWidgetStructure<TPart | "root">;
  /** Classes this kind's renderers may carry that are not parts. See `MdyWidgetShape.presentation`. */
  readonly presentationClasses: readonly string[];
  /**
   * Anatomy that depends on configuration, keyed by the config value that decides it.
   *
   * Empty for every kind whose anatomy is the same however it is configured, which is all but one.
   * See `MdyWidgetShape.variants` for what a variant may say and why that is deliberately narrow.
   */
  readonly variants: Readonly<Partial<Record<MdyWidgetVariant, {
    readonly elements: Readonly<Record<string, MdyWidgetSemanticElement>>;
    /** What a part announces as in this variant, where it differs from the kind's own answer. */
    readonly roles: Readonly<Record<string, string>>;
    readonly required: readonly string[];
  }>>>;
  /**
   * The native control this kind is rendered with, where a platform has one.
   *
   * A password differs from a text field in exactly one way — the control does not show what is
   * typed into it — and that difference lived nowhere a renderer could read it: every adapter kept a
   * private map from kind to input type, and the failure mode of one that forgets is a password in
   * clear text. Declared here, it is a statement an adapter implements rather than knowledge each
   * one carries privately.
   *
   * Absent for a kind a platform has no single control for — a select drawn as a trigger and a
   * listbox, a daterange drawn as two calendars.
   */
  readonly controlType?: string;
  /**
   * Whether this kind's control conceals what is typed into it.
   *
   * The whole meaning of `password`, and the one fact that separates it from `text`.
   */
  readonly concealed?: boolean;
  /**
   * How this kind's value is read, which is what decides whether it is drawn in a box.
   *
   * `container` — the value shows inside a surface you look into, so the field carries the box and
   * sits in the column with the others. `shape` — the slot *is* the value, a position or an on/off,
   * so there is nothing to look inside and no box.
   *
   * Read, never entered: a quantity stepped with buttons is still read by looking at the number.
   * Declared here so three renderers stop deciding it separately — the question sounds like a
   * property of a control, and it is a property of the contract.
   */
  readonly valueSlot: MdyValueSlot;
  readonly capabilities: {
    /**
     * Whether this kind owns an overlay.
     *
     * The only one of these that ever varied. `keyboard` and `focus` were declared beside it and
     * were `true` on all seventeen kinds — every widget here is operable from the keyboard and can
     * hold focus, so as *per-kind flags* they said nothing, and a consumer branching on one was
     * branching on a constant. They are gone rather than left as decoration: a declared capability
     * that cannot be false is a promise with no content.
     */
    readonly overlay: boolean;
    /**
     * A pointer outside the overlay dismisses it.
     *
     * Exactly `overlay` on every kind today, and kept because it is the one of the four that can
     * meaningfully be false: a popup a click elsewhere cannot dismiss is a real design, and this is
     * where it would be declared.
     *
     * It names an **interaction**, not an event. No single event can express the rule: `pointerdown`
     * fires on press, before the interaction's end is known, and `click` says nothing about a drag
     * that began *inside* the popup and ended outside — which is what selecting text in a popup is.
     *
     * `"light-dismiss"` closes only when a primary interaction both begins and completes outside the
     * logical branch. The rule lives in {@link createLightDismiss}, so a renderer consumes it rather
     * than restating it.
     *
     * The shape stays a union rather than a boolean: a popup an interaction elsewhere cannot dismiss
     * is a real design, and a second dismissal model would be declared here beside this one.
     */
    readonly dismissOnOutsidePointer: MdyOutsideDismiss;
    /**
     * Focus leaving the widget's logical branch closes it.
     *
     * Declared separately because it is a **different question** with a different answer, and
     * conflating the two is how a popup came to close through a path the pointer rule had just
     * refused. This one is what makes Tab out of an open popup close it.
     *
     * Two things it is not. It is never a substitute for an outside interaction: an interaction that
     * began inside the branch and dragged out moves focus out too, and closing on that would
     * reinstate the dismissal `dismissOnOutsidePointer` exists to prevent. And it never outranks a
     * pointer — while an interaction begun inside is unresolved, focus decides nothing.
     */
    readonly dismissOnFocusOutside: boolean;
    /**
     * Whether this popup's content scrolls, or has a size it must be shown at.
     *
     * A list scrolls: forty options in a short window is a list, and clamping it is the correct
     * answer. A clock face, a month grid and a swatch grid do not — they have one size, and a
     * scrollable stub of one is a broken control rather than a compact one.
     *
     * Placement reads it to decide when to stop chasing the anchor. Without it the rule could only
     * ask *"is there enough room to bother"* — a fixed minimum — so a 256px clock with 200px below
     * it was called a fit, docked, and clamped into something you scroll a clock in.
     *
     * It varies, which is what makes it worth declaring: a capability that cannot be false is a
     * promise with no content.
     */
    readonly overlayScrolls: boolean;
    /**
     * How this widget's popup attaches, for `anchorOverlay`. A list belongs under its control and
     * as wide as it; a calendar is sized by its own content. Naming it here is what stops three
     * renderers from each choosing a width for the same widget.
     */
    readonly anchoring?: {
      readonly matchAnchorWidth: boolean;
      readonly minSpace: number;
      readonly minWidth?: number;
      /**
       * The edge of the control the popup hangs from. Every widget here puts its trigger — the
       * arrow, the calendar button, the swatch — at the end of the control, so its popup opens from
       * that end and stays there: which corner a calendar opens from is a property of the widget,
       * not of where its field happens to sit on the page or where inside it you clicked. The
       * viewport can still overrule it when the content would not fit that side.
       */
      readonly alignment?: "left" | "right";
    };
  };
}

/**
 * Carried by a popup that a renderer lifts out of its field and positions against the viewport,
 * alongside {@link MDY_POPUP_CLASS}. The container is the same either way; this only says the
 * coordinates are viewport coordinates, which is what a portalled popup needs and a projected one
 * that a panel positioned by its host, in its own coordinate space, must not have.
 */
export const MDY_OVERLAY_PORTAL_CLASS = "mdy-overlay";
