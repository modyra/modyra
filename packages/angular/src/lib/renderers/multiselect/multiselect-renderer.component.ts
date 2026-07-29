import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { filterOptionsByQuery } from "@modyra/core/options-utils";
import {
  MDY_WIDGET_CONTRACTS,
  multiselectOverlayAction,
  multiselectChipClasses,
  multiselectValueTransition,
  optionNavigationIndex,
  shouldCloseMultiselectOverlay,
} from "@modyra/widgets";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MDY_OPTIONS_CONTROL } from "../../core/tokens";
import { MdyOptionsControl } from "../../core/types";
import { MdyDropdownBase } from "../dropdown-base";

@Component({
  selector: "mdy-control-multiselect",
  standalone: true,
  imports: [
    MdyControlLabelComponent,
    MdyErrorListComponent,
    NgTemplateOutlet,
    MdyIconComponent,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MDY_OPTIONS_CONTROL,
      useExisting: forwardRef(() => MdyMultiselectComponent),
    },
  ],
  host: {
    class: "mdy-renderer mdy-renderer--multiselect",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <div class="mdy-multiselect" #wrapper [class.mdy-multiselect--open]="open()">
      <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="!!value() && value()!.length > 0"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    @if (label() || searchable()) {
      <div class="mdy-multiselect__header">
        @if (searchable()) {
          <button
            type="button"
            class="mdy-multiselect__search-btn"
            [disabled]="isDisabled()"
            (click)="toggleOverlay($event)"
            [attr.aria-label]="i18n.searchOptionsLabel"
          >
            @if (effectiveLoading()) {
              <mdy-icon name="LOADER" class="mdy-select__loader" style="font-size: 1rem;" />
            } @else {
              <mdy-icon name="SEARCH" />
            }
          </button>
        }
      </div>
    }
  </div>

    <div
      class="mdy-multiselect__options"
      role="group"
      [attr.aria-label]="label() || null"
      [attr.aria-invalid]="hasErrors()"
      [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
      [attr.aria-required]="ariaRequired() || isRequired()"
      [attr.aria-disabled]="effectiveAriaDisabled()"
    >
      @for (opt of filteredOptions(); track opt.value) {
        @if (optionTpl(); as tpl) {
           <button
            type="button"
            class="mdy-chip-wrapper"
            [disabled]="isDisabled()"
            (click)="onToggle(opt.value)"
          >
            <ng-container
              [ngTemplateOutlet]="tpl"
              [ngTemplateOutletContext]="{ $implicit: opt, selected: isSelected(opt.value) }"
            />
          </button>
        } @else {
          @if (mode() === "multi") {
            <div [class]="chipClasses(countOf(opt.value) > 0)" [title]="opt.label">
              <button
                type="button"
                class="mdy-chip__btn"
                [disabled]="isDisabled() || countOf(opt.value) === 0"
                (click)="decrement(opt.value)"
                [attr.aria-label]="i18n.decrease"
              >
                <mdy-icon name="MINUS" />
              </button>
              <span class="mdy-chip__label">{{ opt.label }}</span>
              <span class="mdy-chip__count">&times;{{ countOf(opt.value) }}</span>
              <button
                type="button"
                class="mdy-chip__btn"
                [disabled]="isDisabled()"
                (click)="increment(opt.value)"
                [attr.aria-label]="i18n.increase"
              >
                <mdy-icon name="PLUS" />
              </button>
            </div>
          } @else {
            <button
              type="button"
              [class]="chipClasses(isSelected(opt.value))"
              [disabled]="isDisabled()"
              [title]="opt.label"
              [attr.aria-pressed]="isSelected(opt.value)"
              (click)="onToggle(opt.value)"
              (blur)="markAsTouched()"
            >
              <mdy-icon name="CHECKMARK" class="mdy-chip__check" />
              <span class="mdy-chip__label">{{ opt.label }}</span>
            </button>
          }
        }
      }
    </div>

    <mdy-overlay-panel
      [open]="open()"
      [position]="position()"
      [alignment]="alignment()"
      [coords]="coords()"
      [maxHeight]="maxHeight()"
      [hasBackdrop]="position() === 'overlay'"
      [widthMode]="'match-anchor'"
      [panelClass]="'mdy-multiselect-overlay__panel mdy-multiselect__dropdown mdy-popup'"
      [kind]="'multiselect'"
      (close)="closeOverlay()"
    >
      <input
        #overlayInput
        type="text"
        class="mdy-multiselect-overlay__input"
        [placeholder]="i18n.searchPlaceholder"
        autocomplete="off"
        [value]="searchQuery()"
        (input)="onSearchInput($event)"
        (keydown)="onOverlayKeydown($event)"
      />
      <div class="mdy-multiselect__options mdy-multiselect-overlay__grid">
        @for (opt of searchResults(); track opt.value; let i = $index) {
          @if (mode() === "multi") {
            <div [class]="chipClasses(countOf(opt.value) > 0)">
              <button
                type="button"
                class="mdy-chip__btn"
                (click)="decrement(opt.value)"
                [disabled]="countOf(opt.value) === 0"
                [attr.aria-label]="i18n.decrease"
              >
                <mdy-icon name="MINUS" />
              </button>
              <span class="mdy-chip__label">{{
                opt.label
              }}</span>
              <span class="mdy-chip__count"
                >&times;{{ countOf(opt.value) }}</span
              >
              <button
                type="button"
                class="mdy-chip__btn"
                (click)="increment(opt.value)"
                [attr.aria-label]="i18n.increase"
              >
                <mdy-icon name="PLUS" />
              </button>
            </div>
          } @else {
            <button type="button" [class]="chipClasses(isSelected(opt.value))" (click)="onOverlaySelect(opt.value)">
              <span class="mdy-chip__label">{{ opt.label }}</span>
            </button>
          }
        } @empty {
          <div class="mdy-multiselect-overlay__empty">
            @if (effectiveLoading()) {
              <div class="mdy-select__loading-content">
                <mdy-icon name="LOADER" class="mdy-select__loader" />
                <span>{{ loadingText() || i18n.loading }}</span>
              </div>
            } @else {
              {{ i18n.noResults }}
            }
          </div>
        }
      </div>
    </mdy-overlay-panel>

    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyMultiselectComponent<TValue = string>
  extends MdyDropdownBase<ReadonlyArray<TValue>, TValue>
  implements MdyOptionsControl<TValue> {
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "multiselect" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.multiselect;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly mode = input<"single" | "multi">("single");

  readonly filterFn = input<((value: TValue) => boolean) | undefined>(undefined);

  protected readonly fieldId = `mdy-control-multiselect-${MdyBaseControl.nextId()}`;

  protected readonly filteredOptions = computed(() => {
    const fn = this.filterFn();
    return fn ? this.effectiveOptions().filter((o) => fn(o.value)) : this.effectiveOptions();
  });

  protected readonly searchResults = computed(() => {
    let opts = this.filteredOptions();
    if (this.mode() === "single") {
      const selected = this.selectedSet();
      opts = opts.filter((o) => !selected.has(String(o.value)));
    }
    return filterOptionsByQuery(opts, this.searchQuery());
  });

  private readonly overlayInputRef =
    viewChild<ElementRef<HTMLInputElement>>("overlayInput");
  private readonly activeOverlayIndex = signal(-1);

  protected onOverlayKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    const active = results[this.activeOverlayIndex()];
    const action = multiselectOverlayAction({
      key: event.key,
      open: this.open(),
      query: this.searchQuery(),
      activeKey: active ? this.optionKey(active.value) : null,
    });
    if (!action) return;
    event.preventDefault();
    if (action.type === "close") {
      this.closeOverlay();
      this.hostRef.nativeElement.querySelector(".mdy-multiselect__search-btn")?.focus();
      return;
    }
    if (action.type === "open") {
      this.openOverlay();
      return;
    }
    if (action.type === "move") {
      const next = optionNavigationIndex(event.key, Math.max(0, this.activeOverlayIndex()), results.length);
      if (next !== null) this.activeOverlayIndex.set(next);
      return;
    }
    if (action.type === "select" && active) this.onOverlaySelect(active.value);
  }

  protected readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const v of this.value() ?? []) {
      const key = this.optionKey(v);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  });

  protected readonly selectedSet = computed(
    () => new Set((this.value() ?? []).map((v) => this.optionKey(v))),
  );

  protected override onBeforeOpen(): void {
    super.onBeforeOpen();
    this.activeOverlayIndex.set(-1);
    afterNextRender(() => this.overlayInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  protected override onDocumentClick(event: Event): void {
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.closeOverlay();
    }
  }

  private commitMultiselect(intent: Parameters<typeof multiselectValueTransition<TValue>>[1]): void {
    const current = this.value() ?? [];
    const next = multiselectValueTransition(current, intent);
    if (next === current) return;
    this.dispatchValueIntent<ReadonlyArray<TValue>>("multiselect", { type: "input", value: next });
    if (intent.type !== "clear") {
      const matched = this.effectiveOptions().find((option) => this.optionKey(option.value) === this.optionKey(intent.value));
      if (matched) this.selectionChange.emit(matched);
    }
  }

  /**
   * The classes a chip carries: the primitive, the variant its mode implies, and its state.
   *
   * `multiselectChipClasses` in @modyra/widgets answers this for every renderer, so a chip drawn
   * here and a chip drawn by another adapter are the same chip — and the foundation's variants stay
   * the only place that decides what one looks like.
   */
  protected chipClasses(selected: boolean): string {
    return multiselectChipClasses({ mode: this.mode(), selected }).join(" ");
  }

  protected isSelected(optValue: TValue): boolean {
    return this.selectedSet().has(this.optionKey(optValue));
  }

  protected onToggle(optValue: TValue): void {
    this.commitMultiselect({ type: "toggle", value: optValue });
  }

  protected countOf(optValue: TValue): number {
    return this.counts().get(this.optionKey(optValue)) ?? 0;
  }

  protected increment(optValue: TValue): void {
    this.commitMultiselect({ type: "increment", value: optValue });
  }

  protected decrement(optValue: TValue): void {
    this.commitMultiselect({ type: "decrement", value: optValue });
  }

  public resetSelection(): void {
    this.commitMultiselect({ type: "clear" });
  }

  protected onOverlaySelect(optValue: TValue): void {
    this.commitMultiselect({ type: "increment", value: optValue });
    if (shouldCloseMultiselectOverlay(this.mode(), this.searchResults().length)) this.closeOverlay();
  }
}
