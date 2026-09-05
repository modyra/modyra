import {
  defaultWidgetIdFactory,
  partSelector,
  beginChipReorder, chosenKeyOrder, elementByDataKey, focusPartOnOpen, wayBackActionName, matchesKeyGesture, MDY_WIDGET_KEYBOARD, chipTooltipOffset, hiddenChipCount, keepFocusedChipInView, chipFocusAfterRemoval, scrollChipStripByWheel, isTypeaheadCharacter, chipMovedAnnouncement, stateClass, keyBindingFor, multiselectAnnouncement, optionsWithUnrecognizedValues, overlayControlledId, projectOverlayOpenerA11y } from "@modyra/widgets";
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
import type { MdyMultiselectMode } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  multiselectOverlayAction,
  chipActionName,
  multiselectChipClasses,
  quantityAnnouncement,
  settledVoice,
  multiselectValueTransition,
  shouldCloseMultiselectOverlay,
  createMultiselectFieldController,
  MDY_CHIP_CLASSES,
  type MdyPartContract,
} from "@modyra/widgets";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyIconComponent } from "../../control/mdy-icon.component";
import { MdyOverlayPanelComponent } from "../../core/overlay-panel.component";
import { MDY_OPTIONS_CONTROL } from "../../core/tokens";
import { MdyOptionsControl } from "../../core/types";
import { MdyDropdownBase } from "../dropdown-base";
import type { MdyOverlayBranch, MdyOverlayOwner } from "../../core/overlay-control.directive";

/**
 * The selectors this renderer reaches its own parts by, taken from the contract once.
 *
 * `partSelector` answers `null` for a part a kind does not declare a class for; these two are
 * declared, and asserting it here rather than at each of the eight call sites keeps the guard in one
 * place where it can be read.
 */
const TRIGGER = partSelector("multiselect", "trigger") ?? "";
const CHIPS = partSelector("multiselect", "chips") ?? "";

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
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [words]="controlAriaLabel() ?? ''"
      [forId]="triggerPart().id ?? fieldId"
      [widgetId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="!!value() && value()!.length > 0"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
      [errorsId]="inlineErrorShown() ? errorsElementId(fieldId) : ''"
    />
    <!-- The shell every other kind sits in. Without it this renderer's multiselect was outside the
         row system entirely: anything a theme states about the input wrapper — the frame, the
         disabled and readonly surfaces, the error underline — reached three kinds of four here. -->
    <div [class]="wrapperClasses()">
    <!-- The box forwards a press on **its own** area to the opener, and nothing else (ADR 0142).
         The whole field is what opens the list — the caret takes no events, so a press aimed at the
         one mark that means "this opens" lands here — and a person who points at it and gets nothing
         has nothing else on the field telling them where to point instead.
         Two different things keep the other presses out, and only one of them is here. A press on a
         control inside a chip stops where it is handled and never reaches this element at all. A
         press on the chip's own body or its label is handled by nobody, so it arrives here, and the
         comparison below is the only thing between it and an opened list: remove it and picking up a
         chip also opens the popup.
         Compared against this element and not against what the press crossed on the way up: a chip
         is a span, so a test on whether a button was passed lets the body through. What a press does
         is decided by what it landed on. -->
    <div
      class="mdy-multiselect"
      #wrapper
      [class.mdy-multiselect--open]="open()"
      (click)="onBoxPress($event)"
      (keydown)="onUndoGesture($event)"
    >
      <!-- The strip before the opener, and beside it rather than inside it: a chip carries a button
           that takes a value off, and a control that opens something may not contain a control that
           destroys something (ADR 0142). Read in this order too — the chips are what the field
           holds, the opener is the space after them. -->
        <!-- An empty grid is not a grid: the role requires rows and row requires cells, so a field
             nobody has chosen anything in would announce contents it does not have. The correct
             rendering of nothing chosen is no grid. ADR 0148. -->
        @if (chosen().length > 0) {
        <span class="mdy-multiselect__chips" [attr.role]="parts.chips.role" [attr.aria-colcount]="chosen().length" aria-rowcount="1" (wheel)="onStripWheel($event)">
          <!-- ARIA structures a grid as grid → row → cell, and this strip is one row of cells. ADR 0148. -->
          <span class="mdy-multiselect__chip-row" [attr.role]="parts.chipRow.role" aria-rowindex="1">
          <!-- One chip per distinct value with how many, because a repeated value is a quantity:
               incrementing takes one of something to three. One chip per entry would make undoing
               one decision three separate removals. -->
          @for (held of chosen(); track held.key; let i = $index) {
            <span
              [class]="valueChipClasses()"
              [attr.tabindex]="activeChip() === held.key ? 0 : -1"
              [attr.role]="chipRole"
              [attr.data-key]="held.key"
              (focus)="activeChipKey.set(held.key); revealChipName($event, held.key); onChipFocused()"
              (pointerenter)="revealChipName($event, held.key)"
              (pointerleave)="hideChipName()"
              (blur)="hideChipName()"
              (pointerdown)="startChipDrag($event, held.key)"
              (keydown)="onChipKeydown($event, held.key)"
              [attr.aria-label]="held.count > 1 ? held.label + ', ' + held.count : held.label"
              [title]="held.label"
              [attr.aria-colindex]="i + 1"
            >
              @if (reorderable()) {
                <button
                  type="button"
                  [class]="chip.move"
                  tabindex="-1"
                  [attr.aria-label]="actionName(i18n.chipMoveEarlierLabel, held.label)"
                  (click)="moveByPointer(held.key, -1); $event.stopPropagation()"
                ></button>
              }
              @if (mode() === "multi") {
                <button
                  type="button"
                  [class]="chip.step"
                  tabindex="-1"
                  [attr.aria-label]="actionName(i18n.chipDecrementLabel, held.label)"
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
                  [attr.aria-label]="actionName(i18n.chipIncrementLabel, held.label)"
                  (click)="increment(held.value); $event.stopPropagation()"
                ><mdy-icon name="PLUS" /></button>
              }
              @if (reorderable()) {
                <button
                  type="button"
                  [class]="chip.move"
                  tabindex="-1"
                  [attr.aria-label]="actionName(i18n.chipMoveLaterLabel, held.label)"
                  (click)="moveByPointer(held.key, 1); $event.stopPropagation()"
                ></button>
              }
              <button
                type="button"
                [class]="chip.remove"
                tabindex="-1"
                [attr.aria-label]="actionName(i18n.chipRemoveLabel, held.label)"
                (click)="removeChip(held.key, held.value); $event.stopPropagation()"
              ></button>
            </span>
          }
          </span>
        </span>
        }

      <!-- The control a person presses, holding what was chosen. The label names it and the
           combobox role sits here, because this is what holds the field's value — a magnifier
           beside the field carried the role and none of the value. -->
      <button
        type="button"
        class="mdy-multiselect__trigger"
        [id]="fieldId"
        [mdyPart]="triggerPart()"
        [disabled]="isDisabled()"
        (click)="toggleOverlay($event)"
        (keydown)="onOverlayKeydown($event)"
        [attr.aria-describedby]="describedById(fieldId)"
        [attr.aria-label]="label() ? null : controlAriaLabel()"
      >
        @if (chosen().length === 0) {
          <span class="mdy-multiselect__placeholder">{{ label() }}</span>
        }
        @if (effectiveLoading()) {
          <mdy-icon name="LOADER" class="mdy-select__loader" style="font-size: 1rem;" />
        }
      </button>

      <!-- How many chips are out of sight, and the way to all of them. ADR 0127 lets the row scroll
           only where something reaches what leaves it: the wheel is that for most people and nothing
           at all for a pointer with no horizontal axis, which is most desktop mice. -->
      <button
          type="button"
          class="mdy-multiselect__overflow"
          [hidden]="hiddenChips() === 0"
          [disabled]="isDisabled() || isReadonly()"
          [attr.aria-label]="hiddenChips() === 0 ? null : i18n.chipsHidden.replace('{count}', hiddenChips().toString())"
          (click)="onOverflowPress($event)"
        >{{ hiddenChips() === 0 ? "" : i18n.chipsHiddenShort.replace("{count}", hiddenChips().toString()) }}</button>
      <!-- The one way back, first in the cluster: arriving, it grows into the empty space instead of
           pushing the control that discards everything sideways under a thumb already aimed at it.
           Untimed — a mark that takes itself away after five seconds is a time limit under WCAG
           2.2.1, and an undo has no exception under it — and the person who most needs it is the
           slowest to reach it, because the keyboard path here runs through every chip.
           A mark rather than a sentence: the act lives in the name, and what happened is said by the
           live region below, which owes that announcement whether or not a way back is on offer. -->
      <button
        type="button"
        class="mdy-multiselect__way-back-action"
        [class.mdy-multiselect__way-back-action--disabled]="wayBack() === null || isDisabled() || isReadonly()"
        [attr.aria-disabled]="wayBack() === null || isDisabled() || isReadonly()"
        [attr.aria-label]="wayBackName()"
        [attr.title]="wayBackName()"
        (click)="onWayBack()"
      ><mdy-icon name="UNDO" /></button>
      <!-- Every choice off at once, beside the trigger rather than inside it: the trigger is a
           button, and a button inside a button is neither valid nor reachable. -->
      <button
        type="button"
        class="mdy-multiselect__clear-all"
        [class.mdy-multiselect__clear-all--disabled]="chosen().length === 0 || isDisabled() || isReadonly()"
        [attr.aria-disabled]="chosen().length === 0 || isDisabled() || isReadonly()"
        [attr.aria-label]="i18n.clearSelection"
        [title]="i18n.clearSelection"
        (click)="onClearAll($event)"
      ><mdy-icon name="CLOSE" /></button>
      <!-- The mark that says the field opens, painted by the box at its own trailing edge. It is
           decoration and not a control: the whole field is what opens the list, so a caret with a
           name of its own would be a second stop on the keyboard for a gesture that already has
           one. Last, because only the commands are in an order and a drawing is in none. -->
      <mdy-icon
        name="CHEVRON_DOWN"
        class="mdy-multiselect__arrow"
        [class.mdy-multiselect__arrow--open]="open()"
      />
      <!-- Said rather than shown: a choice lands and the strip is the only confirmation, which is
           the one a person using a screen reader does not get. -->
      <div
        class="mdy-multiselect__announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >{{ announcementText() }}</div>
      <!-- The full name, for a chip the strip had to cut. Shown on hover and on focus: WCAG 1.4.13
           asks for both, and the title attribute is neither — it never appears for a keyboard or a
           touch user, who are exactly the people who cannot widen the chip. One element for the
           control, not one per chip: a child of the chip is part of the chip's own text. -->
      <span
        class="mdy-chip__tooltip"
        [id]="chipTooltipId()"
        role="tooltip"
        [style.inset-inline-start.px]="chipTipAt()"
        [hidden]="namedChip() === null"
      >{{ namedChipLabel() }}</span>
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
        <!-- A placeholder is not a name: it is gone the moment somebody types into the box, so a box
             named only by one is announced as nothing exactly while it is being used. -->
        <input
          #overlayInput
          type="text"
          class="mdy-multiselect-overlay__input"
          [placeholder]="i18n.searchPlaceholder"
          [attr.aria-label]="i18n.searchOptionsLabel"
          [attr.aria-controls]="optionsGridId()"
          [attr.aria-activedescendant]="activeDescendant()"
          autocomplete="off"
          [value]="searchQuery()"
          (input)="onSearchInput($event)"
          (keydown)="onOverlayKeydown($event)"
        />
        }
        <!-- The chip grid says what it is. The contract declares the role; a container left bare told
             a screen reader nothing about the set at all. -->
        <!-- The id the projection gives the grid — not the one the opener names, which is the
             popup's and is already on the panel: two elements claiming one id makes every reference
             to it non-deterministic. -->
        <div
          [id]="optionsGridId()"
          class="mdy-multiselect__options mdy-multiselect-overlay__grid"
          [attr.role]="optionsRole"
          [attr.aria-label]="controlAriaLabel()"
          (keydown)="onOverlayKeydown($event)"
        >
          @for (opt of searchResults(); track opt.value; let i = $index) {
            <div [class]="chip.wrapper" [attr.data-option-key]="optionKey(opt.value)">
            @if (mode() === "multi") {
              <div [mdyPart]="optionPart(opt.value)">
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
                [mdyPart]="optionPart(opt.value)"
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


    <!-- Not an else: an error does not take the place of the instruction that would have prevented
         it, which is what the described-by projection says by naming both. Rendered as an
         alternative, a field that can fail lost its supporting text the moment the error container
         was reserved — and the reference to it went on naming an element no longer on the page. -->
    @if (projectedSupportingText(); as st) {
      <!-- The two routes a field's own words arrive by, and both are tested here because the id the
           control describes itself with is claimed for either. A branch that asks only about the
           value leaves a projected description unrendered while the control still points at it —
           which is not an error anywhere: the reference simply resolves to nothing and the field is
           read out with no description at all. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    } @else {
      <!-- Drawn with nothing in it, and out of sight. The projection names this id
           whenever it describes the control, so an element that appears only once
           there are words leaves that reference pointing at nothing — the defect one
           step worse than an empty description. The two halves stay apart: the
           element is always here for a reference to land on, and describedById
           decides whether making the reference is worth a reader's move. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)" hidden></div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
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
  /** The strip is a list and a chip is an item of it — the catalogue's answer, not this file's. */
  /** The parts, so a template asks the contract for a role rather than holding one field per part. */
  protected readonly parts = MDY_WIDGET_CONTRACTS.multiselect.parts;
  protected readonly chipRole = MDY_WIDGET_CONTRACTS.multiselect.parts.chip.role ?? null;

  protected readonly chip = MDY_CHIP_CLASSES;
  /** The widget this draws: its popup's room, width and edge come from the catalog. */
  protected override readonly overlayKind = "multiselect" as const;

  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.multiselect;
  protected override readonly widgetKind = "multiselect" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  readonly mode = input<MdyMultiselectMode>("single");

  readonly filterFn = input<((value: TValue) => boolean) | undefined>(undefined);


  private readonly controller = this.adoptFieldController(
    (handle, widgetId) => createMultiselectFieldController<TValue>(
      { widgetId, handle: handle as never, options: this.filteredOptions(), mode: this.mode() }),
    (c) => {
      c.setOptions(this.filteredOptions());
      c.dispatch({ type: "search", query: this.searchQuery() });
    },
  );

  /** The id the opener names, which the projected panel has to carry. */
  // Spelled by the factory rather than by hand: `__chiptip` is a name nothing else in the library
  // can derive, so a reference to it built from the contract pointed at no element.
  // Computed rather than captured: `fieldId` is settled by the host after construction, so a field
  // initializer spells the id the component had before it was given one — which is why these read
  // one lower than the field they belong to.
  protected readonly chipTooltipId = computed(() => defaultWidgetIdFactory.part(this.fieldId, "chipTooltip"));
  /**
   * The caption's id, which names the trigger where a document wrote a caption.
   *
   * Computed rather than captured: `fieldId` is settled by the host after construction, and a field
   * initializer spells the id the component had before it was given one.
   *
   * One name, never two: with a caption the trigger points at it, without one it says the words it
   * can reach. A control carrying both says only the reference. ADR 0175.
   */
  protected readonly labelId = computed(() => defaultWidgetIdFactory.part(this.fieldId, "label"));
  protected readonly popupId = computed(
    () => overlayControlledId("multiselect", this.fieldId) ?? "",
  );

  /**
   * What the contract says this control carries — all of it, not the overlay relation alone.
   *
   * The field's trigger part answers the opener's three (`aria-expanded`, `aria-controls`,
   * `aria-haspopup`, with the same values in the same state — measured, not assumed) **and** the
   * five the opener knows nothing about: invalid, required, readonly, describedby, labelledby.
   * Applying the opener alone left those five with no author but this template, so the contract's
   * answer to them never reached the page.
   *
   * The opener stays as the answer for the moment before the controller is adopted: an element with
   * no relation at all announces a button that opens nothing.
   */
  protected readonly triggerPart = computed(
    () => this.controller()?.view().parts.trigger
      ?? projectOverlayOpenerA11y("multiselect", { widgetId: this.fieldId, open: this.open() })!,
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

  /**
   * The options the panel offers, which is the controller's answer rather than a second one.
   *
   * Every option, chosen or not, with the state that says which. Filtering the chosen ones out was
   * this renderer's own answer: the contract gives each option a `selected` state and, in toggle
   * mode, `aria-pressed` — both unreachable for a list that removes what was taken. It also made the
   * strip's overflow affordance a lie, because the values it says are out of sight are exactly the
   * ones such a list omits.
   *
   * Deriving the same narrowing here as well gave a value the field holds two fates: the widening
   * that offers a held value the list does not carry runs on both sides of `filterFn`, so a filter
   * that rejects such a value removed it here and the controller put it back. A filter says what may
   * be added, never what is already held. ADR 0196.
   */
  protected readonly searchResults = computed(() => this.controller()?.filteredOptions() ?? []);

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
      key: event,
      open: this.open(),
      query: this.searchQuery(),
      activeKey: this.activeOverlayKey(),
      mode: this.mode(),
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
        this.hostRef.nativeElement.querySelector(TRIGGER)?.focus();
      }
      return;
    }
    if (action.type === "open") {
      this.openOverlay();
      // This handler is a keydown, so the panel it raises is about to be given a keypress and opens
      // with somewhere for that press to land: the controller primes its cursor on the first value
      // already chosen. Without it the first arrow was spent picking a starting point and the key
      // meaning "choose this one" had no target, which this renderer answered from the trigger.
      // ADR 0179.
      this.controller()?.dispatch({ type: "open", by: "keyboard" });
      this.followCursor();
      return;
    }
    // The quantity on the option the cursor is on. The `±` buttons drawn in each option are
    // `tabindex="-1"` pointer affordances, so without this the number on a row can be changed with a
    // mouse and with nothing else.
    if (action.type === "step") {
      this.controller()?.dispatch(action.by === 1
        ? { type: "increment", optionKey: action.optionKey }
        : { type: "decrement", optionKey: action.optionKey });
      this.followCursor();
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

  /**
   * Where a person lands when the panel opens: the part the contract names for this kind.
   *
   * The filter box when there is one, the first option when there is not. It used to be the filter
   * box or nothing — so a multiselect without one opened with focus still on the trigger, while
   * every other panel in the library put it on the thing the panel was opened to operate. ADR 0197.
   */
  protected override onBeforeOpen(): void {
    super.onBeforeOpen();

    // The filter box only, for now, and the reason is a finding rather than a preference.
    //
    // The contract names the first option for a panel with no filter box, and moving focus there
    // took the keyboard away from the element that answers letters: this renderer's type-ahead is
    // bound where focus used to stay, so a person typing "m" moved nothing. The rule is right and
    // this renderer cannot follow it until type-ahead answers from wherever focus is — which is a
    // batch of its own, not a line in this one.
    const part = focusPartOnOpen("multiselect", { searchable: this.searchable() });
    if (part !== "search") return;
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

  /**
   * The classes a chip in the field carries, which is a different chip from one in the list.
   *
   * A chip holding what was chosen is the value; a chip in the popup is an option. The catalogue
   * declares `chip` as the value chip and spells it `mdy-chip mdy-chip--value`, and this renderer
   * asked for the option appearance in both places — so a theme keying on the declared class styled
   * the renderers that emit it and silently skipped this one.
   */
  /** What the button that takes this chip off is called: the verb and the value it would remove. */
  /**
   * What a button inside a chip is called: the verb and the value it would act on.
   *
   * Every button, not only the one that removes. Read from the accessibility tree, a two-chip strip
   * offered four steppers called "One fewer" and "One more" beside two that named their value — and
   * stepping down from one is what removes it.
   */
  protected actionName(verb: string, label: string): string {
    return chipActionName(verb, label);
  }

  protected valueChipClasses(): string {
    return multiselectChipClasses({ mode: this.mode(), role: "value" }).join(" ");
  }

  protected isSelected(optValue: TValue): boolean {
    return this.selectedSet().has(this.optionKey(optValue));
  }

  /** How many chips the strip is hiding, measured from what the browser actually laid out. */
  protected readonly hiddenChips = signal(0);

  /** The id the projection gives the option grid. */
  protected readonly optionsGridId = computed(() => this.controller()?.view().parts.group?.id ?? null);

  /** The way to the chips the strip cannot show: the list, where every one of them is. */
  /**
   * A press on the field's own empty space, which opens the list.
   *
   * Focus goes to the opener before the list opens, not after: the opener is what carries the
   * expanded state and answers the keyboard, and a list opened with focus left on the document is
   * one the arrows cannot reach.
   */
  protected onBoxPress(event: Event): void {
    // The field's own area, not a descendant that nothing else handled.
    if (event.target !== event.currentTarget) return;
    if (this.isDisabled() || this.isReadonly()) return;
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(TRIGGER)?.focus();
    this.toggleOverlay(event);
  }

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
      const strip = this.hostRef.nativeElement.querySelector(CHIPS) as HTMLElement | null;
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
    // A control announced as unavailable still receives the press: `aria-disabled` says what it is,
    // it does not refuse. The second lock; the controller is what actually holds the rule.
    if (this.chosen().length === 0 || this.isDisabled() || this.isReadonly()) return;
    this.controller()?.dispatch({ type: "clear" });
  }

  /** The one way back: it puts back what the last destructive act took, whichever act that was. */
  /**
   * Puts the value back and leaves the reading position on what came back.
   *
   * The offer is withdrawn by using it, so whatever held focus is gone from the page the moment it
   * works — and a reading position on nothing sends a keyboard back to the top of the document. The
   * value restored is where a person is looking, so it is where they are put; a restore with nothing
   * to land on falls back to the opener, which is the field itself.
   */
  protected onWayBack(): void {
    // Announced as unavailable, still reachable, refused here. The second lock; the controller holds
    // the rule. ADR 0171.
    if (this.wayBack() === null || this.isDisabled() || this.isReadonly()) return;
    const restored = this.wayBack()?.optionKey ?? null;
    this.controller()?.dispatch({ type: "undo" });
    queueMicrotask(() => {
      const host = this.hostRef.nativeElement as HTMLElement;
      // Compared rather than selected: a value is whatever a document put in it, and a selector
      // built from one needs escaping that not every host this runs in provides.
      const landing = restored === null
        ? undefined
        : Array.from(host.querySelectorAll<HTMLElement>("[data-key]"))
          .find((chip) => chip.dataset.key === restored);
      (landing ?? host.querySelector<HTMLElement>(TRIGGER))?.focus();
    });
  }

  /**
   * The way back, from wherever the person is standing in the field.
   *
   * Answered from the field rather than from the button that offers it: a removal leaves the reading
   * position among the chips, and a shortcut reachable only from the control at the far edge is a
   * shortcut for somebody who has already walked there.
   *
   * Not while a person is typing. Inside a text box the same gesture is the platform's own undo of
   * what they have just written, and taking it would put a value back and lose a word.
   */
  protected onUndoGesture(event: KeyboardEvent): void {
    // `void`, and it is not a style choice: a template binding whose handler returns `false` has the
    // framework cancel the event for it — so a guard clause returning `false` for "this key is not
    // mine" would swallow every key that reached this element, and the commands inside the field
    // would stop answering the two the platform binds to a button.
    const binding = MDY_WIDGET_KEYBOARD.multiselect.find((one) => one.intent === "undo");
    if (binding === undefined || !matchesKeyGesture(binding, event)) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]") !== null) return;
    if (this.wayBack() === null) return;
    event.preventDefault();
    this.onWayBack();
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
    // Walked as a list of chosen values, which is what a multiselect holds — and read defensively,
    // because the model keeps whatever a document put in it and reports the field invalid rather
    // than refusing the write. A value that is not a list is the one thing chosen, as the contract's
    // own reading of it says; walking it as a list instead throws, and the strip that was going to
    // show the verdict never gets drawn.
    const held = this.value();
    for (const value of (Array.isArray(held) ? held : held === null || held === undefined ? [] : [held]) as readonly TValue[]) {
      const key = this.optionKey(value);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { key, value, label: this.labelOf(value), count: 1 });
    }
    return [...tally.values()];
  });

  /**
   * The chip keys in strip order — the contract's answer, not a second reading of the tally.
   *
   * `chosen` above carries labels and counts for painting; this is the sequence a move, a drag and a
   * removal index into. Both are the same order, and taking it from the controller is what keeps
   * them one order rather than two that happen to agree.
   */
  protected readonly chipOrder = computed(
    () => chosenKeyOrder(this.controller()?.state() ?? { counts: new Map<string, number>() }),
  );

  /**
   * Rearranging what was chosen, from the chip a person is looking at.
   *
   * The keys are the contract's, and so is the direction: the strip runs in the writing direction,
   * so `ArrowLeft` moves a chip *later* in a right-to-left document, and a renderer reading the key
   * rather than the binding would have to know that.
   */
  /**
   * The chip a person is carrying, and where they picked it up from.
   *
   * `from` is what `Escape` puts back: somebody who picks up the wrong chip has to be able to
   * abandon the move rather than undo it afterwards.
   */
  private grabbed: { readonly key: string; readonly from: number } | null = null;

  /** The label a chip shows, for a sentence about it. */
  private chipLabelOf(optionKey: string): string {
    return this.chosen().find((c) => c.key === optionKey)?.label ?? optionKey;
  }

  protected onChipKeydown(event: KeyboardEvent, optionKey: string): void {
    // A key pressed on a control the chip carries is that control's, not the chip's. The chip's own
    // bindings share `Enter` and `Space` with the platform's activation of a button, so answering
    // here takes the key from the button a person has focused inside it — and the chip does
    // something else with it, which is worse than doing nothing.
    if (event.target !== event.currentTarget) return;
    // Asked as the chip. A key with no binding here belongs to the control and must reach it —
    // `ArrowDown` opens the popup from the trigger, arrows move the chip (grabbed or not).
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this.open(), "chip");
    if (!binding) return;
    // The chip's keys are the chip's. Left to bubble, the control's own handler answers the same
    // keys a second time and its answer lands on top of this one.
    event.stopPropagation();
    const order = this.chipOrder();

    if (binding.intent === "move") {
      event.preventDefault();
      const at = order.indexOf(optionKey);
      const to = binding.toEnd
        ? (binding.by === -1 ? 0 : order.length - 1)
        : Math.max(0, Math.min(order.length - 1, at + (binding.by ?? 1)));
      // Held, the arrows carry the chip; free, they walk the strip. One movement, and the grab says
      // what its subject is.
      if (this.grabbed?.key === optionKey) {
        if (to === at) return;
        this.grabSaid.set(null);
        this.saySoon = chipMovedAnnouncement(this.i18n.selectionMoved, this.chipLabelOf(optionKey), to + 1, order.length);
        this.controller()?.dispatch({ type: "move-selected", optionKey, to });
        this.focusChip(optionKey);
        return;
      }
      this.focusChip(order[to]);
      return;
    }
    // Picking up and putting down, one key: a state seen from both ends. Announced either way,
    // because a state nobody is told about is one they cannot know they are in — the arrows would
    // carry a chip a person believes is still walking the strip.
    if (binding.intent === "grab") {
      if (!this.reorderable()) return;
      event.preventDefault();
      const at = order.indexOf(optionKey);
      const held = this.grabbed?.key === optionKey;
      this.grabbed = held ? null : { key: optionKey, from: at };
      this.saySoon = chipMovedAnnouncement(
        held ? this.i18n.selectionDropped : this.i18n.selectionGrabbed,
        this.chipLabelOf(optionKey), at + 1, order.length,
      );
      this.grabSaid.set(this.saySoon);
      this.saySoon = null;
      return;
    }
    // Putting it back where it was picked up from, while something is held and not otherwise.
    if (binding.intent === "cancel") {
      if (this.grabbed?.key !== optionKey) return;
      event.preventDefault();
      const home = this.grabbed.from;
      this.grabbed = null;
      this.grabSaid.set(null);
      this.saySoon = chipMovedAnnouncement(this.i18n.selectionReturned, this.chipLabelOf(optionKey), home + 1, order.length);
      this.controller()?.dispatch({ type: "move-selected", optionKey, to: home });
      this.focusChip(optionKey);
      return;
    }
    // The quantity, from the keyboard. The ± controls are `tabindex="-1"` pointer affordances, so
    // these two keys are the only way to a counter chip's number without a mouse.
    if (binding.intent === "step") {
      event.preventDefault();
      this.controller()?.dispatch(
        event.key === "ArrowUp" ? { type: "increment", optionKey } : { type: "decrement", optionKey },
      );
      this.sayQuantity(optionKey);
      this.focusChip(optionKey);
      return;
    }
    if (binding.intent === "remove") {
      event.preventDefault();
      const held = this.chosen().find((c) => c.key === optionKey);
      // Backspace goes back, Delete goes on — the convention every text field has.
      if (held) this.removeChip(optionKey, held.value, event.key === "Backspace" ? "backward" : "forward");
      return;
    }
  }

  /**
   * Dragging a chip to a new place — the door the brief named, on the same intent as the other two.
   *
   * A threshold before it becomes a drag: a press that never travels is a press, and treating every
   * one as the beginning of a drag takes the chip's own controls away from anybody whose finger
   * moves a pixel. `pointercancel` puts it back untouched.
   */
  protected startChipDrag(event: PointerEvent, optionKey: string): void {
    if (!this.reorderable()) return;
    const chip = event.currentTarget as HTMLElement;
    const order = (): readonly string[] => this.chipOrder();
    beginChipReorder(event, chip, {
      draggingClass: stateClass(MDY_CHIP_CLASSES.block, "dragging"),
      midpoints: () => order().map((each) => {
        const box = elementByDataKey(this.hostRef.nativeElement, "key", each)?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : 0;
      }),
      from: () => order().indexOf(optionKey),
      onDrop: (to) => {
        this.saySoon = chipMovedAnnouncement(
          this.i18n.selectionMoved,
          this.chosen().find((c) => c.key === optionKey)?.label ?? optionKey,
          to + 1, order().length,
        );
        this.controller()?.dispatch({ type: "move-selected", optionKey, to });
        this.activeChipKey.set(optionKey);
      },
    });
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
  /**
   * Everything the contract says about one option in the list: its id, the chip classes its mode
   * and state imply, and whether it is available.
   *
   * Taken whole rather than rebuilt from three bindings. The classes and the id were being spelled
   * here while the projection already held them — and the part of it nothing spelled was
   * `aria-disabled` and the native `disabled`, so an option a document had closed was drawn exactly
   * like one that could be chosen. The press was refused and nothing said why.
   */
  protected optionPart(value: TValue): MdyPartContract {
    return this.controller()?.view().parts[this.optionKey(value)] ?? { classes: [], attributes: {} };
  }

  protected optionDomId(value: TValue): string | null {
    return this.controller()?.view().parts[this.optionKey(value)]?.id ?? null;
  }

  /**
   * Where the keyboard is standing in the list, read from the projection rather than worked out
   * again here.
   *
   * Which option the cursor is on and which id that option carries are one answer. Asking the state
   * for the first and the view for the second was a second way of arriving at it, and a second way
   * is the one that keeps answering after the first changes — which is how three renderers came to
   * each own a copy of this, and one of them to cover only the case with a filter box.
   */
  protected readonly activeDescendant = computed(() => {
    const projected = this.controller()?.view().parts.trigger?.attributes?.["aria-activedescendant"];
    return typeof projected === "string" ? projected : null;
  });

  private followCursor(): void {
    if (this.searchable()) return;
    const key = this.activeOverlayKey();
    if (!key) return;
    afterNextRender(
      () => {
        const chip = elementByDataKey(this.hostRef.nativeElement, "option-key", key);
        (chip?.querySelector<HTMLElement>("button") ?? chip)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** How many are chosen, for the field's own description. */

  /** The strip's wheel behaviour is the contract's; see `scrollChipStripByWheel`. */
  protected readonly onStripWheel = scrollChipStripByWheel;

  /**
   * The pointer's way to move a chip, which is not a drag.
   *
   * WCAG 2.5.7 asks for a single-pointer path independently of the keyboard's: somebody who cannot
   * hold and drag has no way to reorder otherwise, and Alt plus the arrows does not discharge it.
   */
  protected moveByPointer(optionKey: string, by: -1 | 1): void {
    const order = this.chipOrder();
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
    const order = this.chipOrder();
    const held = this.activeChipKey();
    return held !== null && order.includes(held) ? held : order[0] ?? null;
  });

  private focusChip(key: string | undefined): void {
    if (key === undefined) return;
    this.activeChipKey.set(key);
    afterNextRender(
      () => elementByDataKey(this.hostRef.nativeElement, "key", key)?.focus(),
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
    const next = chipFocusAfterRemoval(this.chipOrder(), optionKey, direction);
    this.onToggle(value);
    afterNextRender(() => {
      const host = this.hostRef.nativeElement;
      const landing = next === null
        ? host.querySelector(TRIGGER)
        : elementByDataKey(host, "key", next)?.querySelector(`.${MDY_CHIP_CLASSES.remove}`) ?? null;
      ((landing ?? host.querySelector(TRIGGER)) as HTMLElement | null)?.focus();
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

  /**
   * A sentence about a grab, which no change of value follows.
   *
   * Picking a chip up and putting it down move nothing, so the computed below would not run again
   * and the sentence would sit unsaid until some unrelated change. Writable, so saying it is itself
   * the change.
   */
  private readonly grabSaid = signal<string | null>(null);
  /** The last destructive act, or `null` when there is nothing to go back to. */
  protected readonly wayBack = computed(() => this.controller()?.state().wayBack ?? null);

  /** What the way back is called: the act named, because one reversal covers three. */
  protected readonly wayBackName = computed(() => {
    return wayBackActionName(
      this.wayBack(),
      {
        label: this.i18n.wayBackLabel,
        removed: this.i18n.wayBackRemoved,
        moved: this.i18n.wayBackMoved,
        cleared: this.i18n.wayBackCleared,
      },
      // Resolved against the options, not against what is chosen: the way back names the value that
      // was just taken away, and a value that was taken away is no longer among the chosen ones.
      (key) => this.labelOfKey(key),
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
    const strip = this.hostRef.nativeElement.querySelector(CHIPS) as HTMLElement | null;
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
    const strip = this.hostRef.nativeElement.querySelector(CHIPS) as HTMLElement | null;
    if (strip === null) return;
    requestAnimationFrame(() => keepFocusedChipInView(strip));
  }

  protected hideChipName(): void {
    this.namedChip.set(null);
  }

  protected readonly announcementText = computed(() => {
    const now = this.chipOrder();
    if (this.saidLast === null) { this.saidLast = now; return ""; }
    // Reads only. A computed that writes a signal is NG0600 — the pass throws, the binding keeps
    // what it had, and the live region freezes on the sentence before the one that mattered.
    const grab = this.grabSaid();
    if (this.saySoon !== null) { const once = this.saySoon; this.saySoon = null; this.saidLast = now; return once; }
    if (grab !== null) { this.saidLast = now; return grab; }
    const said = multiselectAnnouncement(
      this.saidLast, now,
      {
        added: this.i18n.selectionAdded,
        removed: this.i18n.selectionRemoved,
        empty: this.i18n.selectionEmpty,
        removedLast: this.i18n.selectionRemovedLast,
        addedMany: this.i18n.selectionAddedMany,
        removedMany: this.i18n.selectionRemovedMany,
        removedManyLast: this.i18n.selectionRemovedManyLast,
      },
      (key) => this.chosen().find((c) => c.key === key)?.label ?? this.labelOf(key as unknown as TValue),
    );
    this.saidLast = now;
    // A quantity that settled says itself, and a selection change that says nothing leaves it
    // standing: stepping three of something down to two moves no distinct value, so the sentence
    // above is empty for exactly the change the person just made.
    return said === "" ? this.saidQuantity() : said;
  });

  /** The words behind one option key, for a value that may no longer be held. */
  private labelOfKey(key: string): string {
    return this.effectiveOptions().find((o) => this.optionKey(o.value) === key)?.label ?? key;
  }

  /**
   * The words a chosen value is shown by, falling back to its key for one the options lost.
   *
   * The key rather than `String(value)`: every plain object renders as `[object Object]` through it,
   * so a value whose option went away was labelled with a name that says nothing about what was
   * chosen. The key at least describes what the value holds.
   */
  private labelOf(value: TValue): string {
    return this.effectiveOptions().find((o) => this.optionKey(o.value) === this.optionKey(value))?.label
      ?? this.optionKey(value);
  }

  protected countOf(optValue: TValue): number {
    return this.counts().get(this.optionKey(optValue)) ?? 0;
  }

  protected increment(optValue: TValue): void {
    this.commitMultiselect({ type: "increment", value: optValue });
    this.sayQuantity(this.optionKey(optValue));
  }

  protected decrement(optValue: TValue): void {
    this.commitMultiselect({ type: "decrement", value: optValue });
    this.sayQuantity(this.optionKey(optValue));
  }

  /**
   * The quantity, said once the pressing stops.
   *
   * A held arrow steps many times, and a region read on every step reads a backlog out after the
   * person has let go. Nothing is said for a quantity that reached zero: the value is gone, and the
   * removal has its own sentence and its own way back.
   */
  private readonly quantityVoice = settledVoice((sentence) => this.saidQuantity.set(sentence));

  private sayQuantity(key: string): void {
    const count = this.counts().get(key) ?? 0;
    if (count === 0) return;
    this.quantityVoice.announce(quantityAnnouncement(
      this.labelOfKey(key),
      count,
      { settled: this.i18n.quantitySettled, atMinimum: this.i18n.quantityAtMinimum },
    ));
  }

  /** The settled quantity sentence, which the live region shows until something replaces it. */
  protected readonly saidQuantity = signal("");

  public resetSelection(): void {
    this.commitMultiselect({ type: "clear" });
  }

  protected onOverlaySelect(optValue: TValue): void {
    this.commitMultiselect({ type: "increment", value: optValue });
    if (shouldCloseMultiselectOverlay(this.mode(), this.searchResults().length)) this.closeOverlay();
  }
}
