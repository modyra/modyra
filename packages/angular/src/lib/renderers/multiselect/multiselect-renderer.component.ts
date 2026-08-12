import { optionsWithUnrecognizedValues, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
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
import { filterOptionsByQuery } from "@modyra/core/ui";
import type { MdyMultiselectMode } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  multiselectOverlayAction,
  multiselectChipClasses,
  multiselectValueTransition,
  optionNavigationIndex,
  shouldCloseMultiselectOverlay,
  createMultiselectFieldController,
  MDY_CHIP_CLASSES,
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
  imports: [MdyPartDirective, 
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
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="!!value() && value()!.length > 0"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />
    <div class="mdy-multiselect" #wrapper [class.mdy-multiselect--open]="open()">

    @if (label() || searchable()) {
      <div class="mdy-multiselect__header">
        @if (searchable()) {
          <button
            type="button"
            class="mdy-multiselect__search-btn"
            [id]="fieldId"
            [mdyPart]="openerPart()"
            [disabled]="isDisabled()"
            (click)="toggleOverlay($event)"
            (keydown)="onOverlayKeydown($event)"
            [attr.aria-label]="i18n.searchOptionsLabel"
            [attr.aria-invalid]="hasErrors()"
            [attr.aria-disabled]="effectiveAriaDisabled()"
            [attr.aria-describedby]="describedById(fieldId)"
            [attr.aria-label]="controlAriaLabel()"
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

    <!-- The description belongs on the control the label names, which is the search button. A
         reference on this group described the errors to a container the user never lands on. -->
    <div
      class="mdy-multiselect__options"
      role="group"
      [attr.aria-label]="controlAriaLabel()"
      [attr.aria-disabled]="effectiveAriaDisabled()"
    >
      @for (opt of filteredOptions(); track opt.value) {
        @if (optionTpl(); as tpl) {
           <button
            type="button"
            [class]="chip.wrapper"
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
                [class]="chip.step"
                [disabled]="isDisabled() || countOf(opt.value) === 0"
                (click)="decrement(opt.value)"
                [attr.aria-label]="i18n.decrease"
              >
                <mdy-icon name="MINUS" />
              </button>
              <span [class]="chip.label">{{ opt.label }}</span>
              <span [class]="chip.count">&times;{{ countOf(opt.value) }}</span>
              <button
                type="button"
                [class]="chip.step"
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
              <mdy-icon name="CHECKMARK" [class]="chip.check" />
              <span [class]="chip.label">{{ opt.label }}</span>
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
      [hasBackdrop]="position() === 'overlay'"
      [widthMode]="'match-anchor'"
      [panelClass]="popupClass"
      [panelId]="popupId()"
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
                [class]="chip.step"
                (click)="decrement(opt.value)"
                [disabled]="countOf(opt.value) === 0"
                [attr.aria-label]="i18n.decrease"
              >
                <mdy-icon name="MINUS" />
              </button>
              <span [class]="chip.label">{{
                opt.label
              }}</span>
              <span [class]="chip.count"
                >&times;{{ countOf(opt.value) }}</span
              >
              <button
                type="button"
                [class]="chip.step"
                (click)="increment(opt.value)"
                [attr.aria-label]="i18n.increase"
              >
                <mdy-icon name="PLUS" />
              </button>
            </div>
          } @else {
            <button type="button" [class]="chipClasses(isSelected(opt.value))" (click)="onOverlaySelect(opt.value)">
              <span [class]="chip.label">{{ opt.label }}</span>
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

    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
  `,
})
export class MdyMultiselectComponent<TValue = string>
  extends MdyDropdownBase<ReadonlyArray<TValue>, TValue>
  implements MdyOptionsControl<TValue> {
  /* The popup wears what the catalogue says it wears. Restated in the template, a class added
     to the contract reached the renderers that derive and stopped at this one. */
  protected readonly popupClass = MDY_WIDGET_CONTRACTS.multiselect.parts.popup.classes.join(" ");
  /** The chip vocabulary, so no class for one is spelled in this template. */
  protected readonly chip = MDY_CHIP_CLASSES;
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "multiselect" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.multiselect;
  protected override readonly widgetKind = "multiselect" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly mode = input<MdyMultiselectMode>("single");

  readonly filterFn = input<((value: TValue) => boolean) | undefined>(undefined);

  protected readonly fieldId = `mdy-control-multiselect-${MdyBaseControl.nextId()}`;

  private readonly controller = this.adoptFieldController(
    (handle, widgetId) => createMultiselectFieldController<TValue>(
      { widgetId, handle: handle as never, options: this.filteredOptions(), mode: this.mode() }),
    (c) => {
      c.setOptions(this.filteredOptions());
      c.dispatch({ type: "search", query: this.searchQuery() });
    },
  );

  /** The id the opener names, which the projected panel has to carry. */
  protected readonly popupId = computed(
    () => overlayControlledId("multiselect", this.fieldId) ?? "",
  );

  /** The relation between this widget's opener and the overlay it opens. */
  protected readonly openerPart = computed(
    () => projectOverlayOpenerA11y("multiselect", { widgetId: this.fieldId, open: this.open() })!,
  );

  /**
   * What this control paints: the declared options, plus every held value they do not contain. Read
   * from here rather than from the controller's state, which is built out of this list.
   */
  protected readonly paintedOptions = computed(() =>
    optionsWithUnrecognizedValues(this.effectiveOptions(), this.value() ?? []),
  );

  protected readonly filteredOptions = computed(() => {
    const fn = this.filterFn();
    const painted = this.paintedOptions();
    return fn ? painted.filter((o) => fn(o.value)) : painted;
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
    // Tab keeps its native meaning: the list closes and the browser carries focus onward. Cancelling
    // it leaves the user inside a panel being torn down.
    if (event.key !== "Tab") event.preventDefault();
    if (action.type === "close") {
      this.closeOverlay();
      // The action says whether focus comes back. Escape hands it to the button that opened the
      // list; Tab is already on its way elsewhere, and pulling it back traps the user in the field.
      if (action.restoreFocus) {
        this.hostRef.nativeElement.querySelector(".mdy-multiselect__search-btn")?.focus();
      }
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

  // What is selected and how many of each: the controller's own state, not counted twice here.
  protected readonly counts = computed(() => this.controller()?.state().counts ?? new Map<string, number>());
  protected readonly selectedSet = computed(() => this.controller()?.state().selectedKeys ?? new Set<string>());

  protected override onBeforeOpen(): void {
    super.onBeforeOpen();
    this.activeOverlayIndex.set(-1);
    afterNextRender(() => this.overlayInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  /** The chips and the search box sit outside the wrapper, so the whole host is the boundary. */
  protected override overlayContains(target: Node): boolean {
    return this.hostRef.nativeElement.contains(target);
  }

  /** Closing here also clears the search query, which `applyLifecycle` alone does not do. */
  protected override dismissFromOutside(): void {
    this.closeOverlay();
  }

  /**
   * One selection change, decided by the controller for this kind. This renderer contributes only
   * the matched option, which is Angular's own output and nothing the contract knows about.
   */
  private commitMultiselect(intent: Parameters<typeof multiselectValueTransition<TValue>>[1]): void {
    const before = this.value() ?? [];
    this.controller()?.dispatch(
      intent.type === "clear"
        ? { type: "clear" }
        : { type: intent.type, optionKey: this.optionKey(intent.value) },
    );
    if (this.value() === before || intent.type === "clear") return;
    const matched = this.paintedOptions().find(
      (option) => this.optionKey(option.value) === this.optionKey(intent.value),
    );
    if (matched) this.selectionChange.emit(matched);
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
