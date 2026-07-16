import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdyOptionDirective } from "../../control/option.directive";
import { MdyOptionsOverlayControl } from "../../core/options-overlay-control.directive";
import { filterOptionsByQuery } from "../../core/options-utils";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MDY_OPTIONS_CONTROL } from "../../core/tokens";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOptionsControl, MdySelectOption } from "../../core/types";

/**
 * Multiselect renderer component.
 * Renders selectable filter chips and delivers ReadonlyArray<TValue>.
 */
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
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
    // Escape is handled by MdyOverlayControl's dynamic document listener,
    // registered only while the overlay is open (R19). onDocumentClick is
    // overridden below to use the host element rather than the narrower
    // #wrapper reference from MdyOverlayControl.
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
            <div
              class="mdy-chip mdy-chip--counter"
              [class.mdy-chip--selected]="countOf(opt.value) > 0"
              [title]="opt.label"
            >
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
              class="mdy-chip mdy-chip--centered"
              [class.mdy-chip--selected]="isSelected(opt.value)"
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
      [panelClass]="'mdy-multiselect-overlay__panel'"
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
        (keydown.escape)="closeOverlay()"
      />
      <div class="mdy-multiselect__options mdy-multiselect-overlay__grid">
        @for (opt of searchResults(); track opt.value; let i = $index) {
          @if (mode() === "multi") {
            <div
              class="mdy-chip mdy-chip--counter"
              [class.mdy-chip--selected]="countOf(opt.value) > 0"
            >
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
            <button
              type="button"
              class="mdy-chip"
              [class.mdy-chip--selected]="isSelected(opt.value)"
              (click)="onOverlaySelect(opt.value)"
            >
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
  extends MdyOptionsOverlayControl<ReadonlyArray<TValue>, TValue>
  implements MdyOptionsControl<TValue> {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  protected override readonly minSpace = 250;
  private readonly injector = inject(Injector);

  readonly mode = input<"single" | "multi">("single");
  readonly selectionChange = output<MdySelectOption<TValue>>();

  /**
   * Optional filter predicate applied to options before display.
   * Receives the option *value* and returns `true` to show the option.
   * When absent, all options are shown.
   */
  readonly filterFn = input<((value: TValue) => boolean) | undefined>(undefined);

  /** Custom option template provided via `<ng-template mdyOption>`. */
  protected readonly optionTpl = contentChild(MdyOptionDirective, {
    read: TemplateRef,
  });

  protected readonly fieldId = `mdy-control-multiselect-${MdyBaseControl.nextId()}`;

  /** Options after applying the optional `filterFn` predicate. */
  protected readonly filteredOptions = computed(() => {
    const fn = this.filterFn();
    return fn ? this.effectiveOptions().filter((o) => fn(o.value)) : this.effectiveOptions();
  });

  /** Options available in the search overlay (filtered by predicate + query + mode). */
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

  /**
   * Pre-computed count map for multi-mode.
   * Keyed by String(value): matching is loose, consistent with the select
   * renderer (B20), so numeric values survive string round-trips.
   */
  protected readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const v of this.value() ?? []) {
      const key = String(v);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  });

  /** Pre-computed selection set for single-mode (loose String matching, B20). */
  protected readonly selectedSet = computed(
    () => new Set((this.value() ?? []).map((v) => String(v))),
  );

  // ── Overlay hooks ───────────────────────────────────────────────────────────

  protected override onBeforeOpen(): void {
    this.searchQuery.set("");
    afterNextRender(() => this.overlayInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * Override to check against the full host element rather than the narrow
   * #wrapper (header div). The overlay panel is a DOM child of the host even
   * when position:fixed, so host.contains() correctly excludes panel clicks.
   */
  protected override onDocumentClick(event: Event): void {
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.closeOverlay();
    }
  }

  // ── Single-mode helpers ─────────────────────────────────────────────────────

  protected isSelected(optValue: TValue): boolean {
    return this.selectedSet().has(String(optValue));
  }

  protected onToggle(optValue: TValue): void {
    const current = this.value() ?? [];
    const key = String(optValue);
    const next: ReadonlyArray<TValue> = current.some((v) => String(v) === key)
      ? current.filter((v) => String(v) !== key)
      : [...current, optValue];
    this.setValue(next);
    this.markAsDirty();

    const matched = this.effectiveOptions().find((o) => String(o.value) === key);
    if (matched) this.selectionChange.emit(matched);
  }

  // ── Multi-mode (counter) helpers ────────────────────────────────────────────

  protected countOf(optValue: TValue): number {
    return this.counts().get(String(optValue)) ?? 0;
  }

  protected increment(optValue: TValue): void {
    this.setValue([...(this.value() ?? []), optValue]);
    this.markAsDirty();

    const matched = this.effectiveOptions().find(
      (o) => String(o.value) === String(optValue),
    );
    if (matched) this.selectionChange.emit(matched);
  }

  protected decrement(optValue: TValue): void {
    const arr = [...(this.value() ?? [])];
    const idx = arr.findIndex((v) => String(v) === String(optValue));
    if (idx >= 0) {
      arr.splice(idx, 1);
      this.setValue(arr);
      this.markAsDirty();

      const matched = this.effectiveOptions().find(
        (o) => String(o.value) === String(optValue),
      );
      if (matched) this.selectionChange.emit(matched);
    }
  }

  // ── Search overlay ──────────────────────────────────────────────────────────

  public resetSelection(): void {
    this.setValue([]);
    this.markAsDirty();
  }

  protected onOverlaySelect(optValue: TValue): void {
    if (this.mode() === "single") {
      const current = this.value() ?? [];
      const key = String(optValue);
      if (!current.some((v) => String(v) === key)) {
        this.setValue([...current, optValue]);
        this.markAsDirty();
        const matched = this.effectiveOptions().find(
          (o) => String(o.value) === key,
        );
        if (matched) this.selectionChange.emit(matched);
      }
      if (this.searchResults().length === 0) {
        this.closeOverlay();
      }
    } else {
      this.increment(optValue);
    }
  }
}
