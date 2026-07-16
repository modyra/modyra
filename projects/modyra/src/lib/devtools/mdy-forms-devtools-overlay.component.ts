import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from "@angular/core";
import { MdyTypedFormLike } from "../core/typed-form";
import { MdyFormsDevtoolsComponent } from "./mdy-forms-devtools.component";

/**
 * Floating, draggable window around the devtools panel — opened by
 * {@link MdyFormsDevtoolsService} via a keyboard shortcut. Drag it by the
 * title bar; the ✕ button (or Escape while it has focus) closes it.
 */
@Component({
  selector: "mdy-forms-devtools-overlay",
  standalone: true,
  imports: [MdyFormsDevtoolsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-devtools-overlay",
    role: "dialog",
    "aria-label": "mdy-forms devtools",
    tabindex: "-1",
    "[style.transform]": "translate()",
    "(keydown.escape)": "closed.emit()",
  },
  styles: `
    :host {
      position: fixed; top: 16px; right: 16px; z-index: 10000;
      width: min(560px, calc(100vw - 32px)); display: block;
      background: Canvas; color: CanvasText;
      border: 1px solid color-mix(in srgb, CanvasText 30%, transparent);
      border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }
    .mdy-devtools-overlay__bar {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.35rem 0.6rem; cursor: grab; user-select: none;
      touch-action: none;
      font: 600 11px/1.5 ui-monospace, monospace;
      border-bottom: 1px dashed color-mix(in srgb, CanvasText 30%, transparent);
    }
    .mdy-devtools-overlay__bar:active { cursor: grabbing; }
    .mdy-devtools-overlay__title { flex: 1; }
    .mdy-devtools-overlay__close {
      border: none; background: none; color: inherit; cursor: pointer;
      font: inherit; font-size: 13px; padding: 0 0.25rem; line-height: 1;
    }
    .mdy-devtools-overlay__body { max-height: 60vh; overflow: auto; }
    .mdy-devtools-overlay__body mdy-forms-devtools { border: none; }
  `,
  template: `
    <div
      class="mdy-devtools-overlay__bar"
      (pointerdown)="onDragStart($event)"
      (pointermove)="onDragMove($event)"
      (pointerup)="onDragEnd($event)"
      (pointercancel)="onDragEnd($event)"
    >
      <span class="mdy-devtools-overlay__title">mdy-forms devtools</span>
      <button
        type="button"
        class="mdy-devtools-overlay__close"
        aria-label="Close devtools"
        (click)="closed.emit()"
      >
        ✕
      </button>
    </div>
    <div class="mdy-devtools-overlay__body">
      <mdy-forms-devtools [form]="form()" expanded />
    </div>
  `,
})
export class MdyFormsDevtoolsOverlayComponent {
  readonly form = input.required<MdyTypedFormLike>();
  readonly closed = output<void>();

  private readonly _offset = signal({ x: 0, y: 0 });
  protected readonly translate = signal("");

  private _dragging = false;
  private _start = { x: 0, y: 0, baseX: 0, baseY: 0 };

  protected onDragStart(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest("button")) return;
    this._dragging = true;
    const offset = this._offset();
    this._start = {
      x: event.clientX,
      y: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onDragMove(event: PointerEvent): void {
    if (!this._dragging) return;
    const x = this._start.baseX + (event.clientX - this._start.x);
    const y = this._start.baseY + (event.clientY - this._start.y);
    this._offset.set({ x, y });
    this.translate.set(`translate(${x}px, ${y}px)`);
  }

  protected onDragEnd(event: PointerEvent): void {
    if (!this._dragging) return;
    this._dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }
}
