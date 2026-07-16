import { NgTemplateOutlet } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef, input, InputSignalWithTransform, viewChild } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdySelectOption } from "../../core/types";

/**
 * Segmented Button renderer component.
 */
@Component({
  selector: "mdy-control-segmented",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent, MdyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--segmented",
    "[class.mdy-renderer--touched]": "touched()",
    "[style.width]": "fullWidth() ? '100%' : 'fit-content'",
    "[style.--mdy-segments-count]": "segmentsCount()"
  },
  template: `
    <!-- Group labelled via aria-labelledby: the label gets a real id (B33). -->
    <mdy-control-label
      [label]="label()"
      [labelId]="fieldId + '-label'"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    <div
      #track
      class="mdy-segmented"
      role="radiogroup"
      [attr.aria-labelledby]="label() ? fieldId + '-label' : null"
      (pointerdown)="onTrackPointerDown($event)"
      (pointermove)="onTrackPointerMove($event)"
      (pointerup)="onTrackPointerUp()"
      (pointercancel)="onTrackPointerUp()"
      (keydown)="onKeydown($event)"
    >
      @for (opt of options(); track opt.value; let first = $first; let last = $last; let i = $index) {
        <button
          type="button"
          class="mdy-segmented__button"
          [class.mdy-segmented__button--first]="first"
          [class.mdy-segmented__button--last]="last"
          [class.mdy-segmented__button--selected]="value() === opt.value"
          [disabled]="isDisabled()"
          [attr.data-seg-index]="i"
          (click)="onSelect(opt.value)"
          (blur)="markAsTouched()"
          role="radio"
          [attr.aria-checked]="value() === opt.value"
          [attr.aria-disabled]="isDisabled()"
          [attr.tabindex]="tabIndexFor(i)"
        >
          <mdy-icon
            name="CHECKMARK"
            class="mdy-segmented__check"
            [style.visibility]="value() === opt.value ? 'visible' : 'hidden'"
            [attr.aria-hidden]="value() !== opt.value"
          />
          <span class="mdy-segmented__text" [attr.data-text]="opt.label">{{ opt.label }}</span>
        </button>
      }
    </div>

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdySegmentedButtonComponent<TValue = unknown> extends MdyBaseControl<TValue | null> {
  readonly options = input<readonly MdySelectOption<TValue>[]>([]);

  public readonly fullWidth: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(false, { transform: booleanAttribute });

  protected readonly fieldId = `mdy-control-segmented-${MdyBaseControl.nextId()}`;

  protected readonly segmentsCount = computed(() => this.options().length);

  private readonly track = viewChild<ElementRef<HTMLElement>>("track");
  private isDragging = false;

  protected onTrackPointerDown(event: PointerEvent): void {
    if (this.isDisabled() || event.button !== 0) return;
    this.isDragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.updateSelectionFromPointer(event);
  }

  protected onTrackPointerMove(event: PointerEvent): void {
    if (!this.isDragging || this.isDisabled()) return;
    this.updateSelectionFromPointer(event);
  }

  protected onTrackPointerUp(): void {
    this.isDragging = false;
    this.markAsTouched();
  }

  private updateSelectionFromPointer(event: PointerEvent): void {
    const trackEl = this.track()?.nativeElement;
    if (!trackEl) return;

    const rect = trackEl.getBoundingClientRect();
    const count = this.segmentsCount();
    if (count === 0) return;

    const relativeX = event.clientX - rect.left;
    const segmentWidth = rect.width / count;
    let index = Math.floor(relativeX / segmentWidth);

    // Clamp index
    index = Math.max(0, Math.min(index, count - 1));

    const option = this.options()[index];
    if (option && this.value() !== option.value) {
      this.onSelect(option.value);
    }
  }

  protected onSelect(value: TValue): void {
    if (this.isDisabled()) return;
    this.setValue(value);
    this.markAsDirty();
  }

  // ── ARIA radiogroup keyboard support (B34) ──────────────────────────────────

  /** Roving tabindex: only the selected (or first) segment is tabbable. */
  protected tabIndexFor(index: number): number {
    const selected = this.selectedIndex();
    if (selected >= 0) return index === selected ? 0 : -1;
    return index === 0 ? 0 : -1;
  }

  private selectedIndex(): number {
    return this.options().findIndex((o) => o.value === this.value());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;
    const opts = this.options();
    if (opts.length === 0) return;
    const current = Math.max(0, this.selectedIndex());

    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (current + 1) % opts.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (current - 1 + opts.length) % opts.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = opts.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const opt = opts[next];
    if (!opt) return;
    this.onSelect(opt.value);
    this.track()
      ?.nativeElement.querySelector<HTMLElement>(`[data-seg-index="${next}"]`)
      ?.focus();
  }
}
