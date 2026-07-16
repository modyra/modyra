/**
 * Shared SVG icon paths and viewBoxes to reduce bundle size.
 * Instead of repeating SVG XML in every component template, we use these constants.
 */

export const MDY_ICONS = {
  SEARCH: {
    viewBox: "0 0 20 20",
    content: '<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  },
  CHECKMARK: {
    viewBox: "0 0 24 24",
    content: '<polyline points="6 12 10 16 18 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  CHEVRON_DOWN: {
    viewBox: "0 0 24 24",
    content: '<path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  CHEVRON_LEFT: {
    viewBox: "0 0 24 24",
    content: '<path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  CHEVRON_RIGHT: {
    viewBox: "0 0 24 24",
    content: '<path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  CLOSE: {
    viewBox: "0 0 12 12",
    content: '<line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  },
  PLUS: {
    viewBox: "0 0 12 12",
    content: '<line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="6" y1="3" x2="6" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  },
  MINUS: {
    viewBox: "0 0 12 12",
    content: '<line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  },
  CALENDAR: {
    viewBox: "0 0 24 24",
    content: '<rect x="2" y="4" width="20" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" stroke-width="2"/>'
  },
  CLOCK: {
    viewBox: "0 0 24 24",
    content: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  SPIN_UP: {
    viewBox: "0 0 16 16",
    content: '<polyline points="4,10 8,6 12,10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  },
  SPIN_DOWN: {
    viewBox: "0 0 16 16",
    content: '<polyline points="4,6 8,10 12,6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  },
  ERROR: {
    viewBox: "0 0 24 24",
    content: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/>'
  },
  LOADER: {
    viewBox: "0 0 24 24",
    content: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  }
} as const;

export type MdyIconName = keyof typeof MDY_ICONS;
