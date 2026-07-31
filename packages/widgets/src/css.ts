/**
 * The custom properties a renderer writes and a theme reads.
 *
 * These are the other half of the class contract. A class says what a part is; a custom property
 * carries a number the theme cannot work out for itself — where the popup goes, how many columns the
 * row has, how far along the slider is. The foundation's rules are written against these names, so a
 * renderer that spells one differently produces an element that is styled as if the number were
 * never supplied: a popup at the top-left of the screen, a one-column grid, an empty slider track.
 *
 * Until now every name was a string literal, and `--mdy-overlay-left` appeared as one in four
 * packages at once — `@modyra/widgets`, `@modyra/core`, `@modyra/angular` and `@modyra/lit`. Four
 * copies of a name is four chances to typo it and no way to find out that anyone did.
 */

/** Every `--mdy-*` property the contract defines, grouped by what writes it. */
export const MDY_CSS_PROPERTIES = Object.freeze({
  /**
   * Written by `anchorOverlay`, read by `.mdy-overlay` in the foundation. The whole placement
   * decision reaches the page through these eight and nothing else.
   */
  overlay: Object.freeze({
    top: "--mdy-overlay-top",
    bottom: "--mdy-overlay-bottom",
    left: "--mdy-overlay-left",
    right: "--mdy-overlay-right",
    /** Set only when the popup matches its anchor's width, as a select's list does. */
    width: "--mdy-overlay-width",
    /** Always set: it is what stops a content-sized popup running off the side of the screen. */
    maxWidth: "--mdy-overlay-max-width",
    /** Always set: the room on the side the popup was given, so a long list scrolls rather than
     * overflowing the viewport. */
    maxHeight: "--mdy-overlay-max-height",
    /** `none` when anchored, a centring translate when the popup gave up on its anchor. */
    transform: "--mdy-overlay-transform",
  }),
  /** Written by `layoutNodeAttributes` on a columns row; the foundation divides the row by it. */
  layout: Object.freeze({
    columnCount: "--mdy-layout-column-count",
    /** Which track a column starts in, when a slot places itself rather than following row order. */
    columnStart: "--mdy-layout-column-start",
    /** Whether a column shows. Written as a `display` value so the cascade needs no extra selector. */
    columnDisplay: "--mdy-layout-column-display",
  }),
  /** Written per control, where a theme needs a number only the renderer knows. */
  control: Object.freeze({
    /**
     * How far along the slider's value sits, as a **unitless ratio in 0–1** — not a percentage.
     *
     * The stylesheet has to place the stop at `thumb/2 + ratio * (100% - thumb)`, because a range
     * input's handle travels by its centre and never hangs off either end. That needs the ratio as
     * a number it can multiply a length by, and `calc()` cannot divide by a percentage to recover
     * one. A renderer cannot do the arithmetic itself either: the handle's size is a theme token,
     * and a renderer that knew it would be drawing the theme.
     */
    sliderFill: "--mdy-slider-fill",
    /** How many segments a segmented control has, so the group divides itself evenly. */
    segmentCount: "--mdy-segments-count",
    /**
     * Which position a number occupies on the clock face, 0–11. The foundation rotates it into
     * place; a renderer that positioned the numbers itself would be drawing a different dial.
     *
     * Un-namespaced, unlike everything else here — it predates this vocabulary and every theme reads
     * it under this name. Renaming it is a change to the themes as much as to the renderers, and it
     * is named here so that when it happens there is one place to change.
     */
    dialIndex: "--index",
  }),
});

/** Every property name the contract defines, flat — for an audit, or for clearing a set of them. */
export const MDY_CSS_PROPERTY_NAMES: readonly string[] = Object.freeze(
  Object.values(MDY_CSS_PROPERTIES).flatMap((group) => Object.values(group)).sort(),
);

/** The `--mdy-overlay-*` group, which is written and cleared as a unit. */
export type MdyOverlayProperty = (typeof MDY_CSS_PROPERTIES.overlay)[keyof typeof MDY_CSS_PROPERTIES.overlay];
