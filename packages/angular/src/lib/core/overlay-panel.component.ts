import { NgClass, NgStyle } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from "@angular/core";
import {
  overlayStyleProperties,
  popupAlignmentClass,
  popupPlacementClass,
  type MdyOverlayAlignment,
  type MdyOverlayCoords,
  type MdyOverlayPlacement,
  type MdyPopupWidgetKind,
} from "@modyra/widgets";

/**
 * Unified overlay panel container.
 * Centralizes backdrop, positioning variables, and MD3 surface styles.
 */
@Component({
  selector: "mdy-overlay-panel",
  standalone: true,
  imports: [NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: "display: contents",
    "[class.mdy-overlay--open]": "open()",
  },
  template: `
    @if (hasBackdrop() && open()) {
      <!-- The class carries the whole appearance. The colour was written here as a literal, so the
           theme token for it, which has a dark ramp, was declared and read by nothing and a product
           could not change how its modals dim. -->
      <div class="mdy-overlay-backdrop" (click)="onBackdropClick($event)"></div>
    }
    <div
      #panel
      popover="manual"
      [attr.id]="panelId() || null"
      class="mdy-overlay-panel"
      [class.mdy-overlay-panel--modal]="hasBackdrop() && (position() === 'overlay')"
      [class.mdy-overlay-panel--visible]="open()"
      [ngClass]="[panelClass(), placementClass()]"
      [ngStyle]="panelStyle()"
      (click)="$event.stopPropagation()"
      (keydown)="onPanelKeydown($event)"
      [attr.role]="announcesDialog() ? 'dialog' : null"
      [attr.aria-modal]="announcesDialog() ? 'true' : null"
      [attr.aria-label]="announcesDialog() ? dialogLabel() : null"
    >
      <ng-content />
    </div>
  `,
  // No component styles. This carried `visibility: visible !important; opacity: 1 !important` on the
  // visible panel, which no shipped rule ever needed — nothing in the foundation or any theme makes
  // the panel invisible. Being component-scoped, it was unreachable by a theme, and its `!important`
  // would have pinned the opacity the foundation's shared popup transition animates. How a popup
  // appears is the foundation's, and it is now the same in all three renderers.
})
export class MdyOverlayPanelComponent {
  readonly open = input.required<boolean>();
  readonly position = input<MdyOverlayPlacement>("below");
  readonly alignment = input<MdyOverlayAlignment>("left");
  readonly coords = input.required<MdyOverlayCoords>();
  readonly hasBackdrop = input<boolean>(false);
  readonly widthMode = input<"match-anchor" | "auto-content">("match-anchor");
  readonly panelClass = input<string>("");
  /**
   * The id an opener names through `aria-controls`.
   *
   * The panel is projected outside the field it belongs to, so the relation is the only thing tying
   * the two together; without an id there is nothing for the opener to point at.
   */
  readonly panelId = input<string>("");
  /**
   * Which widget this panel is holding, so the placement is reflected under the name the catalog
   * gives it rather than one this component made up.
   *
   * Left unset the panel reflects nothing, which is what it effectively did before: it emitted
   * `mdy-overlay-panel--above` and `--overlay`, names no stylesheet has ever matched, while the
   * catalog had declared `above` and `overlay` as states of every popup part all along.
   */
  readonly kind = input<MdyPopupWidgetKind | null>(null);

  /**
   * The catalog's placement and alignment states for this popup, or nothing where it sits in the
   * ordinary place and hangs from the ordinary edge.
   *
   * Both halves come from the catalog. Spelling the edge here as `mdy-overlay-panel--right` would
   * mint a third name for a class the catalog already declares on every popup — and one no
   * stylesheet matches, so it would paint nothing while looking correct.
   */
  protected readonly placementClass = computed(() => {
    const kind = this.kind();
    if (!kind) return "";
    return [
      popupPlacementClass(kind, this.position()),
      popupAlignmentClass(kind, this.alignment()),
    ].filter((name): name is string => name !== null).join(" ");
  });

  // "close" mirrors the dialog element's vocabulary and is part of the
  // published API; renaming it would be a breaking change.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  readonly panelRef = viewChild<ElementRef<HTMLElement>>("panel");

  /**
   * The name this panel is announced under, when it is the thing being announced.
   *
   * Left unset the panel announces nothing at all — see `announcesDialog`. It is not a default
   * string on purpose: "dialog" as a name is worse than no dialog, and a name invented here could
   * not know what the popup holds.
   */
  readonly dialogLabel = input<string | null>(null);

  /**
   * Modal semantics only when a backdrop is present: a plain select dropdown
   * must not be announced as a modal dialog by screen readers (B29).
   */
  protected readonly isModal = computed(() => this.hasBackdrop());

  /**
   * Whether this panel is the dialog, rather than a wrapper around one.
   *
   * **The element that carries the role is the element that has a name.** A modal panel used to
   * take `role="dialog"` unconditionally and never had a name, which axe reports as a serious
   * dialog-name violation — and for the datepicker it was worse than nameless: `<mdy-calendar>` inside
   * already declares a named dialog, so a screen reader was given a nameless dialog wrapping a
   * named one. A popup whose content announces itself leaves `dialogLabel` unset and this panel
   * goes back to being what it is, a positioned host; a popup whose content does not — the clock,
   * the palette — passes a name and is announced here.
   *
   * The focus trap stays keyed on `isModal`: trapping focus is about the backdrop, not about who
   * says the word "dialog".
   */
  protected readonly announcesDialog = computed(() => this.isModal() && this.dialogLabel() !== null);

  constructor() {
    // Top Layer Management (Popover API)
    effect(() => {
      const panel = this.panelRef()?.nativeElement;
      if (!panel) return;

      // Ensure the browser supports Popover API
      if (typeof panel.showPopover !== "function") {
        console.warn("Popover API not supported in this browser. Falling back to simple absolute positioning.");
        return;
      }

      const isOpen = this.open();
      if (isOpen) {
        try {
          panel.showPopover();
        } catch {
          // Ignores if already showing or other non-critical errors
        }
      } else {
        try {
          panel.hidePopover();
        } catch {
          // Ignores if already hidden
        }
      }
    });
  }

  /**
   * The coordinates, published for the popup inside to position itself from — and nothing else.
   *
   * This panel used to *also* place itself: the same numbers, applied to this element as `position:
   * fixed` with all four insets, while the popup inside read the properties and placed itself a
   * second time. Two boxes at identical coordinates, agreeing only because both were derived from
   * one measurement; measured, either one alone puts the popup exactly where it is now, so one of
   * them was always doing nothing.
   *
   * The popup is the box that is kept, because it is the box anyone can see — it draws the surface,
   * it is what the contract names, and it is the one the framework-free renderer positions. What is
   * left here is what a wrapper is for: the top layer, the backdrop and the focus trap.
   *
   * Publishing them properly also settles a defect the split was hiding. `max-height` was applied to
   * this element, whose only child is out of flow, so it clamped nothing — while
   * `--mdy-overlay-max-height` went unwritten and the popup fell back to `50vh`. A popup taller than
   * the room measured for it simply grew past it; measured on the demo, a 323px allowance against a
   * 360px popup.
   */
  readonly panelStyle = computed(() => {
    const c = this.coords();
    return {
      // The wrapper still swallows clicks meant for its own popup; it has no box of its own to
      // catch anything else with.
      "pointer-events": this.open() ? "auto" : "none",
      // Whether it is showing is state, not placement, and it stays. A browser without the Popover
      // API keeps the panel in the page — the component says so and carries on — so this is the
      // only thing hiding a closed overlay there, and axe finds a closed calendar without it.
      visibility: this.open() ? "visible" : "hidden",
      opacity: this.open() ? "1" : "0",
      // Every overlay property comes from the contract, the centring and the height included. This
      // component used to state the modal case itself and chose `80vh` where the policy computes
      // 70% of the viewport, so the same popup was a different size here than in every other
      // renderer. A projection that omits part of the decision is a projection each host completes
      // differently.
      ...overlayStyleProperties(
        this.widthMode() === "match-anchor" ? c : { ...c, width: undefined },
      ),
    };
  });

  protected onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.close.emit();
  }

  /** Traps Tab focus inside modal panels (B36). */
  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab" || !this.isModal() || !this.open()) return;
    const panel = this.panelRef()?.nativeElement;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = panel.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
