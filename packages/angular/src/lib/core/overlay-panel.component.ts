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
import { ComputedPosition, getOverlayStyles, OverlayAlignment, OverlayPosition } from "@modyra/core/overlay-position";

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
      <div
        class="mdy-overlay-backdrop"
        style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.32); z-index: 1; pointer-events: auto;"
        (click)="onBackdropClick($event)"
      ></div>
    }
    <div
      #panel
      popover="manual"
      class="mdy-overlay-panel"
      [class.mdy-overlay-panel--above]="position() === 'above'"
      [class.mdy-overlay-panel--overlay]="position() === 'overlay'"
      [class.mdy-overlay-panel--right]="alignment() === 'right'"
      [class.mdy-overlay-panel--modal]="hasBackdrop() && (position() === 'overlay')"
      [class.mdy-overlay-panel--visible]="open()"
      [ngClass]="panelClass()"
      [ngStyle]="panelStyle()"
      (click)="$event.stopPropagation()"
      (keydown)="onPanelKeydown($event)"
      [attr.role]="isModal() ? 'dialog' : null"
      [attr.aria-modal]="isModal() ? 'true' : null"
    >
      <ng-content />
    </div>
  `,
  styles: `
    .mdy-overlay-panel.mdy-overlay-panel--visible {
        visibility: visible !important;
        opacity: 1 !important;
    }
  `,
})
export class MdyOverlayPanelComponent {
  readonly open = input.required<boolean>();
  readonly position = input<OverlayPosition>("below");
  readonly alignment = input<OverlayAlignment>("left");
  readonly coords = input.required<ComputedPosition["coords"]>();
  readonly maxHeight = input<number>(0);
  readonly hasBackdrop = input<boolean>(false);
  readonly widthMode = input<"match-anchor" | "auto-content">("match-anchor");
  readonly panelClass = input<string>("");

  // "close" mirrors the dialog element's vocabulary and is part of the
  // published API; renaming it would be a breaking change.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  readonly panelRef = viewChild<ElementRef<HTMLElement>>("panel");

  /**
   * Modal semantics only when a backdrop is present: a plain select dropdown
   * must not be announced as a modal dialog by screen readers (B29).
   */
  protected readonly isModal = computed(() => this.hasBackdrop());

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

  readonly panelStyle = computed(() => {
    const c = this.coords();
    const pos = this.position();
    const isOverlay = pos === "overlay";

    // Compute direct positioning properties so the overlay works regardless of theme.
    // The theme CSS can still override via !important for custom styling.
    let top: string | null;
    let bottom: string | null;
    let left: string | null;
    let right: string | null;
    let transform: string | null = null;
    let width: string | null;
    let maxHeight: string | null;

    if (isOverlay) {
      // Centered modal: perfectly centered in viewport.
      top = "50%";
      left = "50%";
      bottom = "auto";
      right = "auto";
      transform = "translate(-50%, -50%)";
      width = c.width ? `${c.width}px` : null;
      maxHeight = "80vh";
    } else {
      // Anchored: use the computed coords directly.
      // Always set all four sides explicitly so inline styles override the theme
      // CSS fallback (e.g. `top: var(--mdy-overlay-top, -9999px)`).
      top = c.top !== undefined ? `${c.top}px` : "auto";
      bottom = c.bottom !== undefined ? `${c.bottom}px` : "auto";
      left = c.left !== undefined ? `${c.left}px` : "auto";
      right = c.right !== undefined ? `${c.right}px` : "auto";
      // Width follows widthMode: match-anchor uses trigger width, auto-content expands.
      width = this.widthMode() === "match-anchor" && c.width ? `${c.width}px` : null;
      maxHeight = this.maxHeight() ? `${this.maxHeight()}px` : null;
    }

    return {
      position: "fixed",
      "pointer-events": this.open() ? "auto" : "none",
      top,
      bottom,
      left,
      right,
      transform,
      width,
      "max-height": maxHeight,
      visibility: this.open() ? "visible" : "hidden",
      opacity: this.open() ? "1" : "0",
      // Keep CSS variables for theme compatibility (themes can reference them for additional styling)
      "--mdy-overlay-width": width ?? "auto",
      ...getOverlayStyles(c),
      border: "none", // Override any theme border for the panel container itself (e.g. popover's default border) so it doesn't interfere with custom panel styles.
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
