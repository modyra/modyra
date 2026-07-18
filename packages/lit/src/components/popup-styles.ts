/** Shared inline styles for popup-style field controls (datepicker, timepicker, colors). */

import { html, nothing } from "lit";
import {
  computeCoordsForAnchor,
  computeOverlayPosition,
  type OverlayAlignment,
  type OverlayPosition,
  type OverlayPositionConfig,
} from "@modyra/core/overlay-position";

/** Visually hidden native input used as the platform picker behind a styled control. */
export const POPUP_ANCHOR_STYLE = "position:relative";
export const POPUP_STYLE = "position:fixed;z-index:1000";

export const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";

const VIEWPORT_GAP = 8;

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

function cssValue(value: number | undefined): string {
  return value !== undefined ? `${value}px` : "auto";
}

function computeMaxHeight(anchorEl: HTMLElement, position: OverlayPosition): string {
  const vh = document.documentElement.clientHeight;
  if (position === "overlay") return "80vh";
  const rect = anchorEl.getBoundingClientRect();
  if (position === "above") return `${Math.max(120, rect.top - VIEWPORT_GAP)}px`;
  return `${Math.max(120, vh - rect.bottom - VIEWPORT_GAP)}px`;
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
      cssVars: {
        top: "auto",
        bottom: "auto",
        left: "auto",
        right: "auto",
        width: "auto",
        maxHeight: "50vh",
      },
    };
  }

  const widthMode = config?.widthMode ?? "match-anchor";

  const computed =
    config?.lockPosition && config?.lockAlignment
      ? {
          position: config.lockPosition,
          alignment: config.lockAlignment,
          coords: computeCoordsForAnchor(anchorEl, config.lockPosition, config.lockAlignment),
        }
      : computeOverlayPosition(anchorEl, {
          minSpace: config?.minSpace,
          minWidth: config?.minWidth,
          preferredPosition: config?.preferredPosition,
          clickX: config?.clickX,
        });

  const width = widthMode === "match-anchor" && computed.coords.width !== undefined
    ? `${computed.coords.width}px`
    : "auto";
  const cssVars = {
    top: cssValue(computed.coords.top),
    bottom: cssValue(computed.coords.bottom),
    left: cssValue(computed.coords.left),
    right: cssValue(computed.coords.right),
    width,
    maxHeight: computeMaxHeight(anchorEl, computed.position),
  };

  const panelStyle = computed.position === "overlay"
    ? `${POPUP_STYLE};top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);max-height:${cssVars.maxHeight};`
    : `${POPUP_STYLE};top:${cssVars.top};bottom:${cssVars.bottom};left:${cssVars.left};right:${cssVars.right};width:${cssVars.width};max-height:${cssVars.maxHeight};`;

  return {
    position: computed.position,
    alignment: computed.alignment,
    panelStyle,
    cssVars,
  };
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
    private readonly getAnchor: () => HTMLElement | undefined = () => host,
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
  const panelStyle = options?.panelDisplayContents
    ? "display: contents"
    : options?.panelStyle ?? POPUP_STYLE;
  return html`
    <div class="mdy-overlay-backdrop"></div>
    <div
      class="mdy-overlay-panel mdy-overlay-panel--visible${positionClass}${modalClass}${rightClass}"
      style=${panelStyle}
    >
      ${content}
    </div>
  `;
}
