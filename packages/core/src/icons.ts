/**
 * The icon set, drawn to one rule.
 *
 * Shared SVG geometry rather than XML repeated in every component: one definition, one appearance,
 * whichever renderer draws it.
 *
 * ## The rule
 *
 * Every icon is on a **24 grid** with **stroke 2**, round caps and round joins. The live area is
 * **20 units, from 2 to 22** — nothing is drawn outside it, so no glyph crowds the edge of its box.
 *
 * Within that, a glyph belongs to one of three classes, and its class fixes how much of the live
 * area it fills:
 *
 * | class | span | icons |
 * | --- | --- | --- |
 * | **full** | 20 (2–22) | `CALENDAR`, `CLOCK`, `ERROR`, `LOADER` |
 * | **compact** | 14 (5–19) | `SEARCH`, `CHECKMARK`, `CLOSE`, `PLUS`, `MINUS` |
 * | **directional** | 12 (6–18) | `CHEVRON_*`, `SPIN_UP`, `SPIN_DOWN` |
 *
 * The classes exist because a chevron drawn 20 units wide stops reading as a chevron and starts
 * reading as a very large arrow, while a calendar drawn 12 wide loses the detail that makes it a
 * calendar. What must not vary — and what did — is the *stroke weight on screen*, and the size of
 * glyphs within one class.
 *
 * Both halves are asserted in `packages/core/test/icons.test.mjs`. That test is the point: a set
 * drifts one well-meant icon at a time, and this one had drifted into four grids with strokes
 * rendering between 1.20px and 2.00px at the same box size.
 *
 * Adding an icon means choosing its class and drawing to that span. If a glyph fits none of the
 * three, add a class here with its reason rather than drawing it to no rule at all.
 */

/** The grid every icon is drawn on. */
export const MDY_ICON_GRID = 24;

/** The stroke every icon carries, in grid units. */
export const MDY_ICON_STROKE = 2;

/** How much of the live area a glyph fills, by class. */
export const MDY_ICON_SPANS = {
  /** 2–22. A glyph with internal detail: a calendar's grid, a clock's hands. */
  full: 20,
  /** 5–19. A self-contained mark: a tick, a cross, a magnifier. */
  compact: 14,
  /** 6–18. A direction, not an object. */
  directional: 12,
} as const;

export type MdyIconSpan = keyof typeof MDY_ICON_SPANS;

/** Every icon carries the same stroke presentation; only the geometry differs. */
const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const MDY_ICONS = {
  // ─── full: 2–22 ────────────────────────────────────────────────────────────
  CALENDAR: {
    viewBox: "0 0 24 24",
    span: "full",
    content: `<rect x="2" y="4" width="20" height="18" rx="2" ${STROKE}/><path d="M8 2v4M16 2v4M2 10h20" ${STROKE}/>`
  },
  CLOCK: {
    viewBox: "0 0 24 24",
    span: "full",
    content: `<circle cx="12" cy="12" r="10" ${STROKE}/><path d="M12 7v5l3.5 2" ${STROKE}/>`
  },
  ERROR: {
    viewBox: "0 0 24 24",
    span: "full",
    // The dot is a zero-length round-capped stroke rather than a filled circle: filled, it ignores
    // `stroke-width` and so thickens at a different rate from the ring it sits inside.
    content: `<circle cx="12" cy="12" r="10" ${STROKE}/><path d="M12 7v6M12 17h0" ${STROKE}/>`
  },
  LOADER: {
    viewBox: "0 0 24 24",
    span: "full",
    content: `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" ${STROKE}/>`
  },

  // ─── compact: 5–19 ─────────────────────────────────────────────────────────
  SEARCH: {
    viewBox: "0 0 24 24",
    span: "compact",
    // The handle starts on the circle's 45° point — 10.5 + 5.5/√2 = 14.39 — so the strokes meet
    // exactly rather than overlapping into a heavier join or leaving a hairline gap.
    content: `<circle cx="10.5" cy="10.5" r="5.5" ${STROKE}/><path d="M14.4 14.4 19 19" ${STROKE}/>`
  },
  CHECKMARK: {
    viewBox: "0 0 24 24",
    span: "compact",
    content: `<path d="M5 13l4 4L19 7" ${STROKE}/>`
  },
  CLOSE: {
    viewBox: "0 0 24 24",
    span: "compact",
    content: `<path d="M5 5l14 14M19 5L5 19" ${STROKE}/>`
  },
  PLUS: {
    viewBox: "0 0 24 24",
    span: "compact",
    content: `<path d="M5 12h14M12 5v14" ${STROKE}/>`
  },
  MINUS: {
    viewBox: "0 0 24 24",
    span: "compact",
    content: `<path d="M5 12h14" ${STROKE}/>`
  },

  // ─── directional: 6–18 ─────────────────────────────────────────────────────
  CHEVRON_DOWN: {
    viewBox: "0 0 24 24",
    span: "directional",
    content: `<path d="M6 9l6 6 6-6" ${STROKE}/>`
  },
  CHEVRON_LEFT: {
    viewBox: "0 0 24 24",
    span: "directional",
    content: `<path d="M15 18l-6-6 6-6" ${STROKE}/>`
  },
  CHEVRON_RIGHT: {
    viewBox: "0 0 24 24",
    span: "directional",
    content: `<path d="M9 18l6-6-6-6" ${STROKE}/>`
  },
  SPIN_UP: {
    viewBox: "0 0 24 24",
    span: "directional",
    content: `<path d="M6 15l6-6 6 6" ${STROKE}/>`
  },
  SPIN_DOWN: {
    viewBox: "0 0 24 24",
    span: "directional",
    content: `<path d="M6 9l6 6 6-6" ${STROKE}/>`
  }
} as const;

export type MdyIconName = keyof typeof MDY_ICONS;
