import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import {
  ComputedPosition,
  OverlayAlignment,
  OverlayAnchor,
  OverlayPosition,
} from "@modyra/core/overlay-position";
import {
  anchorOverlay,
  overlayAnchoringFor,
  overlayLifecycleTransition,
  type MdyOverlayDecision,
  type MdyOverlayLifecycleIntent,
  type MdyWidgetKind,
} from "@modyra/widgets";
import { MdyBaseControl } from "../control/control.directive";
import { MdyA11yAnnouncer } from "./a11y-announcer";
import { MDY_I18N_MESSAGES } from "./i18n";


/**
 * Abstract base class for components that have an overlay popup (select, pickers).
 *
 * Handles:
 * - Open/close state management via `open` signal.
 * - Dynamic positioning (above/below/overlay) via `computeOverlayPosition`.
 * - Outside click detection to close the popup.
 * - `wrapper` viewChild for position calculations.
 */
@Directive({
  host: {
    "[class.mdy-renderer--open]": "open()",
  },
})
export abstract class MdyOverlayControl<TValue> extends MdyBaseControl<TValue> {
  /** Signal tracking if the overlay is currently open. */
  protected readonly open = signal(false);

  /** Computed position of the overlay (below, above, or fixed overlay for mobile). */
  protected readonly position = signal<OverlayPosition>("below");

  /** Computed alignment of the overlay (left, right). */
  protected readonly alignment = signal<OverlayAlignment>("left");

  /** Whether the overlay should match the anchor width or expand based on content. */
  readonly widthMode = input<"match-anchor" | "auto-content">("match-anchor");

  /** Minimum horizontal space required for the overlay. Default 250px. */
  readonly minWidth = input<number>(250);

  /** Viewport coordinates for fixed positioning. */
  protected readonly coords = signal<ComputedPosition["coords"]>({ width: 0 });
  /** The anchoring decision an open overlay is holding; cleared when it closes. */
  private heldDecision: MdyOverlayDecision | null = null;

  /**
   * Max-height of the overlay panel in px, frozen at open time.
   * Set once in openOverlay(), never updated during scroll.
   * Exposed as --mdy-overlay-max-height on the host.
   */
  protected readonly maxHeight = signal(0);

  /** The wrapper element used to anchor the overlay and detect outside clicks. */
  protected readonly wrapperRef = viewChild<ElementRef<HTMLElement>>("wrapper");

  /** Reference to the host element for position calculation. */
  protected readonly hostRef = inject(ElementRef<HTMLElement>);

  protected readonly announcer = inject(MdyA11yAnnouncer);
  private readonly overlayI18n = inject(MDY_I18N_MESSAGES);

  constructor() {
    super();
    // Remove global listeners if the component is destroyed while open.
    inject(DestroyRef).onDestroy(() => this.applyLifecycle({ type: "destroy" }));
  }

  /**
   * Override to provide a custom anchor for overlay positioning.
   *
   * - Return an `HTMLElement` for live rect computation + scroll-aware space.
   * - Return a `DOMRect` for a virtual/custom anchor area (viewport-only space).
   * - Return `null` (default) to use the host element.
   *
   * @example
   * // Anchor to a specific inner element instead of the whole host:
   * protected override overlayAnchor(): OverlayAnchor | null {
   *   return this.inputRef()?.nativeElement ?? null;
   * }
   *
   * @example
   * // Anchor to a custom area:
   * protected override overlayAnchor(): OverlayAnchor | null {
   *   return new DOMRect(x, y, width, height);
   * }
   */
  protected overlayAnchor(): OverlayAnchor | null {
    return null;
  }

  private get anchor(): OverlayAnchor {
    return this.overlayAnchor() ?? this.wrapperRef()?.nativeElement ?? this.hostRef.nativeElement;
  }

  /**
   * Toggles the overlay state.
   * Pass the triggering UIEvent (mouse, touch, keyboard) so the popup can
   * anchor to the correct corner and resolve the scroll ancestor via event.target.
   */
  protected toggleOverlay(event?: Event): void {
    if (this.open()) {
      this.applyLifecycle({ type: "toggle", disabled: this.isDisabled(), available: typeof window !== "undefined" });
    } else {
      this.openOverlay(event);
    }
  }

  /**
   * The widget this control draws, when it is one the catalog knows.
   *
   * Declaring it is what makes the anchoring come from `@modyra/widgets` — how much room the popup
   * wants, how wide it is and which edge it hangs from — instead of from numbers held here. A
   * control that leaves it unset keeps the defaults below.
   */
  protected readonly overlayKind: MdyWidgetKind | null = null;

  /** Minimum space required below or above to anchor the overlay. Default 128px. */
  protected readonly minSpace: number = 128;

  /** Preferred vertical position. Defaults to 'below'. */
  protected readonly preferredPosition: "above" | "below" = "below";


  /**
   * The popup's own size, measured when it opens and held while it stays open.
   *
   * `scrollHeight`/`scrollWidth` report what the content wants whatever `max-height` is currently
   * clamping the panel to, which is the question placement has to answer. Re-measuring on every
   * scroll frame would feed the clamped box back into the decision that clamped it.
   */
  private panelContent: { height: number; width: number } | null = null;

  private measurePanel(): { height: number; width: number } | null {
    const host = this.hostRef.nativeElement as HTMLElement;
    const panel = host.querySelector<HTMLElement>(".mdy-overlay-panel");
    if (!panel) return null;
    const height = panel.scrollHeight;
    const width = panel.scrollWidth;
    if (height === 0 && width === 0) return null;
    return {
      height: height + Math.max(0, panel.offsetHeight - panel.clientHeight),
      width: width + Math.max(0, panel.offsetWidth - panel.clientWidth),
    };
  }

  /**
   * Widgets owns anchoring; Angular only supplies measured geometry and applies what comes back.
   * `current` carries the decision an open overlay is already holding, so following the anchor
   * during scroll does not re-decide its side or height.
   */
  private anchorNow(clickX?: number, current?: MdyOverlayDecision | null) {
    const rect = this.anchor instanceof HTMLElement ? this.anchor.getBoundingClientRect() : this.anchor;
    const content = this.panelContent;
    const anchoring = anchorOverlay(
      rect,
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      {
        minSpace: this.minSpace,
        minWidth: this.minWidth(),
        preferred: this.preferredPosition,
        matchAnchorWidth: true,
        // The widget's own anchoring wins over the defaults above: those are what a control falls
        // back to when the catalog does not know it, not a decision it gets to keep making.
        ...(this.overlayKind ? overlayAnchoringFor(this.overlayKind) : {}),
        ...(clickX !== undefined ? { pointerX: clickX } : {}),
        ...(current ? { current } : {}),
        // With the panel measured the popup goes where its content shows whole; before it is in the
        // DOM there is nothing to measure, and the minimum-space rule stands for that one frame.
        ...(content ? { contentHeight: content.height, contentWidth: content.width } : {}),
      },
    );
    const px = (name: string): number | undefined => {
      const raw = anchoring.properties[name];
      return raw === undefined || raw === "auto" ? undefined : Number.parseFloat(raw);
    };
    return {
      decision: anchoring.decision,
      coords: { top: px("--mdy-overlay-top"), bottom: px("--mdy-overlay-bottom"), left: px("--mdy-overlay-left"), right: px("--mdy-overlay-right"), width: rect.width, maxWidth: px("--mdy-overlay-max-width") },
      maxHeight: px("--mdy-overlay-max-height") ?? anchoring.decision.maxHeight,
    };
  }

  protected openOverlay(event?: Event): void {
    const transition = overlayLifecycleTransition(
      { open: this.open() },
      { type: "open", disabled: this.isDisabled(), available: typeof window !== "undefined" },
    );
    if (transition.effect !== "setup") return;
    this.onBeforeOpen();

    // Extract horizontal coordinate for corner selection:
    // mouse → clientX; touch → first touch point; keyboard → undefined (falls back to center).
    let clickX: number | undefined;
    if (event instanceof MouseEvent) {
      clickX = event.clientX;
    } else if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      clickX = event.touches[0]?.clientX;
    }


    const anchored = this.anchorNow(clickX);
    const decision = anchored.decision;
    this.position.set(decision.placement);
    this.alignment.set(decision.alignment);
    this.coords.set(anchored.coords);
    this.open.set(transition.state.open);

    this.maxHeight.set(anchored.maxHeight);
    this.heldDecision = decision;

    // The panel is rendered by the change detection this opening triggers, so the placement above
    // was taken without knowing how tall the popup is. Once it exists it is measured and the
    // placement decided again — still the opening moment, and now able to put the popup where its
    // content shows whole rather than merely where there was room.
    this.remeasureFrameId = requestAnimationFrame(() => {
      this.remeasureFrameId = null;
      if (!this.open()) return;
      this.panelContent = this.measurePanel();
      if (this.panelContent === null) return;
      const remeasured = this.anchorNow(clickX);
      this.position.set(remeasured.decision.placement);
      this.alignment.set(remeasured.decision.alignment);
      this.coords.set(remeasured.coords);
      this.maxHeight.set(remeasured.maxHeight);
      this.heldDecision = remeasured.decision;
    });

    if (transition.announce === "opened") this.announcer.announce(this.overlayI18n.overlayOpened);

    this.setupGlobalListeners();

    // Non-modal overlays follow the container during scroll,
    // keeping the same corner chosen at open time.
    if (decision.placement !== "overlay") {
      window.addEventListener("scroll", this.handleScroll, { capture: true, passive: true });
    }
    window.addEventListener("resize", this.handleResize);
  }

  private scrollFrameId: number | null = null;
  private resizeFrameId: number | null = null;
  private remeasureFrameId: number | null = null;

  protected readonly handleScroll = () => {
    if (!this.open()) return;
    if (this.scrollFrameId !== null) cancelAnimationFrame(this.scrollFrameId);
    this.scrollFrameId = requestAnimationFrame(() => {
      this.scrollFrameId = null;
      // Follow the anchor while keeping the shape the overlay opened with: re-deciding on every
      // scroll frame is what makes a popup flip sides and resize under the pointer.
      const anchored = this.anchorNow(undefined, this.heldDecision);
      this.coords.set(anchored.coords);
      this.maxHeight.set(anchored.maxHeight);
    });
  };

  protected readonly handleResize = () => {
    if (!this.open()) return;
    // Debounce resize with RAF to avoid excessive calculations
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId);
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null;
      // Recalculate position + maxHeight to adapt to new viewport dimensions.
      // This fixes orientation change (portrait ↔ landscape) closing the overlay.
      this.updatePosition();
    });
  };


  /** Recalculates the position of the currently open overlay. */
  protected updatePosition(): void {
    if (!this.open()) return;

    const prevPosition = this.position();

    const anchored = this.anchorNow(undefined, this.heldDecision);
    this.position.set(anchored.decision.placement);
    this.alignment.set(anchored.decision.alignment);
    this.coords.set(anchored.coords);
    this.maxHeight.set(anchored.maxHeight);
    this.heldDecision = anchored.decision;

    // If position changed between overlay and anchored, manage scroll listener
    const wasOverlay = prevPosition === "overlay";
    const isOverlay = anchored.decision.placement === "overlay";
    if (!wasOverlay && isOverlay) {
      window.removeEventListener("scroll", this.handleScroll, true);
    } else if (wasOverlay && !isOverlay) {
      window.addEventListener("scroll", this.handleScroll, { capture: true, passive: true });
    }
  }

  /** Closes the overlay. */
  protected closeOverlay(restoreFocus = false): void {
    this.applyLifecycle({ type: "close", restoreFocus });
  }

  private applyLifecycle(intent: MdyOverlayLifecycleIntent): void {
    const transition = overlayLifecycleTransition({ open: this.open() }, intent);
    if (transition.effect === "none") return;
    this.open.set(transition.state.open);
    if (transition.effect === "setup") this.setupGlobalListeners();
    if (transition.effect === "teardown") this.teardownGlobalListeners();
    if (transition.announce === "opened") this.announcer.announce(this.overlayI18n.overlayOpened);
    if (transition.announce === "closed") this.announcer.announce(this.overlayI18n.overlayClosed);
    if (transition.restoreFocus) this.restoreOverlayTriggerFocus();
  }

  /** Hosts may override when their trigger is not the first interactive element. */
  protected restoreOverlayTriggerFocus(): void {
    this.wrapperRef()?.nativeElement.querySelector<HTMLElement>("button, input, [tabindex='0']")?.focus();
  }

  private setupGlobalListeners(): void {
    if (typeof window === "undefined") return;
    document.addEventListener("click", this.handleDocumentClick);
    document.addEventListener("keydown", this.handleDocumentKeydown);
  }

  /** Removes all document/window listeners registered while open. */
  private teardownGlobalListeners(): void {
    if (typeof window === "undefined") return;
    document.removeEventListener("click", this.handleDocumentClick);
    document.removeEventListener("keydown", this.handleDocumentKeydown);
    window.removeEventListener("scroll", this.handleScroll, true);
    window.removeEventListener("resize", this.handleResize);
    if (this.scrollFrameId !== null) {
      cancelAnimationFrame(this.scrollFrameId);
      this.scrollFrameId = null;
    }
    if (this.resizeFrameId !== null) {
      cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = null;
    }
    if (this.remeasureFrameId !== null) {
      cancelAnimationFrame(this.remeasureFrameId);
      this.remeasureFrameId = null;
    }
    // The next opening measures afresh: the popup may hold nothing like what this one held.
    this.panelContent = null;
  }

  /**
   * Hook called just before the overlay opens.
   * Useful for syncing draft values or search queries.
   */
  protected onBeforeOpen(): void { /* no-op by default — subclasses override */ }

  /** Bound handler registered on document only while the overlay is open (B31). */
  private readonly handleDocumentClick = (event: Event): void =>
    this.onDocumentClick(event);

  /** Escape closes the open overlay regardless of where focus is (R19). */
  private readonly handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.applyLifecycle({ type: "escape" });
  };

  /**
   * Handler for document clicks while the overlay is open.
   * Closes the overlay if the click is outside the wrapper element.
   */
  protected onDocumentClick(event: Event): void {
    const el = this.wrapperRef()?.nativeElement;
    this.applyLifecycle({
      type: "outside",
      outside: Boolean(el && !el.contains(event.target as Node)),
    });
  }
}
