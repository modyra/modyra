/** Shared inline styles for popup-style field controls (datepicker, timepicker, colors). */

import { html, nothing } from "lit";
import {
  anchorOverlay,
  popupPlacementClass,
  overlayAnchoringFor,
  setOverlayOpen,
  MDY_CSS_PROPERTIES,
  MDY_POPUP_CLASS,
  type MdyOverlayAlignment,
  type MdyOverlayDecision,
  type MdyOverlayPlacement,
  type MdyWidgetKind, trackAnchoredOverlay } from "@modyra/widgets";

/** Visually hidden native input used as the platform picker behind a styled control. */
export const POPUP_ANCHOR_STYLE = "position:relative";
export const POPUP_STYLE = "position:fixed;z-index:1000";

export const NATIVE_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";


export interface OverlayPanelState {
  readonly position: MdyOverlayPlacement;
  readonly alignment: MdyOverlayAlignment;
  /**
   * The whole decision behind `position` and `alignment`, kept so it can be handed back as the
   * overlay's `current` on the next frame. `null` before anything has been measured, which is
   * exactly the state in which there is nothing to hold.
   */
  readonly decision: MdyOverlayDecision | null;
  readonly panelStyle: string;
  readonly cssVars: {
    readonly top: string;
    readonly bottom: string;
    readonly left: string;
    readonly right: string;
    readonly width: string;
    readonly maxHeight: string;
    readonly maxWidth: string;
    /**
     * How the popup is moved after it is placed — `translate(-50%, -50%)` for the modal placement.
     *
     * Carried with the rest because it is how the modal placement centres at all: the coordinates
     * put its corner at the middle of the viewport and this pulls it back by half its own size.
     * Written into the panel's style string and left out of the properties actually applied, it
     * centred nothing, so a popup asked to go modal stayed hanging off its control.
     */
    readonly transform: string;
  };
}

/**
 * What this controller is told, in its own words.
 *
 * Declared standalone rather than extending the anchoring options: the contract calls two of these
 * `preferred` and `pointerX`, and this controller calls them `preferredPosition` and `clickX`.
 * Naming them here and translating at the one call site is honest about the difference; inheriting
 * and renaming would leave two half-matching vocabularies in the same type.
 */
interface OverlayStateConfig {
  /** Smallest usable space before the popup flips to the other side or goes modal. */
  readonly minSpace?: number;
  /** Narrowest the popup may be, whatever the anchor measures. */
  readonly minWidth?: number;
  /** Which side to try first. */
  readonly preferredPosition?: "above" | "below";
  /** Where the pointer opened it, so a popup follows the click rather than the element's centre. */
  readonly clickX?: number;
  /**
   * The decision this overlay is already holding, when it is open. The same door every other
   * renderer comes through: the coordinates follow the anchor while the shape stays as it was
   * decided.
   */
  readonly current?: MdyOverlayDecision | null;
  readonly widthMode?: "match-anchor" | "auto-content";
  /**
   * Take the modal placement whatever the room, because the host asked for it.
   *
   * Presentation only: where the popup sits, never what the field commits.
   */
  readonly forceModal?: boolean;
  /** The popup's own size, when the host has measured it, so it is placed where it shows whole. */
  readonly contentHeight?: number;
  readonly contentWidth?: number;
  /** The edge the widget's popup hangs from, as its contract declares it. */
  readonly alignment?: "left" | "right";
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
      decision: null,
      panelStyle: POPUP_STYLE,
      cssVars: { top: "auto", bottom: "auto", left: "auto", right: "auto", width: "auto", maxHeight: "50vh", maxWidth: "none", transform: "none" },
    };
  }

  // The anchoring is `anchorOverlay` in @modyra/widgets — the same call the framework-free renderer
  // makes — so this popup attaches exactly where any other one would. This function
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
      ...(config?.forceModal ? { forceModal: true } : {}),
      // The widget declares which *inline* edge its popup hangs from; only the live direction says
      // which physical edge that is.
      direction:
        anchorEl.ownerDocument.defaultView?.getComputedStyle(anchorEl).direction === "rtl"
          ? "rtl"
          : "ltr",
      pointerX: config?.clickX,
      // Measured by the controller when the panel is in the DOM: with it the popup goes where its
      // content shows whole, without it the minimum-space rule stands.
      contentHeight: config?.contentHeight,
      contentWidth: config?.contentWidth,
      // Declared by the widget: which corner its popup opens from is a property of the widget, not
      // of where its field sits on the page.
      alignment: config?.alignment,
      // An open overlay hands back the decision it is holding, so the popup keeps the shape it
      // opened with and only its coordinates follow the anchor.
      current: config?.current ?? null,
    },
  );

  // Names come from the contract, not from this file: the properties are what `anchorOverlay`
  // returned, and a literal here that drifted from a literal there would read the fallback for ever
  // while looking perfectly correct.
  const prop = MDY_CSS_PROPERTIES.overlay;
  const read = (name: string, fallback: string): string => anchoring.properties[name] ?? fallback;
  const cssVars = {
    top: read(prop.top, "auto"),
    bottom: read(prop.bottom, "auto"),
    left: read(prop.left, "auto"),
    right: read(prop.right, "auto"),
    width: read(prop.width, "auto"),
    maxHeight: read(prop.maxHeight, "50vh"),
    maxWidth: read(prop.maxWidth, "none"),
    transform: read(prop.transform, "none"),
  };
  const transform = cssVars.transform;
  const panelStyle =
    `${POPUP_STYLE};top:${cssVars.top};bottom:${cssVars.bottom};left:${cssVars.left};` +
    `right:${cssVars.right};width:${cssVars.width};max-height:${cssVars.maxHeight};` +
    `max-width:${cssVars.maxWidth};transform:${transform};`;

  return {
    position: anchoring.decision.placement,
    alignment: anchoring.decision.alignment,
    decision: anchoring.decision,
    panelStyle,
    cssVars,
  };
}

type OverlayHost = HTMLElement & { requestUpdate: () => void; updateComplete?: Promise<unknown> };

/**
 * What the popup's content wants, whatever the box is currently clamped to — `scrollHeight` and
 * `scrollWidth` answer exactly that. Returns null when nothing is laid out yet, because a guessed
 * size would be placed against as if it had been measured.
 */
function measurePopupContent(popup: HTMLElement | null | undefined): { height: number; width: number } | null {
  if (!popup || popup.hidden) return null;
  const height = popup.scrollHeight;
  const width = popup.scrollWidth;
  if (height === 0 && width === 0) return null;
  return {
    height: height + Math.max(0, popup.offsetHeight - popup.clientHeight),
    width: width + Math.max(0, popup.offsetWidth - popup.clientWidth),
  };
}

/**
 * Shared overlay tracker for Lit renderers.
 * Keeps canonical corner selection while open and follows scroll via locked corner coords.
 */
export class MdyLitOverlayController {
  private _state: OverlayPanelState = computeOverlayPanelState(undefined);
  private clickX: number | undefined;
  private active = false;
  private stopTracking: (() => void) | null = null;

  constructor(
    private readonly host: OverlayHost,
    // The popup attaches to the control, not to the field: anchoring on the host would measure the
    // label and supporting text too, and open the popup a row too low and a little too wide.
    private readonly getAnchor: () => HTMLElement | undefined = () =>
      host.querySelector<HTMLElement>(".mdy-input-wrapper") ?? host,
    private readonly config?: Pick<OverlayStateConfig, "minSpace" | "minWidth" | "preferredPosition" | "widthMode" | "alignment">,
    // The panel to measure. It is found by the class the widget catalog puts on every popup, so a
    // renderer needs no wiring for its popup to be placed where its content fits.
    private readonly getPopup: () => HTMLElement | null = () =>
      host.querySelector<HTMLElement>(`.${MDY_POPUP_CLASS}`),
  ) {}

  /** The popup's measured size, taken when it opens and held while it stays open. */
  private content: { height: number; width: number } | null = null;

  /**
   * The popup currently in the top layer, so it is put there once rather than on every frame.
   * A closing overlay renders `nothing` and the element goes with it, which is what removes it.
   */
  private shown: HTMLElement | null = null;

  /**
   * Whether the host asks for the modal placement whatever the room.
   *
   * Read structurally, like `widgetKind` beside it: a renderer states it and this controller carries
   * it to the contract, without either of them widening a public shape.
   */
  private forcesModal(): boolean {
    return (this.host as { forceModalPlacement?: () => boolean }).forceModalPlacement?.() === true;
  }

  /** The host widget's declared anchoring, in this controller's vocabulary. */
  private contractConfig(): Partial<OverlayStateConfig> {
    // Every Lit renderer declares the widget it draws. It is `protected`, so it is read
    // structurally rather than by widening the host type and making it part of the public shape.
    const kind = (this.host as { widgetKind?: MdyWidgetKind }).widgetKind;
    if (!kind) return {};
    const anchoring = overlayAnchoringFor(kind);
    if (anchoring.matchAnchorWidth === undefined) return {};
    return {
      ...(anchoring.minSpace !== undefined ? { minSpace: anchoring.minSpace } : {}),
      ...(anchoring.minWidth !== undefined ? { minWidth: anchoring.minWidth } : {}),
      ...(anchoring.alignment !== undefined ? { alignment: anchoring.alignment } : {}),
      widthMode: anchoring.matchAnchorWidth ? "match-anchor" : "auto-content",
    };
  }

  get state(): OverlayPanelState {
    return this._state;
  }

  open(event?: Event): void {
    const eventClickX = extractClickX(event);
    if (eventClickX !== undefined) this.clickX = eventClickX;
    const wasActive = this.active;
    this.active = true;
    this.refresh(true);
    // The panel is rendered by the update this opening triggers, so the first pass has nothing to
    // measure. Once it is in the DOM the placement is decided again — still the opening moment,
    // and now with the popup's real size rather than the minimum-space fallback.
    void this.host.updateComplete?.then(() => {
      if (this.active && this.content === null) this.refresh(true);
    });
    if (!wasActive) {
      // The contract's tracking, which keeps the two events apart: a page that scrolls moves the
      // anchor and the popup follows with the corner it opened on, while a viewport that changes
      // size changes what fits and the corner is chosen again.
      this.stopTracking = trackAnchoredOverlay({
        isOpen: () => this.active,
        reposition: () => this.refresh(false),
        reflow: () => this.refresh(true),
      });
    }
  }

  close(): void {
    this.active = false;
    this.clickX = undefined;
    // The next opening measures afresh: the content it holds may be nothing like this one's.
    this.content = null;
    // Taken out of the top layer explicitly rather than left to the element's removal, because a
    // renderer that keeps its popup in the DOM would otherwise leave a closed popup showing.
    if (this.shown) {
      setOverlayOpen(this.shown, false);
      this.shown = null;
    }
    this.stopTracking?.();
    this.stopTracking = null;
  }

  refresh(reselectCorner = true): void {
    const anchor = this.getAnchor();
    if (!anchor) return;
    // Measured once, when the panel first exists; re-measuring while open would feed the clamped
    // box back into the decision that clamped it.
    this.content ??= measurePopupContent(this.getPopup());
    this._state = computeOverlayPanelState(anchor, {
      // The widget's own anchoring, from the catalog: how much room its popup wants, how wide it
      // is and which edge it hangs from. A renderer that overrides one of these says so explicitly
      // below, rather than by holding a number of its own.
      ...this.contractConfig(),
      ...this.config,
      ...(this.forcesModal() ? { forceModal: true } : {}),
      clickX: reselectCorner ? this.clickX : undefined,
      // Deciding afresh is what opening and resizing are; a scroll frame holds what it has. The
      // popup therefore keeps its size while the anchor moves and changes side only once the side
      // it opened on has genuinely stopped fitting — the policy every other renderer already follow.
      current: reselectCorner ? null : this._state.decision,
      ...(this.content ? { contentHeight: this.content.height, contentWidth: this.content.width } : {}),
    });

    const prop = MDY_CSS_PROPERTIES.overlay;
    this.host.style.setProperty(prop.top, this._state.cssVars.top);
    this.host.style.setProperty(prop.bottom, this._state.cssVars.bottom);
    this.host.style.setProperty(prop.left, this._state.cssVars.left);
    this.host.style.setProperty(prop.right, this._state.cssVars.right);
    this.host.style.setProperty(prop.width, this._state.cssVars.width);
    this.host.style.setProperty(prop.maxHeight, this._state.cssVars.maxHeight);
    // The popup is sized from its content, so the width it may take has to reach the element too:
    // without it a content-sized popup near the edge of the screen shows half off it.
    this.host.style.setProperty(prop.maxWidth, this._state.cssVars.maxWidth);
    // The modal placement centres by putting the popup's corner at the middle of the viewport and
    // pulling it back by half its own size. Without this the first half happened and the second did
    // not, so asking for the modal placement moved the popup nowhere.
    this.host.style.setProperty(prop.transform, this._state.cssVars.transform);
    // The popup joins the top layer as soon as it exists. The coordinates written above are
    // viewport coordinates, and a `position: fixed` box only honours those while no ancestor is a
    // containing block for fixed descendants — which `container-type` on the form makes every
    // ancestor of every field. This was the last adapter still laying its popups out in the page.
    //
    // Once per popup, not once per frame: `refresh` runs on every scroll frame, and `showPopover`
    // throws on an element already showing.
    const popup = this.getPopup();
    if (popup && popup !== this.shown) {
      setOverlayOpen(popup, true);
      this.shown = popup;
    }
    this.host.requestUpdate();
  }
}

export interface RenderOverlayPanelOptions {
  /** When true the panel has a backdrop and emits `--modal`. */
  modal?: boolean;
  /** Horizontal alignment of the panel, emits `--right` when `'right'`. */
  alignment?: "left" | "right";
  /** Explicit position class when already computed by the caller/controller. */
  position?: MdyOverlayPlacement;
  /** Inline style for fixed-panel mode. */
  panelStyle?: string;
  /** Use display:contents wrapper so positioning is delegated to inner content. */
  panelDisplayContents?: boolean;
}

/**
 * The overlay panel markup, in this renderer's idiom.
 *
 * It does **not** reflect the placement. This wrapper is a marker, not a box — it lays nothing out
 * (`display: contents`) — so a placement class here would style nothing however correctly it was
 * spelled, which is what `mdy-overlay-panel--above` and `--overlay` were: names matched by no
 * stylesheet, on an element with no geometry. The placement belongs on the popup part inside, where
 * `popupPlacementClass` puts it and where the foundation's rules are keyed.
 */
export function renderOverlayPanel(
  content: unknown,
  open: boolean,
  options?: RenderOverlayPanelOptions,
): unknown {
  if (!open) return nothing;
  const modalClass = options?.modal ? " mdy-overlay-panel--modal" : "";
  // No alignment class here. This wrapper is `display: contents` and lays nothing out, so a class on
  // it styles nothing however it is spelled — the same reasoning that moved `--above` off it. The
  // edge belongs on the popup part inside, under the name the catalog gives it, which is what
  // `popupAlignmentClass` answers.
  const rightClass = "";
  // The panel is a marker, not a box: it lays nothing out (`display: contents`), so the popup part
  // inside it is the single container — the same one every renderer portals and a host-projected panel wrular projects. Two nested
  // positioned boxes is what put a Lit popup 35px below where its anchor said it belonged.
  return html`
    <div class="mdy-overlay-backdrop"></div>
    <div
      class="mdy-overlay-panel mdy-overlay-panel--visible${modalClass}${rightClass}"
      style="display: contents"
    >
      ${content}
    </div>
  `;
}

/** The catalog's placement class for a popup, re-exported so a field component has one import. */
export { popupPlacementClass };
