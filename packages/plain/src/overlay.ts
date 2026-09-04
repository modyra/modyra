/**
 * Positioning for the popups this renderer draws.
 *
 * Every decision — above or below, left- or right-aligned, how tall, how wide, and the exact
 * coordinates that follow — is `anchorOverlay` in `@modyra/widgets`. This file measures the anchor
 * and writes the `--mdy-overlay-*` properties it returns, and decides nothing of its own.
 */
import { bindDismissOnFocusOutside, applyAnchoredOverlay, applyOverlayProperties, clearAnchoredOverlay, inlineDirectionOf, measureOverlayContent, trackAnchoredOverlay, bindLightDismiss, setOverlayOpen, syncOverlayBackdrop, viewportSize, type MdyI18nMessages } from "@modyra/widgets";
import { anchorOverlay, createLightDismiss, MDY_WIDGET_CONTRACTS, overlayLifecycleTransition, type MdyOverlayDecision, type MdyPopupWidgetKind, type MdyWidgetKind } from "@modyra/widgets";

import { announcePlain } from "./command-runtime.js";

export interface OverlayPlacementOptions {
  /** Smallest usable space before the popup flips or overlays. */
  readonly minSpace?: number;
  readonly minWidth?: number;
  readonly preferred?: "above" | "below";
  /** Write the decided width out; a content-sized popup leaves it alone. */
  readonly matchAnchorWidth?: boolean;
  /** The edge the widget's popup hangs from, as its contract declares it. */
  readonly alignment?: "left" | "right";
  /** Which widget this popup belongs to, so its placement is reflected under the contract's name. */
  readonly kind?: MdyPopupWidgetKind;
}

/**
 * Showing a popup is `setOverlayOpen` in `@modyra/widgets`, re-exported so this renderer's fields
 * keep one import for everything overlay. It moved there when a second adapter's popups joined the top layer:
 * two adapters calling one function is the contract, two adapters with one copy each is a drift
 * waiting to happen.
 */
export { setOverlayOpen } from "@modyra/widgets";

/**
 * Shows or hides a popup, and says which one it just did.
 *
 * `overlayLifecycleTransition` answers `announce` for every open and close, and the words are in the
 * message tables in five languages — what was missing was a renderer reading either. A popup that
 * appears elsewhere on the page is the case: `aria-expanded` carries the state for anyone who asks
 * the control, and nothing tells someone who was not asking that something has appeared.
 *
 * The edge comes from `setOverlayOpen`, which answers whether this call is the moment it changed:
 * a field reflects its open state on every render, and announcing from the state rather than from
 * the change would repeat the sentence on every keystroke while the popup is open.
 */
export function reflectOverlayOpen(
  popup: HTMLElement,
  open: boolean,
  messages: MdyI18nMessages,
  modal = false,
): void {
  if (!setOverlayOpen(popup, open, modal)) return;
  // A popup taken out of the document is not one anybody closed, and the live region this would
  // build to say so outlives the field that caused it.
  if (!popup.isConnected) return;
  announcePlain(open ? messages.overlayOpened : messages.overlayClosed);
}

/**
 * The shape an open popup was given, kept so repositioning follows the anchor without re-deciding
 * the popup's side and height on every scroll frame. Cleared when it closes.
 */
const heldDecisions = new WeakMap<HTMLElement, { decision: MdyOverlayDecision; content: MdyContentSize | null; kind?: MdyPopupWidgetKind }>();

interface MdyContentSize {
  readonly height: number;
  readonly width: number;
}

/**
 * Forgets a popup's held shape, so the next opening decides afresh — and takes its placement state
 * off with it, because a closed popup is not sitting above anything. The kind is read back from the
 * held decision rather than asked of the caller, so closing needs to know no more than it did.
 */
export function releaseOverlayPlacement(popup: HTMLElement): void {
  const held = heldDecisions.get(popup);
  if (held?.kind) clearAnchoredOverlay(popup, held.kind);
  heldDecisions.delete(popup);
}

/**
 * How much room the popup's content actually wants.
 *
 * `scrollHeight`/`scrollWidth` are the content's own size whatever `max-height` is clamping the box
 * to, which is exactly the question: a popup already squeezed into 200px still reports the 400px it
 * would like. The borders are added because the placement reasons about the whole box.
 *
 * Measured once, when the popup opens — re-measuring on every scroll frame would feed the clamped
 * width back into the decision that clamped it.
 */

/** Positions `popup` against `anchor` by applying the contract's anchoring, and returns its decision. */
export function positionOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  options: OverlayPlacementOptions = {},
): MdyOverlayDecision {
  const rect = anchor.getBoundingClientRect();
  const held = heldDecisions.get(popup);
  // Measured on the way up, so the popup is placed where its content shows whole; kept afterwards,
  // so following the anchor never re-measures a box the placement has already clamped.
  const content = held ? held.content : measureOverlayContent(popup);
  // Every coordinate, the placement and the height come from `anchorOverlay`; this renderer only
  // measures and writes. Passing the decision it is already holding keeps an open popup's shape
  // steady while the anchor moves.
  const anchoring = anchorOverlay(
    rect,
    // `clientWidth`/`clientHeight`, never `innerWidth`/`innerHeight`: the inner sizes include the
    // scrollbars, while the coordinates written back are laid out against the viewport without
    // them. A right-hung popup then gets `right: innerWidth - anchor.right`, which is a scrollbar
    // too much, and every popup on a scrolling page sits ~15px left of its control.
    viewportSize(document),
    {
      ...options,
      // The direction the field is actually laid out in, read from the DOM rather than assumed.
      // The widget declares which *inline* edge its popup hangs from; only the live direction can
      // say which physical edge that is.
      direction: inlineDirectionOf(anchor),
      current: held?.decision ?? null,
      ...(content ? { contentHeight: content.height, contentWidth: content.width } : {}),
    },
  );
  heldDecisions.set(popup, { decision: anchoring.decision, content, ...(options.kind ? { kind: options.kind } : {}) });
  if (options.kind) {
    // The coordinates and every class that says where the popup went, written by the contract's own
    // door. Written here instead, this reflected the placement and never the alignment, so a popup
    // hanging off the other inline edge said nothing about it — true of a theme in this repository,
    // which paints none of them, and false for any theme outside it.
    applyAnchoredOverlay(popup, options.kind, anchoring);
  } else {
    applyOverlayProperties(popup, anchoring.properties);
    popup.dataset.placement = anchoring.placement;
  }
  // A modal dims what is behind it, and which placement is modal is the contract's answer. Here
  // rather than in each field: the placement is only known once the popup has been measured.
  syncOverlayBackdrop(popup, anchoring.decision.placement === "overlay");
  return anchoring.decision;
}

/**
 * Keeps a popup positioned while it is open. Returns the teardown; scroll is captured so a popup
 * inside a scrollable pane follows its anchor rather than floating away from it.
 */
export function trackOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  isOpen: () => boolean,
  options: OverlayPlacementOptions = {},
): () => void {
  // The listening is `@modyra/widgets`', because passive and frame-coalesced is what it has to be
  // and that was written three times here and in the other two renderers, differently each time.
  //
  // One answer for both events, deliberately: this renderer re-decides the placement on every
  // reposition rather than holding the one it opened with, so a scroll and a resize genuinely have
  // the same reply here.
  return trackAnchoredOverlay({
    reposition: () => positionOverlay(popup, anchor, options),
    isOpen,
  });
}

/**
 * Dismisses an overlay when a gesture completes outside it.
 *
 * **Which gesture** comes from `capabilities.dismissOnOutsidePointer` and the rule itself from
 * `createOutsidePointerGesture`, both in `@modyra/widgets`. Neither lives here: a renderer that
 * decided when a pointer dismisses would be writing a specification, and three renderers each
 * writing one is how the same gesture came to mean different things.
 *
 * This file supplies only the two things a renderer actually knows — which nodes count as inside,
 * and how to tear down — and binds the listeners.
 */
/** A teardown for the case where nothing was bound. */
const noop = (): void => undefined;

/**
 * The teardown, with the one question a field may need to ask of the interaction in flight.
 *
 * Callable so the five fields that only tear down are unaffected; only the select consults the
 * precedence rule, and only it reads `interactionFromInside`.
 */
export interface MdyOverlayDismissal {
  (): void;
  /** True while an interaction begun inside the branch is unresolved. Focus must not close then. */
  interactionFromInside(): boolean;
}

export function dismissOnOutsidePointer(
  parts: ReadonlyArray<Element | null | undefined>,
  isOpen: () => boolean,
  close: () => void,
): MdyOverlayDismissal {
  // Every overlay kind declares the same interaction; asking any of them is asking the contract.
  const declared = MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnOutsidePointer;
  // Nothing declared: no listeners, and a teardown that has nothing to undo.
  if (declared === false) return Object.assign(noop, { interactionFromInside: () => false });

  const policy = createLightDismiss({
    isOpen,
    // The first part is the widget's root and the rest are what containment cannot reach. The
    // portalled popup is not among them: the contract follows the widget's own `aria-controls` out
    // to it, so a renderer that forgets to list its portal is no longer a renderer that stops
    // dismissing correctly.
    branch: { root: parts[0] ?? null, also: parts.slice(1) },
    dismiss: () => {
      // The policy still decides; this only reports that the interaction completed outside.
      const transition = overlayLifecycleTransition({ open: true }, { type: "outside", outside: true });
      if (transition.effect === "teardown") close();
    },
  });

  const dispose = bindLightDismiss(policy);

  return Object.assign(dispose, { interactionFromInside: policy.interactionFromInside });
}

/**
 * Closes an overlay when focus settles outside the widget, where the kind declares that it should.
 *
 * The deciding is `bindDismissOnFocusOutside`'s, in `@modyra/widgets`. It was written out here, and
 * being written out here is why it was honoured by one renderer out of four: a rule that lives in a
 * renderer is a rule the next renderer has to be told about. This keeps the signature this package's
 * fields already call and hands the question to the contract.
 */
export function dismissOnFocusOutside(
  kind: MdyWidgetKind,
  parts: ReadonlyArray<Element | null | undefined>,
  isOpen: () => boolean,
  close: () => void,
  options: { readonly pointer?: MdyOverlayDismissal; readonly markVisited?: () => void } = {},
): () => void {
  return bindDismissOnFocusOutside(kind, () => parts, isOpen, close, options);
}
