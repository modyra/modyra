import { keyBindingFor, optionsWithUnrecognizedValues, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { filterOptionsByQuery } from "@modyra/widgets";
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
import type { MdyOverlayBranch, MdyOverlayOwner } from "../../core/overlay-control.directive";

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
      <!-- The control a person presses, holding what was chosen. The label names it and the
           combobox role sits here, because this is what holds the field's value — a magnifier
           beside the field carried the role and none of the value. -->
      <button
        type="button"
        class="mdy-multiselect__trigger"
        [id]="fieldId"
        [mdyPart]="openerPart()"
        [disabled]="isDisabled()"
        (click)="toggleOverlay($event)"
        (keydown)="onOverlayKeydown($event)"
        [attr.aria-invalid]="paintsAsInvalid()"
        [attr.aria-disabled]="effectiveAriaDisabled()"
        [attr.aria-readonly]="isReadonly() ? 'true' : null"
        [attr.aria-describedby]="describedById(fieldId)"
        [attr.aria-label]="controlAriaLabel()"
      >
        <span class="mdy-multiselect__chips">
          <!-- One chip per distinct value with how many, because a repeated value is a quantity:
               incrementing takes one of something to three. One chip per entry would make undoing
               one decision three separate removals. -->
          @for (held of chosen(); track held.key) {
            <span
              [class]="chipClasses(true)"
              tabindex="0"
              role="group"
              [attr.data-key]="held.key"
              (keydown)="onChipKeydown($event, held.key)"
              [attr.aria-label]="held.count > 1 ? held.label + ', ' + held.count : held.label"
              [title]="held.label"
            >
              @if (mode() === "multi") {
                <button
                  type="button"
                  [class]="chip.step"
                  [attr.aria-label]="i18n.chipDecrementLabel"
                  (click)="decrement(held.value); $event.stopPropagation()"
                ><mdy-icon name="MINUS" /></button>
              }
              <span [class]="chip.label">{{ held.label }}</span>
              <span [class]="chip.count" [hidden]="held.count <= 1">{{ held.count > 1 ? held.count : "" }}</span>
              @if (mode() === "multi") {
                <button
                  type="button"
                  [class]="chip.step"
                  [attr.aria-label]="i18n.chipIncrementLabel"
                  (click)="increment(held.value); $event.stopPropagation()"
                ><mdy-icon name="PLUS" /></button>
              }
              <button
                type="button"
                [class]="chip.remove"
                [attr.aria-label]="i18n.chipRemoveLabel"
                (click)="onToggle(held.value); $event.stopPropagation()"
              ></button>
            </span>
          }
        </span>
        @if (chosen().length === 0) {
          <span class="mdy-multiselect__placeholder">{{ label() }}</span>
        }
        @if (effectiveLoading()) {
          <mdy-icon name="LOADER" class="mdy-select__loader" style="font-size: 1rem;" />
        }
        <span class="mdy-multiselect__arrow" aria-hidden="true"></span>
      </button>
      <!-- Said rather than shown: a choice lands and the strip is the only confirmation, which is
           the one a person using a screen reader does not get. -->
      <div
        class="mdy-multiselect__announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >{{ announcementText() }}</div>
    </div>

    <mdy-overlay-panel
      [open]="open()"
      [position]="position()"
      [alignment]="alignment()"
      [coords]="coords()"
      [hasBackdrop]="position() === 'overlay'"
      [widthMode]="'match-anchor'"
      [panelClass]="popupClass"
      [dialogLabel]="i18n.searchOptionsLabel"
      [panelId]="popupId()"
      [kind]="'multiselect'"
      (close)="closeOverlay()"
    >
      @if (searchable()) {
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
      }
      <div class="mdy-multiselect__options mdy-multiselect-overlay__grid">
        @for (opt of searchResults(); track opt.value; let i = $index) {
          <div [class]="chip.wrapper">
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
              <mdy-icon name="CHECKMARK" [class]="chip.check" />
              <span [class]="chip.label">{{ opt.label }}</span>
            </button>
          }
          </div>
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
  /** Whether a person may rearrange what they chose. Off by default: most lists have an order nobody chose. */
  readonly reorderable = input(false, { transform: booleanAttribute });

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
        this.hostRef.nativeElement.querySelector(".mdy-multiselect__trigger")?.focus();
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


  /** The controller's `open` is this kind's open state; see `MdyOverlayControl.overlayOwner`. */
  protected override overlayOwner(): MdyOverlayOwner | undefined {
    return this.controller() as MdyOverlayOwner | undefined;
  }

  protected override onBeforeOpen(): void {
    super.onBeforeOpen();
    this.activeOverlayIndex.set(-1);
    afterNextRender(() => this.overlayInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  /** The chips and the search box sit outside the wrapper, so the whole host is the boundary. */
  protected override overlayBranch(): MdyOverlayBranch {
    return { root: this.hostRef.nativeElement };
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

  /**
   * What was chosen, one entry per distinct value with how many of it.
   *
   * Read from the value rather than from the option list, and never from the *filtered* one: the
   * order the strip shows is the order the value has, and a strip reading what a search matches
   * would empty itself as somebody typed.
   */
  protected readonly chosen = computed(() => {
    const tally = new Map<string, { key: string; value: TValue; label: string; count: number }>();
    for (const value of (this.value() ?? []) as readonly TValue[]) {
      const key = this.optionKey(value);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { key, value, label: this.labelOf(value), count: 1 });
    }
    return [...tally.values()];
  });

  /**
   * Rearranging what was chosen, from the chip a person is looking at.
   *
   * The keys are the contract's, and so is the direction: the strip runs in the writing direction,
   * so `ArrowLeft` moves a chip *later* in a right-to-left document, and a renderer reading the key
   * rather than the binding would have to know that.
   */
  protected onChipKeydown(event: KeyboardEvent, optionKey: string): void {
    if (!this.reorderable()) return;
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this.open());
    if (binding?.intent !== "reorder") return;
    event.preventDefault();
    const order = this.chosen().map((c) => c.key);
    this.controller()?.dispatch({
      type: "move-selected", optionKey, to: order.indexOf(optionKey) + (binding.by ?? 1),
    });
    afterNextRender(
      () => (this.hostRef.nativeElement.querySelector(`[data-key="${optionKey}"]`) as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }

  /** The whole selection, so two announcements differ whenever the selection does. */
  protected readonly announcementText = computed(() => {
    const held = (this.value() ?? []) as readonly TValue[];
    if (held.length === 0) return "";
    return `${held.length} selected: ${this.chosen().map((c) => c.label).join(", ")}`;
  });

  /** The words a chosen value is shown by, falling back to the value for one the options lost. */
  private labelOf(value: TValue): string {
    return this.effectiveOptions().find((o) => this.optionKey(o.value) === this.optionKey(value))?.label
      ?? String(value);
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
