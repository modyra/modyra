/** Shared inline styles for popup-style field controls (datepicker, timepicker, colors). */

import { html, nothing } from "lit";

/** Visually hidden native input used as the platform picker behind a styled control. */
export const POPUP_ANCHOR_STYLE = "position:relative";
export const POPUP_STYLE = "position:absolute;top:calc(100% + 4px);left:0;z-index:1000";

export const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";

const POPUP_MIN_SPACE = 200;

function resolveOverlayPosition(anchorEl?: HTMLElement): "below" | "above" | "overlay" {
  if (typeof window === "undefined" || !anchorEl) return "below";
  const rect = anchorEl.getBoundingClientRect();
  const vh = window.innerHeight;
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow >= POPUP_MIN_SPACE) return "below";
  if (spaceAbove >= POPUP_MIN_SPACE) return "above";
  return "overlay";
}

/**
 * Minimal Lit equivalent of the Angular `<mdy-overlay-panel>` markup.
 * Emits the same class contract (`mdy-overlay-backdrop`, `mdy-overlay-panel`,
 * `mdy-overlay-panel--visible`) so the theme audit stays aligned. A simple
 * viewport-space heuristic also adds `--above` or `--overlay` when there is
 * not enough room below the anchor.
 */
export function renderOverlayPanel(
  content: unknown,
  open: boolean,
  anchorEl?: HTMLElement,
): unknown {
  if (!open) return nothing;
  const position = resolveOverlayPosition(anchorEl);
  const positionClass =
    position === "above"
      ? " mdy-overlay-panel--above"
      : position === "overlay"
        ? " mdy-overlay-panel--overlay"
        : "";
  return html`
    <div class="mdy-overlay-backdrop"></div>
    <div class="mdy-overlay-panel mdy-overlay-panel--visible${positionClass}" style=${POPUP_STYLE}>
      ${content}
    </div>
  `;
}
