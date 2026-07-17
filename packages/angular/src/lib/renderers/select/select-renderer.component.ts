import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  Signal,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  WritableSignal,
} from "@angular/core";
import { filterOptionsByQuery } from "@modyra/core/options-utils";
import { MdyAngularSelectAdapter, MdyWidgetRuntime } from "../../widget-runtime";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdyOptionDirective } from "../../control/option.directive";
import { MdyGlassDirective } from "../../core/directives/glass.directive";
import { MDY_I18N_MESSAGES } from "../../core/i18n";
import { MdyOptionsOverlayControl } from "../../core/options-overlay-control.directive";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MDY_OPTIONS_CONTROL } from "../../core/tokens";
import { MdyOptionsControl, MdySelectOption } from "../../core/types";

function mapKeyToMoveTarget(
  key: string,
): "next" | "previous" | "first" | "last" | null {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/**
 * Select renderer component.
 *
 * When a custom `<ng-template mdyOption>` is provided, renders a fully custom
 * dropdown with HTML content in options. Otherwise falls back to a native
 * `<select>` element.
 */
@Component({
  selector: "mdy-control-select",
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyIconComponent,
    MdyGlassDirective,
    MdyOverlayPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MDY_OPTIONS_CONTROL,
      useExisting: forwardRef(() => MdySelectComponent),
    },
  ],
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--select",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
    "(keydown)": "onKeydown($event)",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="value() !== null"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    @if (optionTpl() || searchable()) {
      <!-- Custom dropdown -->
      <div class="mdy-select" #wrapper>
        <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
          @if (prefix(); as p) {
            <div class="mdy-input-prefix">
              <ng-container [ngTemplateOutlet]="p.template" />
            </div>
          }
          <button
            type="button"
            class="mdy-select__trigger"
            [id]="fieldId"
            [disabled]="isDisabled()"
            [attr.aria-expanded]="open()"
            [attr.aria-haspopup]="'listbox'"
            [attr.aria-activedescendant]="
              activeIndex() >= 0 ? fieldId + '-opt-' + activeIndex() : null
            "
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-label]="label() || null"
            (click)="toggleOverlay($event)"
            (blur)="onBlur($event)"
          >
            @if (selectedOption(); as sel) {
              <span class="mdy-select__value">
                @if (optionTpl(); as tpl) {
                  <ng-container
                    [ngTemplateOutlet]="tpl"
                    [ngTemplateOutletContext]="{ $implicit: sel, selected: true }"
                  />
                } @else {
                  {{ sel.label }}
                }
              </span>
            } @else {
              <span class="mdy-select__placeholder">{{ placeholder() || '&nbsp;' }}</span>
            }
          </button>
          @if (effectiveLoading()) {
            <mdy-icon name="LOADER" class="mdy-select__loader" />
          } @else {
            <mdy-icon name="CHEVRON_DOWN" class="mdy-select__arrow" />
          }
          @if (suffix(); as s) {
            <div class="mdy-input-suffix">
              <ng-container [ngTemplateOutlet]="s.template" />
            </div>
          }
        </div>


        <mdy-overlay-panel
          [open]="open()"
          [position]="position()"
          [alignment]="alignment()"
          [coords]="coords()"
          [maxHeight]="maxHeight()"
          [hasBackdrop]="overlayMode()"
          [widthMode]="widthMode()"
          (close)="closeOverlay()"
        >
          <div
            mdyGlass
            class="mdy-select__dropdown"
            [class.mdy-select__dropdown--above]="dropUp()"
            [class.mdy-select__dropdown--overlay]="overlayMode()"
            [class.mdy-select__dropdown--right]="alignment() === 'right'"
          >
            @if (searchable()) {
              <input
                #searchInput
                type="text"
                class="mdy-select__search"
                [placeholder]="i18n.searchPlaceholder"
                autocomplete="off"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
              />
            }
            <ul
              class="mdy-select__list"
              role="listbox"
              [attr.aria-labelledby]="fieldId"
            >
              @for (opt of filteredOptions(); track opt.value; let i = $index) {
                <li
                  [id]="fieldId + '-opt-' + i"
                  role="option"
                  class="mdy-select__option"
                  [class.mdy-select__option--active]="activeIndex() === i"
                  [class.mdy-select__option--selected]="opt.value == value()"
                  [attr.aria-selected]="opt.value == value()"
                  (click)="selectOption(opt)"
                >
                  @if (optionTpl(); as tpl) {
                    <ng-container
                      [ngTemplateOutlet]="tpl"
                      [ngTemplateOutletContext]="{
                        $implicit: opt,
                        selected: opt.value == value()
                      }"
                    />
                  } @else {
                    <span class="mdy-select__option-label">{{ opt.label }}</span>
                  }
                </li>
              }
              @if (showCreateOption()) {
                <li
                  class="mdy-select__option mdy-select__option--create"
                  role="option"
                  (click)="onCreateOption()"
                >
                  {{ i18n.selectCreateOption(searchQuery().trim()) }}
                </li>
              }
              @if (filteredOptions().length === 0 && !showCreateOption()) {
                <li class="mdy-select__no-results" role="presentation">
                  @if (effectiveLoading()) {
                    <div class="mdy-select__loading-content">
                      <mdy-icon name="LOADER" class="mdy-select__loader" />
                      <span>{{ loadingText() || i18n.loading }}</span>
                    </div>
                  } @else {
                    {{ i18n.noResults }}
                  }
                </li>
              }
            </ul>
          </div>
        </mdy-overlay-panel>
      </div>
    } @else {
      <!-- Native select fallback -->
      <div class="mdy-input-wrapper" [class.mdy-input-wrapper--disabled]="isDisabled()">
         @if (prefix(); as p) {
            <div class="mdy-input-prefix">
              <ng-container [ngTemplateOutlet]="p.template" />
            </div>
          }
          <select
            [id]="fieldId"
            [value]="value() ?? ''"
            [disabled]="isDisabled()"
            (change)="onNativeChange($event)"
            (blur)="markAsTouched()"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
            [attr.aria-required]="ariaRequired() || isRequired()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-label]="label() || null"
            [style.opacity]="(value() === null || value() === undefined) ? '0.6' : '1'"
          >
            @if (placeholder() || value() === null || value() === undefined) {
              <option value="" disabled [selected]="value() === null || value() === undefined">
                {{ placeholder() || ' ' }}
              </option>
            }
            @for (opt of effectiveOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value == value()">
                {{ opt.label }}
              </option>
            }
          </select>
            <mdy-icon name="CHEVRON_DOWN" class="mdy-select__arrow" />
          @if (suffix(); as s) {
            <div class="mdy-input-suffix">
              <ng-container [ngTemplateOutlet]="s.template" />
            </div>
          }
      </div>
    }

    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdySelectComponent<TValue = string>
  extends MdyOptionsOverlayControl<TValue | null, TValue>
  implements MdyOptionsControl<TValue> {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  readonly placeholder = input<string>("");
  readonly disabled = input<boolean>(false);
  /**
   * Tagging: in a searchable select, shows a "Create «query»" row when the
   * query matches no option label. Selecting it emits `optionCreated` —
   * the consumer adds the option to its list and sets the value.
   */
  readonly allowCreate = input(false, { transform: booleanAttribute });
  readonly selectionChange = output<MdySelectOption<TValue>>();
  /** Fires with the trimmed query when the user picks the create row. */
  readonly optionCreated = output<string>();
  public override readonly isDisabled = computed(() => this.disabled() || this.fieldState().disabled());
  protected override readonly minSpace = 250;
  private readonly injector = inject(Injector);
  private readonly runtime = inject(MdyWidgetRuntime);
  private selectAdapter!: MdyAngularSelectAdapter<TValue>;
  private readonly _parkedValue: WritableSignal<TValue | null> = signal<TValue | null>(null);
  public readonly parkedValue: Signal<TValue | null> = this._parkedValue.asReadonly();


  constructor() {
    super();

    this.selectAdapter = new MdyAngularSelectAdapter<TValue>(
      {
        widgetId: this.fieldId,
        options: this.effectiveOptions(),
        value: this.value(),
        disabled: this.isDisabled(),
        readonly: this.fieldState().readonly(),
        invalid: this.hasErrors(),
        loading: this.effectiveLoading(),
        onChange: (value: TValue | null) => {
          if (value !== this.value()) {
            this.setValue(value);
            this.markAsDirty();
            const opt = this.effectiveOptions().find((o) => String(o.value) === String(value));
            if (opt) this.selectionChange.emit(opt);
          }
        },
      },
      this.runtime,
      this.injector,
    );

    this.selectAdapter.connectHandlers({
      setOpen: () => {
        // Open/close is driven by the component; controller commands are ignored here.
      },
      onChange: () => {
        // value change is already handled by the adapter's onChange callback.
      },
      onTouched: () => this.markAsTouched(),
      onDirty: () => this.markAsDirty(),
    });

    // Sync adapter with changing component inputs.
    effect(() => this.selectAdapter.setOptions(this.effectiveOptions()), { injector: this.injector });
    effect(() => this.selectAdapter.setValue(this.value()), { injector: this.injector });
    effect(() => this.selectAdapter.setDisabled(this.isDisabled()), { injector: this.injector });
    effect(() => this.selectAdapter.setReadonly(this.fieldState().readonly()), { injector: this.injector });
    effect(() => this.selectAdapter.setInvalid(this.hasErrors()), { injector: this.injector });
    effect(() => this.selectAdapter.setLoading(this.effectiveLoading()), { injector: this.injector });

    // Synchronization effect: when options change, re-verify the current value.
    // - Value found (loose match): normalize to the exact option value.
    // - Value not among the options: park it and clear the field; if a later
    //   options change makes it available again, restore it (e.g. async
    //   option loading or [mdyDependsOn] filtering).
    effect(() => {
      const options = this.effectiveOptions();
      const val = this.value();
      untracked(() => {
        if (val !== null && val !== undefined) {
          const matched = options.find((o) => String(o.value) === String(val));
          if (matched) {
            this._parkedValue.set(null);
            if (matched.value !== val) {
              this.setValue(matched.value);
            }
          } else if (options.length > 0) {
            this._parkedValue.set(val);
            this.setValue(null);
          }
        } else {
          const parked = this._parkedValue();
          if (parked !== null) {
            const matched = options.find((o) => String(o.value) === String(parked));
            if (matched) {
              this._parkedValue.set(null);
              this.setValue(matched.value);
            }
          }
        }
      });
    }, { injector: this.injector });
  }

  /** Custom option template provided via `<ng-template mdyOption>`. */

  protected readonly optionTpl = contentChild(MdyOptionDirective, {
    read: TemplateRef,
  });

  protected readonly fieldId = `mdy-control-select-${MdyBaseControl.nextId()}`;

  /** Whether the dropdown opens above the trigger. */
  protected readonly dropUp = computed(() => this.position() === "above");

  /** Whether the dropdown renders as a centered overlay (no space above or below). */
  protected readonly overlayMode = computed(
    () => this.position() === "overlay",
  );

  /** Index of the keyboard-active option (for arrow navigation). */
  protected readonly activeIndex = computed(() => {
    const key = this.selectAdapter.state().activeKey;
    if (key === null) return -1;
    return this.filteredOptions().findIndex((o) => this.optionKey(o) === key);
  });

  private optionKey(option: MdySelectOption<TValue>): string {
    return String(option.value);
  }

  /** The currently selected option object (for rendering in trigger). */
  protected readonly selectedOption = computed<MdySelectOption<TValue> | null>(
    () => {
      const v = this.value();
      if (v === null || v === undefined) return null;
      return (
        this.effectiveOptions().find(
          (o: MdySelectOption<TValue>) => String(o.value) === String(v),
        ) ?? null
      );
    },
  );

  /** Options filtered by the current search query. */
  protected readonly filteredOptions = computed(() =>
    filterOptionsByQuery(this.effectiveOptions(), this.selectAdapter.state().query),
  );

  /** Show the "create" row: tagging enabled, query set, no exact label match. */
  protected readonly showCreateOption = computed(() => {
    if (!this.allowCreate() || !this.searchable()) return false;
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return false;
    return !this.effectiveOptions().some(
      (o) => o.label.trim().toLowerCase() === query,
    );
  });

  protected onCreateOption(): void {
    const query = this.searchQuery().trim();
    if (!query) return;
    this.optionCreated.emit(query);
    this.closeOverlay();
  }

  private readonly searchInputRef =
    viewChild<ElementRef<HTMLInputElement>>("searchInput");

  // ── Custom dropdown interactions ────────────────────────────────────────────

  protected override openOverlay(event?: Event): void {
    super.openOverlay(event);
    this.selectAdapter.setOpen(true);
  }

  public override closeOverlay(): void {
    super.closeOverlay();
    this.selectAdapter.setOpen(false);
  }

  protected override onBeforeOpen(): void {
    this.searchQuery.set("");

    // Focus search input after DOM renders
    if (this.searchable()) {
      afterNextRender(() => this.searchInputRef()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected selectOption(opt: MdySelectOption<TValue>): void {
    this.selectAdapter.dispatch({ type: "select", optionKey: this.optionKey(opt) });
  }

  protected onBlur(event: FocusEvent): void {
    // Use relatedTarget to check where focus is going. When null
    // (click on non-focusable element), onDocumentClick handles closing.
    const next = event.relatedTarget as Node | null;
    if (next && !this.wrapperRef()?.nativeElement.contains(next)) {
      this.selectAdapter.dispatch({ type: "blur" });
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const isSearchFocused =
      this.searchInputRef()?.nativeElement === document.activeElement;

    // Navigation keys open the overlay if closed and move the active option.
    const navigates =
      !isSearchFocused || event.key === "ArrowDown" || event.key === "ArrowUp";
    const moveTarget = mapKeyToMoveTarget(event.key);

    if (moveTarget && navigates) {
      event.preventDefault();
      if (!this.open()) {
        this.openOverlay();
      }
      this.selectAdapter.dispatch({ type: "move", target: moveTarget });
      return;
    }

    switch (event.key) {
      case "Enter":
        event.preventDefault();
        if (this.showCreateOption()) {
          this.onCreateOption();
          return;
        }
        if (this.open()) {
          const key = this.selectAdapter.state().activeKey;
          if (key) this.selectAdapter.dispatch({ type: "select", optionKey: key });
        } else {
          this.openOverlay();
        }
        break;
      case " ":
        if (!isSearchFocused) {
          event.preventDefault();
          if (this.open()) {
            const key = this.selectAdapter.state().activeKey;
            if (key) this.selectAdapter.dispatch({ type: "select", optionKey: key });
          } else {
            this.openOverlay();
          }
        }
        break;
      case "Escape":
        if (this.open()) {
          event.preventDefault();
          this.selectAdapter.dispatch({ type: "close", restoreFocus: true });
        }
        break;
    }
  }

  protected override onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchChanged.emit(value);
    this.selectAdapter.dispatch({ type: "search", query: value });
  }

  // ── Native select fallback ──────────────────────────────────────────────────

  public resetSelection(): void {
    this.setValue(null);
    this.markAsDirty();
  }

  protected onNativeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const stringValue = target.value;
    const matched = this.effectiveOptions().find((o) => String(o.value) === stringValue);
    if (matched) {
      this.setValue(matched.value);
      this.selectionChange.emit(matched);
    } else {
      this.setValue(null);
    }
    this.markAsDirty();
  }
}
