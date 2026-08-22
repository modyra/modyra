import { wayBackSentence, chipTooltipOffset, hiddenChipCount, keepFocusedChipInView, chipDropIndex, chipFocusAfterRemoval, scrollChipStripByWheel, isTypeaheadCharacter, chipMovedAnnouncement, stateClass, keyBindingFor, multiselectAnnouncement, optionsWithUnrecognizedValues, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { NgTemplateOutlet } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
        [attr.aria-activedescendant]="activeDescendant()"
      >
        <span class="mdy-multiselect__chips" (wheel)="onStripWheel($event)">
          <!-- One chip per distinct value with how many, because a repeated value is a quantity:
               incrementing takes one of something to three. One chip per entry would make undoing
               one decision three separate removals. -->
          @for (held of chosen(); track held.key; let i = $index) {
            <span
              [class]="chipClasses(true)"
              [attr.tabindex]="activeChip() === held.key ? 0 : -1"
              [attr.role]="mode() === 'multi' ? 'spinbutton' : 'group'"
              [attr.aria-valuenow]="mode() === 'multi' ? held.count : null"
              [attr.aria-valuemin]="mode() === 'multi' ? 0 : null"
              [attr.aria-valuetext]="mode() === 'multi' ? (held.count > 1 ? held.label + ', ' + held.count : held.label) : null"
              [attr.data-key]="held.key"
              (focus)="activeChipKey.set(held.key); revealChipName($event, held.key); onChipFocused()"
              (pointerenter)="revealChipName($event, held.key)"
              (pointerleave)="hideChipName()"
              (blur)="hideChipName()"
              [attr.aria-describedby]="namedChip() === held.key ? fieldId + '__chiptip' : null"
              (pointerdown)="startChipDrag($event, held.key)"
              (keydown)="onChipKeydown($event, held.key)"
              [attr.aria-label]="held.count > 1 ? held.label + ', ' + held.count : held.label"
              [title]="held.label"
              [attr.aria-posinset]="i + 1"
              [attr.aria-setsize]="chosen().length"
            >
              @if (reorderable()) {
                <button
                  type="button"
                  [class]="chip.move"
                  tabindex="-1"
                  [attr.aria-label]="i18n.chipMoveEarlierLabel"
                  (click)="moveByPointer(held.key, -1); $event.stopPropagation()"
                ></button>
              }
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
              @if (reorderable()) {
                <button
                  type="button"
                  [class]="chip.move"
                  tabindex="-1"
                  [attr.aria-label]="i18n.chipMoveLaterLabel"
                  (click)="moveByPointer(held.key, 1); $event.stopPropagation()"
                ></button>
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
      <!-- How many chips are out of sight, and the way to all of them. ADR 0127 lets the row scroll
           only where something reaches what leaves it: the wheel is that for most people and nothing
           at all for a pointer with no horizontal axis, which is most desktop mice. -->
      @if (hiddenChips() > 0) {
        <button
          type="button"
          class="mdy-multiselect__overflow"
          [attr.aria-label]="i18n.chipsHidden.replace('{count}', hiddenChips().toString())"
          (click)="onOverflowPress($event)"
        >{{ i18n.chipsHiddenShort.replace("{count}", hiddenChips().toString()) }}</button>
      }
      <!-- Every choice off at once, beside the trigger rather than inside it: the trigger is a
           button, and a button inside a button is neither valid nor reachable. -->
      @if (chosen().length > 0 && !isDisabled() && !isReadonly()) {
        <button
          type="button"
          class="mdy-multiselect__clear-all"
          [attr.aria-label]="i18n.clearSelection"
          [disabled]="isDisabled()"
          (click)="onClearAll($event)"
        ><mdy-icon name="CLOSE" /></button>
      }
      <!-- The full name, for a chip the strip had to cut. Shown on hover and on focus: WCAG 1.4.13
           asks for both, and the title attribute is neither — it never appears for a keyboard or a
           touch user, who are exactly the people who cannot widen the chip. One element for the
           control, not one per chip: a child of the chip is part of the chip's own text. -->
      <span
        class="mdy-chip__tooltip"
        [id]="fieldId + '__chiptip'"
        role="tooltip"
        [style.inset-inline-start.px]="chipTipAt()"
        [hidden]="namedChip() === null"
      >{{ namedChipLabel() }}</span>
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
      <!-- A closed popup holds nothing. The panel hides itself, and its contents went on
           existing behind it: twelve option chips in the document of a control that looks
           closed, reachable by a screen reader and countable by anything walking the field. -->
      @if (open()) {
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
        <!-- The chip grid says what it is. The contract declares the role; a container left bare told
             a screen reader nothing about the set at all. -->
        <div
          class="mdy-multiselect__options mdy-multiselect-overlay__grid"
          [attr.role]="optionsRole"
          [attr.aria-label]="controlAriaLabel()"
        >
          @for (opt of searchResults(); track opt.value; let i = $index) {
            <div [class]="chip.wrapper" [attr.data-option-key]="optionKey(opt.value)">
            @if (mode() === "multi") {
              <div
                [class]="chipClasses(countOf(opt.value) > 0)"
                [id]="optionDomId(opt.value)"
                [class.mdy-chip--active]="activeOverlayKey() === optionKey(opt.value)"
              >
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
              <button
                type="button"
                [class]="chipClasses(isSelected(opt.value))"
                [id]="optionDomId(opt.value)"
                [class.mdy-chip--active]="activeOverlayKey() === optionKey(opt.value)"
                (click)="onOverlaySelect(opt.value)"
              >
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
      }
    </mdy-overlay-panel>

    <!-- The one way back, under the control. Untimed and in the page rather than in a toast: a
         message that takes itself away after five seconds is a time limit under WCAG 2.2.1, and an
         undo has no exception under it. It names the act, because one reversal covers three. -->
    @if (wayBack(); as offer) {
      <div class="mdy-multiselect__way-back">
        <span>{{ wayBackText() }}</span>
        <button
          type="button"
          class="mdy-multiselect__way-back-action"
          [disabled]="isDisabled() || isReadonly()"
          (click)="onWayBack()"
        >{{ i18n.wayBackLabel }}</button>
      </div>
    }

    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    } @else if (supportingText() || describedState()) {
      <!-- How many are chosen, in the field's own description: the state, asked for rather than
           announced, and one of the conditions ADR 0127 lets the scrolling row exist under. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        @if (projectedSupportingText(); as st) {
          <ng-container [ngTemplateOutlet]="st.template" />
        }
        {{ describedState() }}
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

  /** What the option grid announces itself as — the contract's answer, not this renderer's. */
  protected readonly optionsRole = MDY_WIDGET_CONTRACTS.multiselect.parts.options.role ?? null;

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
    // Every option, chosen or not, with the state that says which. Filtering the chosen ones out
    // was this renderer's own answer: the contract gives each option a `selected` state and, in
    // toggle mode, `aria-pressed` — both unreachable for a list that removes what was taken. It also
    // made the strip's overflow affordance a lie, because the values it says are out of sight are
    // exactly the ones such a list omits.
    return filterOptionsByQuery(this.filteredOptions(), this.searchQuery());
  });

  private readonly overlayInputRef =
    viewChild<ElementRef<HTMLInputElement>>("overlayInput");
  /**
   * Where the keyboard is in the open list — the controller's, given rather than held.
   *
   * This component kept its own index and moved it *before* asking what to take, so one ArrowDown
   * landed on the second option. A cursor is state the contract owns, and it is the third piece of
   * state this component kept a second copy of.
   */
  protected readonly activeOverlayKey = computed(() => this.controller()?.state().activeKey ?? null);

  protected onOverlayKeydown(event: KeyboardEvent): void {
    const action = multiselectOverlayAction({
      key: event.key,
      open: this.open(),
      query: this.searchQuery(),
      activeKey: this.activeOverlayKey(),
    });
    // A letter typed at an open list without a filter box moves the cursor to the first match. Only
    // without one: a searchable popup already answers typing by narrowing the list.
    if (!action && !this.searchable() && this.open() && isTypeaheadCharacter(event.key, event)) {
      event.preventDefault();
      this.controller()?.dispatch({ type: "typeahead", character: event.key });
      this.followCursor();
      return;
    }
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
    if (action.type === "move" || action.type === "select") {
      this.controller()?.dispatch(action as never);
      if (action.type === "move") this.followCursor();
      return;
    }
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

  /** How many chips the strip is hiding, measured from what the browser actually laid out. */
  protected readonly hiddenChips = signal(0);

  /** The way to the chips the strip cannot show: the list, where every one of them is. */
  protected onOverflowPress(event: Event): void {
    event.stopPropagation();
    this.openOverlay(event);
  }

  /**
   * Counts what the strip is hiding, after the render that drew it.
   *
   * How many fit depends on the labels, the theme's spacing and the width the host gave the field,
   * so this is a measurement and not a derivation from the number chosen.
   */
  protected readonly measureOverflow = effect(() => {
    this.chosen();
    // After the paint that drew the chips, not during the pass that decided them: `scrollWidth` on a
    // strip that has not been laid out yet answers about the previous state.
    queueMicrotask(() => {
      const strip = this.hostRef.nativeElement.querySelector(".mdy-multiselect__chips") as HTMLElement | null;
      if (strip === null) return;
      // The affordance takes its width out of the strip, so a chip the browser scrolled to on focus
      // is outside again by about that width. Whatever the strip ends up as wide as, the focused
      // chip is inside it.
      keepFocusedChipInView(strip);
      this.hiddenChips.set(hiddenChipCount(strip));
    });
  });

  /** Every choice off at once. The press must not reach the trigger behind it and reopen the popup. */
  protected onClearAll(event: Event): void {
    event.stopPropagation();
    this.controller()?.dispatch({ type: "clear" });
  }

  /** The one way back: it puts back what the last destructive act took, whichever act that was. */
  protected onWayBack(): void {
    this.controller()?.dispatch({ type: "undo" });
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
    // Asked as the chip. A key with no binding here belongs to the control and must reach it —
    // `ArrowDown` opens the popup from the trigger and steps the quantity from a counter chip.
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this.open(), "chip");
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
    if (binding.intent === "step") {
      event.preventDefault();
      // A counter chip announces itself as a spinbutton; these are the keys that make that true.
      this.controller()?.dispatch(
        event.key === "ArrowUp" ? { type: "increment", optionKey } : { type: "decrement", optionKey },
      );
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
    // Said out loud, and set before dispatching. This way of reordering has no *grabbed* state to
    // announce, so the movement itself is the only thing there is to say.
    const to = Math.max(0, Math.min(order.length - 1, order.indexOf(optionKey) + (binding.by ?? 1)));
    this.saySoon = chipMovedAnnouncement(
      this.i18n.selectionMoved,
      this.chosen().find((c) => c.key === optionKey)?.label ?? optionKey,
      to + 1, order.length,
    );
    this.controller()?.dispatch({ type: "move-selected", optionKey, to });
    this.focusChip(optionKey);
  }

  /**
   * Dragging a chip to a new place — the door the brief named, on the same intent as the other two.
   *
   * A threshold before it becomes a drag: a press that never travels is a press, and treating every
   * one as the beginning of a drag takes the chip's own controls away from anybody whose finger
   * moves a pixel. `pointercancel` puts it back untouched.
   */
  protected startChipDrag(event: PointerEvent, optionKey: string): void {
    if (!this.reorderable() || event.button !== 0) return;
    // A drag may start anywhere on the chip, its own controls included: they cover most of it, and
    // a chip draggable only by its bare edges is a chip nobody can drag. What separates the two is
    // travel — a press that stays put is the button's, and one that moves is the strip's.
    const chip = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    let dragging = false;
    const dragClass = stateClass(MDY_CHIP_CLASSES.block, "dragging");
    const onMove = (moveEvent: PointerEvent) => {
      if (!dragging && Math.abs(moveEvent.clientX - startX) < 6) return;
      dragging = true;
      chip.classList.add(dragClass);
    };
    /**
     * Tracked on the document rather than by capturing the pointer.
     *
     * `setPointerCapture` follows the gesture anywhere — and retargets every later pointer event,
     * including the one that becomes a `click`, to the capturing element. The chip's own buttons
     * then stop receiving their clicks entirely. Listening on the document follows it just as far
     * and leaves the buttons alone.
     */
    const view = chip.ownerDocument;
    const done = () => {
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerup", onUp);
      view.removeEventListener("pointercancel", done);
      chip.classList.remove(dragClass);
    };
    const onUp = (upEvent: PointerEvent) => {
      const wasDragging = dragging;
      done();
      if (!wasDragging) return;
      // The press began on a control and ended as a gesture, so the click it is about to produce is
      // not one anybody asked for. Swallowed once, in the capture phase.
      view.addEventListener("click", (click) => { click.stopPropagation(); click.preventDefault(); }, { capture: true, once: true });
      const order = this.chosen().map((c) => c.key);
      const midpoints = order.map((each) => {
        const box = this.hostRef.nativeElement.querySelector(`[data-key="${each}"]`)?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : 0;
      });
      const to = chipDropIndex(midpoints, upEvent.clientX, order.indexOf(optionKey));
      if (to === order.indexOf(optionKey)) return;
      this.saySoon = chipMovedAnnouncement(
        this.i18n.selectionMoved,
        this.chosen().find((c) => c.key === optionKey)?.label ?? optionKey,
        to + 1, order.length,
      );
      this.controller()?.dispatch({ type: "move-selected", optionKey, to });
      this.activeChipKey.set(optionKey);
    };
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerup", onUp);
    view.addEventListener("pointercancel", done);
  }

  /**
   * Puts DOM focus on the option the cursor is on, where there is no filter box to name it.
   *
   * With a search box the cursor is announced through `aria-activedescendant` and focus stays where
   * a person is typing. Without one there is no element to carry that reference.
   */
  /**
   * Which option the cursor is on, named from wherever focus actually is.
   *
   * Focus stays on the control while the list is open here, so the cursor has no element of its own
   * to be announced from: without this it moves and nothing says so.
   */
  /**
   * The id the projection gives one option, put on the element that draws it.
   *
   * `aria-activedescendant` names an element, and the cursor pointed at an id nothing carried: the
   * control said where the keyboard was and no such element existed, so type-ahead moved a cursor
   * that could not be announced.
   */
  protected optionDomId(value: TValue): string | null {
    return this.controller()?.view().parts[this.optionKey(value)]?.id ?? null;
  }

  protected readonly activeDescendant = computed(() => {
    const key = this.activeOverlayKey();
    if (!key || !this.open()) return null;
    return this.controller()?.view().parts[key]?.id ?? null;
  });

  private followCursor(): void {
    if (this.searchable()) return;
    const key = this.activeOverlayKey();
    if (!key) return;
    afterNextRender(
      () => (this.hostRef.nativeElement.querySelector(`[data-option-key="${key}"] button, [data-option-key="${key}"]`) as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }

  /** How many are chosen, for the field's own description. */
  protected readonly describedState = computed(() => {
    const count = this.chosen().length;
    return count === 0 ? "" : this.i18n.selectionCount.replace("{count}", String(count));
  });

  /** The strip's wheel behaviour is the contract's; see `scrollChipStripByWheel`. */
  protected readonly onStripWheel = scrollChipStripByWheel;

  /**
   * The pointer's way to move a chip, which is not a drag.
   *
   * WCAG 2.5.7 asks for a single-pointer path independently of the keyboard's: somebody who cannot
   * hold and drag has no way to reorder otherwise, and Alt plus the arrows does not discharge it.
   */
  protected moveByPointer(optionKey: string, by: -1 | 1): void {
    const order = this.chosen().map((c) => c.key);
    const to = Math.max(0, Math.min(order.length - 1, order.indexOf(optionKey) + by));
    this.saySoon = chipMovedAnnouncement(
      this.i18n.selectionMoved,
      this.chosen().find((c) => c.key === optionKey)?.label ?? optionKey,
      to + 1, order.length,
    );
    this.controller()?.dispatch({ type: "move-selected", optionKey, to });
    // The subject stays the chip that moved, decided rather than inherited: a pointer has no
    // continuity of its own, since after one press the chip is no longer under the finger.
    this.activeChipKey.set(optionKey);
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
  /** A sentence to say once, for a change no selection delta describes — a move. */
  private saySoon: string | null = null;
  /** The last destructive act, or `null` when there is nothing to go back to. */
  protected readonly wayBack = computed(() => this.controller()?.state().wayBack ?? null);

  /** What the way back says it is putting back — the act named, because one reversal covers three. */
  protected readonly wayBackText = computed(() => {
    const offer = this.wayBack();
    if (offer === null) return "";
    return wayBackSentence(
      offer,
      { removed: this.i18n.wayBackRemoved, moved: this.i18n.wayBackMoved, cleared: this.i18n.wayBackCleared },
      (key) => this.chosen().find((held) => held.key === key)?.label ?? key,
    );
  });

  /** Which chip is being named, and where its tooltip sits in the control's own coordinates. */
  protected readonly namedChip = signal<string | null>(null);
  protected readonly chipTipAt = signal(0);
  protected readonly namedChipLabel = computed(() => {
    const key = this.namedChip();
    return key === null ? "" : this.chosen().find((held) => held.key === key)?.label ?? key;
  });

  protected revealChipName(event: Event, key: string): void {
    const chip = event.currentTarget as HTMLElement;
    const strip = this.hostRef.nativeElement.querySelector(".mdy-multiselect__chips") as HTMLElement | null;
    this.chipTipAt.set(strip === null ? 0 : chipTooltipOffset(chip, strip));
    this.namedChip.set(key);
  }

  /**
   * A focused chip is brought back into the strip, after the paint that may have narrowed it.
   *
   * The browser scrolls a focused element in once, at the moment focus lands; an affordance that
   * appears on the same beat takes its width out of the scrollport afterwards. A focused chip nobody
   * can see is a keyboard trap.
   */
  protected onChipFocused(): void {
    const strip = this.hostRef.nativeElement.querySelector(".mdy-multiselect__chips") as HTMLElement | null;
    if (strip === null) return;
    requestAnimationFrame(() => keepFocusedChipInView(strip));
  }

  protected hideChipName(): void {
    this.namedChip.set(null);
  }

  protected readonly announcementText = computed(() => {
    const now = this.chosen().map((c) => c.key);
    if (this.saidLast === null) { this.saidLast = now; return ""; }
    if (this.saySoon !== null) { const once = this.saySoon; this.saySoon = null; this.saidLast = now; return once; }
    const said = multiselectAnnouncement(
      this.saidLast, now,
      { added: this.i18n.selectionAdded, removed: this.i18n.selectionRemoved, empty: this.i18n.selectionEmpty },
      (key) => this.chosen().find((c) => c.key === key)?.label ?? this.labelOf(key as unknown as TValue),
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
