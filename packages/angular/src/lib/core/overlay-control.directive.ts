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
  computeCoordsForAnchor,
  ComputedPosition,
  OverlayAlignment,
  OverlayAnchor,
  OverlayPosition,
} from "@modyra/core/overlay-position";
import {
  decideOverlayPlacement,
  overlayLifecycleTransition,
  type MdyOverlayLifecycleIntent,
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

  /** Minimum space required below or above to anchor the overlay. Default 128px. */
  protected readonly minSpace: number = 128;

  /** Preferred vertical position. Defaults to 'below'. */
  protected readonly preferredPosition: "above" | "below" = "below";


  /** Widgets owns placement/collision policy; Angular only supplies measured geometry. */
  private decidePlacement(clickX?: number) {
    const rect = this.anchor instanceof HTMLElement ? this.anchor.getBoundingClientRect() : this.anchor;
    return decideOverlayPlacement({
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      anchorLeft: rect.left,
      anchorRight: rect.right,
      anchorWidth: rect.width,
      minSpace: this.minSpace,
      minWidth: this.minWidth(),
      preferred: this.preferredPosition,
      ...(clickX !== undefined ? { pointerX: clickX } : {}),
    });
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


    const decision = this.decidePlacement(clickX);
    this.position.set(decision.placement);
    this.alignment.set(decision.alignment);
    this.coords.set(computeCoordsForAnchor(this.anchor, decision.placement, decision.alignment));
    this.open.set(transition.state.open);

    this.maxHeight.set(decision.maxHeight);

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

  protected readonly handleScroll = () => {
    if (!this.open()) return;
    if (this.scrollFrameId !== null) cancelAnimationFrame(this.scrollFrameId);
    this.scrollFrameId = requestAnimationFrame(() => {
      this.scrollFrameId = null;
      const pos = this.position();
      const align = this.alignment();
      // Update coords to follow the anchor, and recalculate maxHeight so the panel
      // doesn't overflow the viewport if the trigger scrolls near the edges.
      const newCoords = computeCoordsForAnchor(this.anchor, pos, align);
      this.coords.set(newCoords);
      this.maxHeight.set(this.computeMaxHeight(pos, newCoords));
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

  /** Computes max-height for the overlay given a resolved position and coords. */
  private computeMaxHeight(position: OverlayPosition, coords: ComputedPosition["coords"]): number {
    const vh = document.documentElement.clientHeight;
    let mh: number;
    if (position === "below" && coords.top !== undefined) {
      const vSpace = vh - coords.top - 12;
      mh = Math.max(vSpace, this.minSpace);
    } else if (position === "above" && coords.bottom !== undefined) {
      const vSpace = vh - coords.bottom - 12;
      mh = Math.max(vSpace, this.minSpace);
    } else {
      mh = Math.round(vh * 0.7); // centered modal: 70vh
    }
    return Math.max(0, mh);
  }

  /** Recalculates the position of the currently open overlay. */
  protected updatePosition(): void {
    if (!this.open()) return;

    const prevPosition = this.position();

    const decision = this.decidePlacement();
    this.position.set(decision.placement);
    this.alignment.set(decision.alignment);
    this.coords.set(computeCoordsForAnchor(this.anchor, decision.placement, decision.alignment));
    this.maxHeight.set(decision.maxHeight);

    // If position changed between overlay and anchored, manage scroll listener
    const wasOverlay = prevPosition === "overlay";
    const isOverlay = decision.placement === "overlay";
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
