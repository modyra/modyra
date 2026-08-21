import { chipFocusAfterRemoval, keyBindingFor, multiselectAnnouncement, optionsWithUnrecognizedValues, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
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
    <!-- The shell every other kind sits in. Without it this renderer's multiselect was outside the
         row system entirely: anything a theme states about the input wrapper — the frame, the
         disabled and readonly surfaces, the error underline — reached three kinds of four here. -->
    <div
      class="mdy-input-wrapper"
      [class.mdy-input-wrapper--disabled]="isDisabled()"
      [class.mdy-input-wrapper--readonly]="isReadonly()"
      [class.mdy-input-wrapper--error]="paintsAsInvalid()"
    >
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
              [attr.tabindex]="activeChip() === held.key ? 0 : -1"
              role="group"
              [attr.data-key]="held.key"
              (focus)="activeChipKey.set(held.key)"
              (keydown)="onChipKeydown($event, held.key)"
              [attr.aria-label]="held.count > 1 ? held.label + ', ' + held.count : held.label"
              [title]="held.label"
            >
              @if (mode() === "multi") {
                <button
                  type="button"
                  [class]="chip.step"
                  tabindex="-1"
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
                  tabindex="-1"
                  [attr.aria-label]="i18n.chipIncrementLabel"
                  (click)="increment(held.value); $event.stopPropagation()"
                ><mdy-icon name="PLUS" /></button>
              }
              <button
                type="button"
                [class]="chip.remove"
                tabindex="-1"
                [attr.aria-label]="i18n.chipRemoveLabel"
                (click)="removeChip(held.key, held.value); $event.stopPropagation()"
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
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this.open());
    if (!binding) return;
    // The chip's keys are the chip's. Left to bubble, the control's own handler answers the same
    // keys a second time and its answer lands on top of this one.
    event.stopPropagation();
    const order = this.chosen().map((c) => c.key);

    if (binding.intent === "move") {
      event.preventDefault();
      const at = order.indexOf(optionKey);
      const to = binding.toEnd
        ? (binding.by === -1 ? 0 : order.length - 1)
        : Math.max(0, Math.min(order.length - 1, at + (binding.by ?? 1)));
      this.focusChip(order[to]);
      return;
    }
    if (binding.intent === "remove") {
      event.preventDefault();
      const held = this.chosen().find((c) => c.key === optionKey);
      // Backspace goes back, Delete goes on — the convention every text field has.
      if (held) this.removeChip(optionKey, held.value, event.key === "Backspace" ? "backward" : "forward");
      return;
    }
    if (binding.intent !== "reorder" || !this.reorderable()) return;
    event.preventDefault();
    this.controller()?.dispatch({
      type: "move-selected", optionKey, to: order.indexOf(optionKey) + (binding.by ?? 1),
    });
    this.focusChip(optionKey);
  }

  /**
   * Which chip carries the strip's single tab stop.
   *
   * A roving index: one stop for the whole strip. One stop per chip made the cost of tabbing past
   * the field grow with what it holds — twelve chosen values were twenty-six presses.
   */
  protected readonly activeChipKey = signal<string | null>(null);
  protected readonly activeChip = computed(() => {
    const order = this.chosen().map((c) => c.key);
    const held = this.activeChipKey();
    return held !== null && order.includes(held) ? held : order[0] ?? null;
  });

  private focusChip(key: string | undefined): void {
    if (key === undefined) return;
    this.activeChipKey.set(key);
    afterNextRender(
      () => (this.hostRef.nativeElement.querySelector(`[data-key="${key}"]`) as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }

  /**
   * Takes a value off and puts focus where the contract says it goes.
   *
   * Left to the browser, focus lands on whatever now occupies that position — the next chip while
   * one exists, and the document at the end of the strip.
   */
  protected removeChip(optionKey: string, value: TValue, direction: "forward" | "backward" = "forward"): void {
    const next = chipFocusAfterRemoval(this.chosen().map((c) => c.key), optionKey, direction);
    this.onToggle(value);
    afterNextRender(() => {
      const host = this.hostRef.nativeElement;
      const landing = next === null
        ? host.querySelector(".mdy-multiselect__trigger")
        : host.querySelector(`[data-key="${next}"] .${MDY_CHIP_CLASSES.remove}`);
      ((landing ?? host.querySelector(".mdy-multiselect__trigger")) as HTMLElement | null)?.focus();
    }, { injector: this.injector });
  }

  /**
   * The change, not the list, and nothing while the popup is open.
   *
   * Seeded from what the field already holds, because a value that arrived with the form is not
   * something the person just did.
   */
  private saidLast: readonly string[] | null = null;
  protected readonly announcementText = computed(() => {
    const now = this.chosen().map((c) => c.key);
    if (this.saidLast === null) { this.saidLast = now; return ""; }
    const said = multiselectAnnouncement(
      this.saidLast, now,
      { added: this.i18n.selectionAdded, removed: this.i18n.selectionRemoved, empty: this.i18n.selectionEmpty },
      (key) => this.chosen().find((c) => c.key === key)?.label ?? this.labelOf(key as unknown as TValue),
      this.open(),
    );
    this.saidLast = now;
    return said;
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
