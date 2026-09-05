import { inlineDirectionOf, keyMeans, MDY_POPUP_OPENERS, measureOverlayContent, partClasses, projectOverlayOpenerA11y, viewportSize, type MdyPartContract, keyBindingFor } from "@modyra/widgets";
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
  anchorOverlay,
  createFocusCustodian,
  createLightDismiss,
  portalRootFor,
  type MdyOverlayBranch,
  overlayAnchoringFor,
  overlayLifecycleTransition,
  MDY_CSS_PROPERTIES,
  type MdyOverlayAlignment,
  type MdyOverlayCoords,
  type MdyOverlayPlacement,
  type MdyOverlayDecision,
  type MdyOverlayLifecycleIntent,
  type MdyWidgetKind,
  type MdyWidgetPart,
  trackAnchoredOverlay,
  bindLightDismiss,
  MDY_WIDGET_CONTRACTS,
} from "@modyra/widgets";
import { MdyBaseControl } from "../control/control.directive";

export type { MdyOverlayBranch };

/**
 * The half of a widget controller that owns whether its popup is open.
 *
 * Structural rather than the controller's own type: five kinds answer this with five different
 * intent unions, and what the overlay needs from all of them is the same two members.
 */
export interface MdyOverlayOwner {
  state(): { readonly open: boolean };
  dispatch(intent: { readonly type: "open" } | { readonly type: "close" }): unknown;
}
import { MdyA11yAnnouncer } from "./a11y-announcer";
import { MDY_I18N_MESSAGES } from "./i18n";


/**
 * Abstract base class for components that have an overlay popup (select, pickers).
 *
 * Handles:
 * - Open/close state management via `open` signal.
 * - Dynamic positioning (above/below/overlay) via ``anchorOverlay``.
 * - Outside click detection to close the popup.
 * - `wrapper` viewChild for position calculations.
 */
@Directive({
  host: {
    "[class.mdy-renderer--open]": "open()",
    "(keydown)": "closeOnDeclaredKey($event)",
  },
})
export abstract class MdyOverlayControl<TValue> extends MdyBaseControl<TValue> {
  /**
   * Where "is this popup open" lives when nothing else owns it.
   *
   * A kind whose controller owns the state overrides the pair below and this cell is never read;
   * `select` has no controller and keeps it.
   */
  private readonly localOpen = signal(false);

  /**
   * Whether the overlay is open, read from wherever this kind's state lives.
   *
   * A method rather than a `computed`, and the difference is not style. A `computed` evaluated
   * before the controller exists — which happens whenever a `name` has not yet resolved to a field
   * — would depend on nothing that ever changes again and would answer "closed" for the life of the
   * component. A method is re-read by each change detection pass, and every read inside it is
   * tracked by the caller's own reactive context, so the dependency is on the cell that actually
   * holds the answer.
   */
  /**
   * What a second element that opens the same overlay carries.
   *
   * The control's own projection minus the role: a combobox is the element that **holds the value**,
   * and an icon button beside it, or the second half of a range, opens the popup without being one.
   * Everything else is the same statement about the same overlay — the promise, whether it is open,
   * and what it controls — so it is read from the same place rather than written at each opener.
   */
  protected openerButtonPart(): MdyPartContract {
    const projected = projectOverlayOpenerA11y(this.widgetKind, {
      widgetId: this.fieldId,
      open: this.open(),
    });
    if (projected === null) return { classes: [], attributes: {} };
    const { role: _role, ...withoutRole } = projected;
    return withoutRole;
  }

  /**
   * What an element beside the opener says about the overlay, which is nothing.
   *
   * `aria-haspopup` is a statement a textbox is allowed to make, and it is still a promise: it tells
   * a person operating that control that a popup opens from it. The catalogue names one opener per
   * kind, and for a range that opener is the toggle — the text inputs answer no key the contract
   * declares and no pointer, so the promise on them named a popup they cannot open. `aria-expanded`
   * and `aria-controls` were never theirs either: ARIA permits those on a combobox, and an input
   * carrying the whole projection is a critical `aria-allowed-attr` violation.
   */
  protected popupPromisePart(): MdyPartContract {
    return { classes: [], attributes: {} };
  }

  protected open(): boolean {
    return this.isOverlayOpen();
  }

  /**
   * The controller that owns this kind's open state, when one does.
   *
   * The widget contract owns the rule that a field leaving play closes its popup, and it expresses
   * that rule by writing the controller's own `open`. A renderer that keeps a second cell and
   * paints from it does not disobey the rule so much as never hear it: the contract's write lands
   * somewhere nothing renders. Naming the controller here is how a kind says that cell is the
   * state; a kind with no controller says nothing and keeps the local one.
   */
  protected overlayOwner(): MdyOverlayOwner | undefined {
    return undefined;
  }

  protected isOverlayOpen(): boolean {
    return this.overlayOwner()?.state().open ?? this.localOpen();
  }

  protected setOverlayOpen(open: boolean): void {
    const owner = this.overlayOwner();
    if (!owner) {
      this.localOpen.set(open);
      return;
    }
    owner.dispatch(open ? { type: "open" } : { type: "close" });
  }

  /** Computed position of the overlay (below, above, or fixed overlay for mobile). */
  protected readonly position = signal<MdyOverlayPlacement>("below");

  /** Computed alignment of the overlay (left, right). */
  protected readonly alignment = signal<MdyOverlayAlignment>("left");

  /** Whether the overlay should match the anchor width or expand based on content. */
  readonly widthMode = input<"match-anchor" | "auto-content">("match-anchor");

  /** Minimum horizontal space required for the overlay. Default 250px. */
  readonly minWidth = input<number>(250);

  /** Viewport coordinates for fixed positioning. */
  protected readonly coords = signal<MdyOverlayCoords>({ width: 0 });
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

  /**
   * Who held focus before this overlay took it.
   *
   * The widget contract's rule rather than this directive's: focus is borrowed, and a move that is
   * not taken did not happen. Three kinds here used to dismiss onto `<body>` because the restore
   * aimed at an element the close had already removed, and `focus()` fails silently.
   */
  private readonly focus = createFocusCustodian(
    () => this.wrapperRef()?.nativeElement ?? this.hostRef.nativeElement ?? null,
  );

  protected readonly announcer = inject(MdyA11yAnnouncer);
  private readonly overlayI18n = inject(MDY_I18N_MESSAGES);

  constructor() {
    super();
    // Remove global listeners if the component is destroyed while open.
    inject(DestroyRef).onDestroy(() => {
      this.applyLifecycle({ type: "destroy" });
      this.focus.release();
    });
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
   * protected override overlayAnchor(): HTMLElement | DOMRect | null {
   *   return this.inputRef()?.nativeElement ?? null;
   * }
   *
   * @example
   * // Anchor to a custom area:
   * protected override overlayAnchor(): HTMLElement | DOMRect | null {
   *   return new DOMRect(x, y, width, height);
   * }
   */
  protected overlayAnchor(): HTMLElement | DOMRect | null {
    return null;
  }

  private get anchor(): HTMLElement | DOMRect {
    return this.overlayAnchor() ?? this.wrapperRef()?.nativeElement ?? this.hostRef.nativeElement;
  }

  /**
   * Toggles the overlay state.
   * Pass the triggering UIEvent (mouse, touch, keyboard) so the popup can
   * anchor to the correct corner and resolve the scroll ancestor via event.target.
   */
  /**
   * The keys that open this kind, read from the table rather than named here.
   *
   * A control that binds one key by name answers that key and no other: this adapter's timepicker
   * opened on `ArrowDown` alone and its datepicker on nothing at all, while the same document on the
   * other two renderers opened on `Enter` — one control, different keys depending on which adapter
   * drew it. `MDY_WIDGET_KEYBOARD` already says which keys open which kind, including that a typeable
   * opener does not claim `Space`, and a binding gained upstream reaches this without an edit.
   */
  protected openOnDeclaredKey(event: KeyboardEvent): void {
    if (this.open() || this.overlayKind === null) return;
    if (!keyMeans(this.overlayKind, event, "open", false)) return;
    event.preventDefault();
    this.openOverlay(event);
  }

  /**
   * Tab out of an open popup, which the contract says closes it.
   *
   * `MDY_WIDGET_KEYBOARD` declares `Tab@open: cancel` beside `Escape@open: cancel`, and the pair
   * differ in one thing: Escape puts the person back where they were, Tab lets them carry on
   * forward. Both close. A popup left open under Tab still has the keys, so the next Tab walks its
   * internals — a calendar cell, then the next cell — and someone who meant to leave the field is
   * inside it with no sign that the way out is a different key.
   *
   * Asked of the contract rather than listed here: a kind with an actions bar has a confirm button
   * inside its overlay that Tab has to be able to reach, and those kinds declare no such binding.
   * The key keeps its native meaning either way — the browser carries focus onward, and cancelling
   * it would strand the person in a panel being torn down.
   */
  protected closeOnDeclaredKey(event: KeyboardEvent): void {
    if (!this.open() || this.overlayKind === null || event.key !== "Tab") return;
    if (!keyMeans(this.overlayKind, event, "cancel", true)) return;
    this.closeOverlay();
  }

  /**
   * A pointer on the control the table names as this kind's opener.
   *
   * `MDY_POPUP_OPENERS` says which part a person operates to open a popup, and for the two typeable
   * pickers that part is the field's own control rather than the button beside it. Answering the
   * button alone left the larger target — the box a person clicks to fill the field in — doing
   * nothing, on kinds whose contract says it opens the picker.
   *
   * Opens only. Clicking inside an open picker's input is a person putting the caret somewhere, not
   * asking for the panel to go away.
   */
  protected openFromControl(): void {
    if (this.open() || this.overlayKind === null) return;
    if (MDY_POPUP_OPENERS[this.overlayKind]?.opener !== "control") return;
    this.openOverlay();
  }

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
  /**
   * What a control falls back to when the catalogue does not know it.
   *
   * Not an override point any more. Four renderers carried their own number here — 450 three times
   * and 250 once — beside a spread of `overlayAnchoringFor` that lands *after* them and wins, so the
   * literals decided nothing and read as though they did. A number that looks authoritative and is
   * shadowed is worse than no number: the next reader changes it and nothing moves.
   */
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

  private measurePanel(): { readonly height: number; readonly width: number } | null {
    const host = this.hostRef.nativeElement as HTMLElement;
    return measureOverlayContent(host.querySelector<HTMLElement>(".mdy-overlay-panel"));
  }

  /**
   * Widgets owns anchoring; Angular only supplies measured geometry and applies what comes back.
   * `current` carries the decision an open overlay is already holding, so following the anchor
   * during scroll does not re-decide its side or height.
   */
  /**
   * Whether this control asks for the modal placement whatever the room.
   *
   * A presentation choice and nothing else: the value contract says what a field commits and when,
   * and where its popup sits never changes that. A control that wants it overrides this.
   */
  protected forceModalPlacement(): boolean {
    return false;
  }

  private anchorNow(clickX?: number, current?: MdyOverlayDecision | null) {
    const rect = this.anchor instanceof HTMLElement ? this.anchor.getBoundingClientRect() : this.anchor;
    const content = this.panelContent;
    const anchoring = anchorOverlay(
      rect,
      viewportSize(document),
      {
        minSpace: this.minSpace,
        minWidth: this.minWidth(),
        preferred: this.preferredPosition,
        matchAnchorWidth: true,
        // The widget declares which *inline* edge its popup hangs from; only the live direction
        // says which physical edge that is.
        direction: this.overlayDirection(),
        // The widget's own anchoring wins over the defaults above: those are what a control falls
        // back to when the catalog does not know it, not a decision it gets to keep making.
        ...(this.overlayKind ? overlayAnchoringFor(this.overlayKind) : {}),
        ...(this.forceModalPlacement() ? { forceModal: true } : {}),
        ...(clickX !== undefined ? { pointerX: clickX } : {}),
        ...(current ? { current } : {}),
        // With the panel measured the popup goes where its content shows whole; before it is in the
        // DOM there is nothing to measure, and the minimum-space rule stands for that one frame.
        ...(content ? { contentHeight: content.height, contentWidth: content.width } : {}),
      },
    );
    // Angular positions its panel through the CDK rather than through the custom properties, so it
    // reads the numbers back out of what the policy returned. The names come from the contract: a
    // literal that drifted would read `undefined` here and put the panel at the origin.
    const prop = MDY_CSS_PROPERTIES.overlay;
    const px = (name: string): number | undefined => {
      const raw = anchoring.properties[name];
      return raw === undefined || raw === "auto" ? undefined : Number.parseFloat(raw);
    };
    const maxHeight = px(prop.maxHeight) ?? anchoring.decision.maxHeight;
    return {
      decision: anchoring.decision,
      // The placement and the height travel with the coordinates. A modal is centred rather than
      // hung off a control, and that is not expressible as an inset — carrying the placement is what
      // lets the contract serialise it instead of each host inventing the centring for itself.
      coords: {
        top: px(prop.top), bottom: px(prop.bottom), left: px(prop.left), right: px(prop.right),
        // The width the policy decided, not the anchor's own. A kind may declare a floor — a
        // multiselect's panel says 160px — and the policy answers `max(anchor, floor)`; reading the
        // rect back instead threw that away, so beside a 100px field the panel was 100px and the
        // floor it declares did nothing. The floor is only visible on a narrow field, which is why
        // it went unnoticed: on a wide one, honouring it and never reading it look identical.
        width: px(prop.width) ?? anchoring.decision.width,
        maxWidth: px(prop.maxWidth),
        maxHeight, placement: anchoring.decision.placement,
      },
      maxHeight,
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
    this.setOverlayOpen(transition.state.open);

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

    this.startTracking();
  }

  private remeasureFrameId: number | null = null;
  private stopTracking: (() => void) | null = null;

  /**
   * Follows the anchor while the page moves under it, through the contract's own tracking.
   *
   * The two events are not the same question and this renderer had always known it: scrolling moves
   * the anchor and nothing else, so the overlay keeps the side and height it opened with, while a
   * viewport that changes size changes what fits and the decision is taken again.
   */
  private startTracking(): void {
    this.stopTracking?.();
    this.stopTracking = trackAnchoredOverlay({
      isOpen: () => this.open(),
      reposition: () => {
        const anchored = this.anchorNow(undefined, this.heldDecision);
        this.coords.set(anchored.coords);
        this.maxHeight.set(anchored.maxHeight);
      },
      // Orientation changes are resizes, and an overlay that only repositioned through them closed.
      reflow: () => this.updatePosition(),
      // An overlay that covers the viewport hangs off no control, so it has no anchor to follow.
      followsScroll: () => this.position() !== "overlay",
    });
  }


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

    // Crossing between covering the viewport and hanging off the control changes whether there is
    // an anchor to follow at all, so the tracking is bound again for the answer it now gives.
    if ((prevPosition === "overlay") !== (anchored.decision.placement === "overlay")) {
      this.startTracking();
    }
  }

  /** Closes the overlay. */
  protected closeOverlay(restoreFocus = false): void {
    this.applyLifecycle({ type: "close", restoreFocus });
  }

  private applyLifecycle(intent: MdyOverlayLifecycleIntent): void {
    const transition = overlayLifecycleTransition({ open: this.open() }, intent);
    if (transition.effect === "none") return;
    // Recorded before the overlay opens, while the trigger still holds focus. Afterwards there is
    // nothing left to record: the widget has already moved it.
    if (transition.state.open) this.focus.remember();
    // Whether the user is standing inside the thing about to disappear, asked before it goes.
    //
    // The intent's own `restoreFocus` is not enough: a component that handles Escape itself closes
    // through a plain `close`, so the flag arrives false and the overlay takes the user's focus
    // down with it. What decides is the DOM — focus inside the portal being torn down has to go
    // somewhere, while focus anywhere else belongs to whatever the user just clicked and must be
    // left alone.
    const strandsFocus = !transition.state.open && this.focusWasStranded();
    this.setOverlayOpen(transition.state.open);
    if (transition.effect === "setup") this.setupGlobalListeners();
    if (transition.effect === "teardown") this.teardownGlobalListeners();
    if (transition.announce === "opened") this.announcer.announce(this.overlayI18n.overlayOpened);
    if (transition.announce === "closed") this.announcer.announce(this.overlayI18n.overlayClosed);
    if (transition.restoreFocus || strandsFocus) this.restoreOverlayTriggerFocus();
  }

  /** The writing direction the anchor is laid out in, read rather than assumed. */
  private overlayDirection(): "ltr" | "rtl" {
    return inlineDirectionOf(this.wrapperRef()?.nativeElement ?? this.hostRef.nativeElement);
  }


  /**
   * Whether closing has left the user's focus with nowhere to be.
   *
   * Two shapes, and the second is the one that kept escaping earlier attempts:
   *
   * - Focus is still inside this widget's own portalled overlay, which is about to go.
   * - Focus is on an element that is **already detached**. A component that handles its own key
   *   press tears the popup down and triggers change detection before this directive is told, so by
   *   the time the lifecycle runs there is no portal left to be inside — only an orphaned
   *   `activeElement` pointing into a tree that is no longer in the document. A browser reports
   *   that as `<body>` a moment later; either way the user has lost their place.
   *
   * Focus that is connected and outside this widget belongs to whatever the user just clicked, and
   * is left alone — which is what keeps an outside click from having its focus stolen back.
   */
  private focusWasStranded(): boolean {
    const wrapper = this.wrapperRef()?.nativeElement;
    const active = wrapper?.ownerDocument?.activeElement ?? null;
    if (!wrapper || !active) return false;
    if (!active.isConnected) return true;
    if (active === wrapper.ownerDocument.body) return false;
    // The panel is asked about **before** containment, and that ordering is the whole fix. This
    // overlay renders its panel *inside* the wrapper rather than portalling it, so focus in the
    // open popup is also focus inside the widget — and a containment check answers "not stranded"
    // for exactly the case that strands people. The panel is what is going away, wherever it sits.
    if (active.closest(".mdy-overlay-panel")) return true;
    if (wrapper.contains(active)) return false;
    return Boolean(portalRootFor(wrapper)?.contains(active));
  }

  /**
   * Hosts may override when their trigger is not the first interactive element.
   *
   * The preference is a hint, not the answer: the custodian verifies it actually took focus and
   * falls through to whoever held it before, then into the widget. Overriding this to name a
   * better element is safe; overriding it to name a missing one no longer strands the user.
   */
  protected restoreOverlayTriggerFocus(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    // The part a person opens this kind with is declared, so focus comes back to it by name rather
    // than to whatever happens to be first. "First interactive element in the wrapper" is a
    // description of one arrangement: a multiselect draws its chosen values ahead of the trigger and
    // every chip is tabbable, so closing on Tab put focus on a chip and let the browser carry on
    // from there — onto the trigger, the control the person was leaving.
    const kind = this.overlayKind;
    // The table declares the opener as a part name of its own kind, and a battle asserts every
    // declared opener is a part the kind has — so the cast states a guarantee that is checked
    // elsewhere rather than one taken on trust here.
    const opener = kind === null ? undefined : (MDY_POPUP_OPENERS[kind]?.opener as MdyWidgetPart<typeof kind> | undefined);
    const declared = wrapper && kind !== null && opener !== undefined
      ? wrapper.querySelector<HTMLElement>(partClasses(kind, opener).map((one) => `.${one}`).join(""))
      : null;
    this.focus.restore(declared ?? wrapper?.querySelector<HTMLElement>("button, input, [tabindex='0']") ?? null);
  }

  private unbindDismissal: (() => void) | null = null;

  private setupGlobalListeners(): void {
    if (typeof window === "undefined") return;
    // Six listeners feed the policy, and which six is `bindLightDismiss`'. Bound here, the set
    // drifted from the one the other renderers bind — the defect that left one of them deciding on
    // `click` alone, which the policy documents as the tail of a gesture rather than the gesture.
    this.unbindDismissal = bindLightDismiss(this.outsideDismissal);
    document.addEventListener("keydown", this.handleDocumentKeydown);
    // The other half of how a kind says it is dismissed, and the half no renderer here honoured.
    // The comment on `interactionFromInside` has always described a subclass's blur handler
    // consulting it; there was no such handler in any of the six, so a panel stayed open behind a
    // field the person had tabbed away from — covering the next question and answering to a
    // keyboard that had gone elsewhere.
    //
    // Bound on the document rather than on the wrapper: an overlay is portalled out of the widget,
    // so a listener on the wrapper never sees focus arriving in the panel, and a `focusout` from
    // inside the panel never reaches it at all.
    if (MDY_WIDGET_CONTRACTS[this.widgetKind].capabilities.dismissOnFocusOutside === true) {
      document.addEventListener("focusin", this.handleFocusMovedAway);
    }
  }

  /**
   * Closes when focus has settled outside the widget's own branch.
   *
   * `focusin` on the document rather than `focusout` on an element: it reports where focus *landed*,
   * which is the question being asked, and it is one listener for a widget whose parts are in two
   * places. A `focusout` fires as focus leaves each of them, including on the way *into* the panel.
   *
   * A pointer outranks it. A drag begun inside the branch takes focus out on the way past, and
   * closing there would reinstate through the focus path exactly the dismissal the pointer policy
   * refuses.
   */
  private readonly handleFocusMovedAway = (event: FocusEvent): void => {
    if (!this.open()) return;
    if (this.interactionFromInside()) return;
    const landed = event.target as Node | null;
    if (landed === null) return;
    const branch = this.overlayBranch();
    const roots = [branch.root, ...(branch.also ?? [])].filter((root): root is Element => root instanceof Element);
    if (roots.some((root) => root.contains(landed))) return;
    // The portalled panel is part of the widget wherever the document put it, and the contract is
    // what says which panel is this widget's: it is the one the opener names.
    const controlled = this.wrapperRef()?.nativeElement?.querySelector("[aria-controls]")?.getAttribute("aria-controls");
    if (controlled && document.getElementById(controlled)?.contains(landed)) return;
    this.closeOverlay(false);
  };

  /** Removes all document/window listeners registered while open. */
  private teardownGlobalListeners(): void {
    if (typeof window === "undefined") return;
    // Unbinding resets the policy too, which is why it is not reset again here.
    this.unbindDismissal?.();
    this.unbindDismissal = null;
    document.removeEventListener("keydown", this.handleDocumentKeydown);
    document.removeEventListener("focusin", this.handleFocusMovedAway);
    this.stopTracking?.();
    this.stopTracking = null;
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

  /**
   * The contract's dismissal gesture, held once in `@modyra/widgets`.
   *
   * Registered on document only while the overlay is open. Naming an event here — as a single
   * `click` listener does — is a renderer deciding a rule the contract states, which is how the
   * same gesture came to mean different things in different adapters.
   */
  private readonly outsideDismissal = createLightDismiss({
    isOpen: () => this.open(),
    branch: () => this.overlayBranch(),
    dismiss: () => this.dismissFromOutside(),
  });


  /** Escape closes the open overlay regardless of where focus is (R19). */
  private readonly handleDocumentKeydown = (event: KeyboardEvent): void => {
    // Asked of the catalogue. The binding declares that a dismissal answers whatever is held with
    // it, and a condition naming the key is a second copy of that rule — the copy is what keeps
    // answering after the declaration changes, which is how every renderer here stayed correct
    // for its own reasons rather than the contract's. ADR 0168.
    if (this.overlayKind === null) return;
    // Only the dismissal that takes the reading position back. `Tab` is declared `cancel` too and is
    // already carrying the keyboard onward — answering it here would close the panel *and* pull
    // focus to the opener, which is the trap this listener exists to avoid rather than cause.
    const dismissal = keyBindingFor(this.overlayKind, event, true);
    if (dismissal?.intent === "cancel" && dismissal.restoresFocus === true) {
      // Through the closing door a component may override, not past it. Straight to the lifecycle,
      // a renderer that tells its controller about a close — because closing without choosing is an
      // act on the value — was told about every close except the one a person makes with Escape,
      // which is the commonest of them. ADR 0167.
      this.closeOverlay(true);
    }
  };

  /**
   * The roots this widget's overlay interaction may land on.
   *
   * The wrapper by default. A kind with a part outside it — chips beside a search box — names that
   * element in `also`; it does not name its portal, which the contract follows out of the root
   * through the widget's own `aria-controls`.
   */
  protected overlayBranch(): MdyOverlayBranch {
    return { root: this.wrapperRef()?.nativeElement ?? null };
  }

  /** Runs when an interaction completes entirely outside. Overridden where closing needs more than the lifecycle. */
  protected dismissFromOutside(): void {
    this.applyLifecycle({ type: "outside", outside: true });
  }

  /**
   * Whether an interaction that began inside the branch is still unresolved.
   *
   * The precedence between the two dismissal paths: while this is true, focus leaving must not
   * close. A subclass's blur handler consults it rather than deciding for itself.
   */
  protected interactionFromInside(): boolean {
    return this.outsideDismissal.interactionFromInside();
  }
}
