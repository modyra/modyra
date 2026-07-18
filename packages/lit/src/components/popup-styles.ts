/** Shared inline styles for popup-style field controls (datepicker, timepicker, colors). */

import { html, nothing } from "lit";

/** Visually hidden native input used as the platform picker behind a styled control. */
export const POPUP_ANCHOR_STYLE = "position:relative";
export const POPUP_STYLE = "position:absolute;top:calc(100% + 4px);left:0;z-index:1000";

export const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";

/**
 * Minimal Lit equivalent of the Angular `<mdy-overlay-panel>` markup.
 * Emits the same class contract (`mdy-overlay-backdrop`, `mdy-overlay-panel`,
 * `mdy-overlay-panel--visible`) so the theme audit stays aligned. Positioning
 * is handled by the inline `POPUP_STYLE` on the panel.
 */
export function renderOverlayPanel(content: unknown, open: boolean): unknown {
  if (!open) return nothing;
  return html`
    <div class="mdy-overlay-backdrop"></div>
    <div class="mdy-overlay-panel mdy-overlay-panel--visible" style=${POPUP_STYLE}>
      ${content}
    </div>
  `;
}
