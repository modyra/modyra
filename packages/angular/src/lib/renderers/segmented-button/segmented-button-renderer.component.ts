import { NgTemplateOutlet } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef, input, InputSignalWithTransform, viewChild } from "@angular/core";
import {
  createOptionFieldController,
  MDY_WIDGET_CONTRACTS,
  optionNavigationIndex,
  defaultWidgetIdFactory,
} from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdySelectOption } from "../../core/types";

@Component({
  selector: "mdy-control-segmented",
  standalone: true,
  imports: [MdyPartDirective, NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent, MdyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--segmented",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[style.width]": "fullWidth() ? '100%' : 'fit-content'",
    "[style.--mdy-segments-count]": "segmentsCount()"
  },
  template: `
    <!-- Group labelled via aria-labelledby: the label gets a real id (B33). -->
    <mdy-control-label
      [label]="label()"
      [labelId]="labelId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div
      #track
      class="mdy-segmented"
      role="radiogroup"
      [mdyPart]="controlPart()"
      [attr.aria-labelledby]="label() ? labelId : null"
      (pointerdown)="onTrackPointerDown($event)"
      (pointermove)="onTrackPointerMove($event)"
      (pointerup)="onTrackPointerUp()"
      (pointercancel)="onTrackPointerUp()"
      (keydown)="onKeydown($event)"
    >
      @for (opt of options(); track opt.value; let first = $first; let last = $last; let i = $index) {
        <!--
          A label around its own radio, not a button carrying the role. The choice is then a real
          radio: arrow keys, the roving tab stop and form participation come from the platform
          rather than being reimplemented, and a theme paints the selected state from the control's
          own checked state instead of a class the renderer has to remember to apply.
        -->
        <label
          class="mdy-segmented__button"
          [class.mdy-segmented__button--first]="first"
          [class.mdy-segmented__button--last]="last"
          [class.mdy-segmented__button--selected]="value() === opt.value"
        >
          <input
            type="radio"
            class="mdy-segmented__control"
            [name]="groupName()"
            [value]="opt.value"
            [checked]="value() === opt.value"
            [disabled]="isDisabled()"
            [attr.data-seg-index]="i"
            (change)="onSelect(opt.value)"
            (blur)="markAsTouched()"
            [attr.aria-checked]="value() === opt.value"
            [attr.aria-disabled]="isDisabled()"
            [attr.aria-readonly]="isReadonly() ? 'true' : null"
            [attr.tabindex]="tabIndexFor(i)"
          />
          <mdy-icon
            name="CHECKMARK"
            class="mdy-segmented__check"
            [style.visibility]="value() === opt.value ? 'visible' : 'hidden'"
            [attr.aria-hidden]="value() !== opt.value"
          />
          <span class="mdy-segmented__text" [attr.data-text]="opt.label">{{ opt.label }}</span>
        </label>
      }
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdySegmentedButtonComponent<TValue = unknown> extends MdyBaseControl<TValue | null> {
  /**
   * The group's label, named through the id factory rather than joined by hand.
   *
   * Every id this library publishes is `scope__part`, and a consumer that knows the scope composes
   * a part name the same way. A hyphen still yields a unique id and still works — and is unreachable
   * by anybody who builds the name instead of reading it off the element.
   */
  protected readonly labelId = defaultWidgetIdFactory.part(this.fieldId, "label");

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.segmented;
  protected override readonly widgetKind = "segmented" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly options = input<readonly MdySelectOption<TValue>[]>([]);

  public readonly fullWidth: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(false, { transform: booleanAttribute });


  private readonly controller = this.adoptFieldController(
    (handle, widgetId) => createOptionFieldController<TValue>(
      { widgetId, handle: handle as never, options: this.options(), variant: "segmented" }),
    (c) => c.setOptions(this.options()),
  );

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
    this.dispatchValueBlur("segmented");
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

    index = Math.max(0, Math.min(index, count - 1));

    const option = this.options()[index];
    if (option && this.value() !== option.value) {
      this.onSelect(option.value);
    }
  }

  protected onSelect(value: TValue): void {
    this.controller()?.dispatch({ type: "select", optionKey: String(value) });
  }

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
    // The arrows only. `optionNavigationIndex` also answers Home and End, which belong to a list long
    // enough that jumping to an end is worth a key — three or four always-visible choices are crossed
    // in three presses, and the authoring practices give a radio group the arrows and not those.
    //
    // Claiming them here made this renderer answer a gesture the contract does not declare and the
    // other two do not offer, so somebody who learned it here lost it by changing renderer. The
    // contract stays as short as the practice: the extra gesture goes rather than the two others
    // gaining it, because nobody expects it and nobody loses it.
    if (event.key === "Home" || event.key === "End") return;
    const next = optionNavigationIndex(event.key, Math.max(0, this.selectedIndex()), opts.length);
    if (next === null) return;
    event.preventDefault();
    const opt = opts[next];
    if (!opt) return;
    this.onSelect(opt.value);
    this.track()
      ?.nativeElement.querySelector<HTMLElement>(`[data-seg-index="${next}"]`)
      ?.focus();
  }
}
