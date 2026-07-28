/** Shared inline styles for popup-style field controls (datepicker, timepicker, colors). */

import { html, nothing } from "lit";
import {
  type OverlayAlignment,
  type OverlayPosition,
  type OverlayPositionConfig,
} from "@modyra/core/overlay-position";
import { anchorOverlay } from "@modyra/widgets";

/** Visually hidden native input used as the platform picker behind a styled control. */
export const POPUP_ANCHOR_STYLE = "position:relative";
export const POPUP_STYLE = "position:fixed;z-index:1000";

export const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";


export interface OverlayPanelState {
  readonly position: OverlayPosition;
  readonly alignment: OverlayAlignment;
  readonly panelStyle: string;
  readonly cssVars: {
    readonly top: string;
    readonly bottom: string;
    readonly left: string;
    readonly right: string;
    readonly width: string;
    readonly maxHeight: string;
  };
}

interface OverlayStateConfig extends OverlayPositionConfig {
  readonly lockPosition?: OverlayPosition;
  readonly lockAlignment?: OverlayAlignment;
  readonly widthMode?: "match-anchor" | "auto-content";
}

export function extractClickX(event?: Event): number | undefined {
  if (!event) return undefined;
  if (event instanceof MouseEvent) return event.clientX;
  if (event instanceof TouchEvent) return event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX;
  return undefined;
}

export function computeOverlayPanelState(
  anchorEl?: HTMLElement,
  config?: OverlayStateConfig,
): OverlayPanelState {
  if (typeof document === "undefined" || !anchorEl) {
    return {
      position: "below",
      alignment: "left",
      panelStyle: POPUP_STYLE,
      cssVars: { top: "auto", bottom: "auto", left: "auto", right: "auto", width: "auto", maxHeight: "50vh" },
    };
  }

  // The anchoring is `anchorOverlay` in @modyra/widgets — the same call the framework-free renderer
  // makes — so a Lit popup attaches exactly where an Angular or Plain one would. This function
  // measures, and translates the properties it gets back into the panel's inline style.
  const rect = anchorEl.getBoundingClientRect();
  const anchoring = anchorOverlay(
    rect,
    { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    {
      minSpace: config?.minSpace,
      minWidth: config?.minWidth,
      preferred: config?.preferredPosition,
      matchAnchorWidth: (config?.widthMode ?? "match-anchor") === "match-anchor",
      pointerX: config?.clickX,
      // A locked overlay keeps the side and edge it opened on; its height is measured afresh so a
      // popup near the viewport edge still fits.
      lock: config?.lockPosition && config?.lockAlignment
        ? { placement: config.lockPosition, alignment: config.lockAlignment }
        : null,
    },
  );

  const read = (name: string, fallback: string): string => anchoring.properties[name] ?? fallback;
  const cssVars = {
    top: read("--mdy-overlay-top", "auto"),
    bottom: read("--mdy-overlay-bottom", "auto"),
    left: read("--mdy-overlay-left", "auto"),
    right: read("--mdy-overlay-right", "auto"),
    width: read("--mdy-overlay-width", "auto"),
    maxHeight: read("--mdy-overlay-max-height", "50vh"),
  };
  const transform = read("--mdy-overlay-transform", "none");
  const panelStyle =
    `${POPUP_STYLE};top:${cssVars.top};bottom:${cssVars.bottom};left:${cssVars.left};` +
    `right:${cssVars.right};width:${cssVars.width};max-height:${cssVars.maxHeight};transform:${transform};`;

  return { position: anchoring.decision.placement, alignment: anchoring.decision.alignment, panelStyle, cssVars };
}

type OverlayHost = HTMLElement & { requestUpdate: () => void };

/**
 * Shared overlay tracker for Lit renderers.
 * Keeps canonical corner selection while open and follows scroll via locked corner coords.
 */
export class MdyLitOverlayController {
  private _state: OverlayPanelState = computeOverlayPanelState(undefined);
  private clickX: number | undefined;
  private active = false;
  private scrollRaf = 0;
  private readonly onScroll = (): void => {
    if (!this.active || this.scrollRaf !== 0) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      this.refresh(false);
    });
  };
  private readonly onResize = (): void => this.refresh(true);

  constructor(
    private readonly host: OverlayHost,
    // The popup attaches to the control, not to the field: anchoring on the host would measure the
    // label and supporting text too, and open the popup a row too low and a little too wide.
    private readonly getAnchor: () => HTMLElement | undefined = () =>
      host.querySelector<HTMLElement>(".mdy-input-wrapper") ?? host,
    private readonly config?: Pick<OverlayStateConfig, "minSpace" | "minWidth" | "preferredPosition" | "widthMode">,
  ) {}

  get state(): OverlayPanelState {
    return this._state;
  }

  open(event?: Event): void {
    const eventClickX = extractClickX(event);
    if (eventClickX !== undefined) this.clickX = eventClickX;
    const wasActive = this.active;
    this.active = true;
    this.refresh(true);
    if (!wasActive) {
      window.addEventListener("scroll", this.onScroll, true);
      window.addEventListener("resize", this.onResize);
    }
  }

  close(): void {
    this.active = false;
    this.clickX = undefined;
    if (this.scrollRaf !== 0) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onResize);
  }

  refresh(reselectCorner = true): void {
    const anchor = this.getAnchor();
    if (!anchor) return;
    const lockCorner = !reselectCorner && this._state.position !== "overlay";
    this._state = computeOverlayPanelState(anchor, {
      ...this.config,
      clickX: reselectCorner ? this.clickX : undefined,
      lockPosition: lockCorner ? this._state.position : undefined,
      lockAlignment: lockCorner ? this._state.alignment : undefined,
    });

    this.host.style.setProperty("--mdy-overlay-top", this._state.cssVars.top);
    this.host.style.setProperty("--mdy-overlay-bottom", this._state.cssVars.bottom);
    this.host.style.setProperty("--mdy-overlay-left", this._state.cssVars.left);
    this.host.style.setProperty("--mdy-overlay-right", this._state.cssVars.right);
    this.host.style.setProperty("--mdy-overlay-width", this._state.cssVars.width);
    this.host.style.setProperty("--mdy-overlay-max-height", this._state.cssVars.maxHeight);
    this.host.requestUpdate();
  }
}

export interface RenderOverlayPanelOptions {
  /** When true the panel has a backdrop and emits `--modal`. */
  modal?: boolean;
  /** Horizontal alignment of the panel, emits `--right` when `'right'`. */
  alignment?: "left" | "right";
  /** Explicit position class when already computed by the caller/controller. */
  position?: OverlayPosition;
  /** Inline style for fixed-panel mode. */
  panelStyle?: string;
  /** Use display:contents wrapper so positioning is delegated to inner content. */
  panelDisplayContents?: boolean;
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
  options?: RenderOverlayPanelOptions,
): unknown {
  if (!open) return nothing;
  const position = options?.position ?? "below";
  const positionClass =
    position === "above"
      ? " mdy-overlay-panel--above"
      : position === "overlay"
        ? " mdy-overlay-panel--overlay"
        : "";
  const modalClass = options?.modal ? " mdy-overlay-panel--modal" : "";
  const rightClass = options?.alignment === "right" ? " mdy-overlay-panel--right" : "";
  // The panel is a marker, not a box: it lays nothing out (`display: contents`), so the popup part
  // inside it is the single container — the same one Plain portals and Angular projects. Two nested
  // positioned boxes is what put a Lit popup 35px below where its anchor said it belonged.
  return html`
    <div class="mdy-overlay-backdrop"></div>
    <div
      class="mdy-overlay-panel mdy-overlay-panel--visible${positionClass}${modalClass}${rightClass}"
      style="display: contents"
    >
      ${content}
    </div>
  `;
}
