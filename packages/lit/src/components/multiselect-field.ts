import {
  beginChipReorder, capabilityOf, keyMeans, defaultWidgetIdFactory,
  MDY_POPUP_OPENERS,
  overlayControlledId,
  keyBindingFor,
  matchesKeyGesture,
  MDY_WIDGET_KEYBOARD,
  chipFocusAfterRemoval,
  multiselectAnnouncement,
  multiselectOverlayAction,
  chipMovedAnnouncement,

  stateClass,
  scrollChipStripByWheel,
  chipTooltipOffset,
  chosenKeyOrder,
  elementByDataKey,
  hiddenChipCount,
  keepFocusedChipInView,
  wayBackActionName,
  fieldDescribedBy,
  isTypeaheadCharacter,
} from "@modyra/widgets";
import { type MdyFieldHandle, type MdyMultiselectMode, type MdySelectOption } from "@modyra/core";
import {
  createMultiselectFieldController,
  MDY_CHIP_CLASSES,
  chipActionName,
  defaultOptionKey,
  multiselectChipClasses,
  quantityAnnouncement,
  settledVoice,
  optionsWithUnrecognizedValues,
  type MdyMultiselectFieldController,
  type MdyPartContract,
  focusPartOnOpen,
  focusWhenShown,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { mdyIcon } from "../base.js";
import { mdyPart } from "../mdy-part.js";
import {
  MdyLitOverlayController,
  renderOverlayPanel,
} from "./popup-styles.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";
import { closeOverlayOutOfPlay } from "../widget-runtime/overlay-host.js";

export class MdyMultiselectFieldElement extends MdyDropdownFieldElement<readonly unknown[]> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    reorderable: { type: Boolean },
    loading: { type: Boolean },
    mode: { type: String },
    filterFn: { attribute: false },
    optionTemplate: { attribute: false },
    _query: { state: true },
  };
  declare searchable: boolean;
  /** Whether a person may rearrange what they chose. Off by default. */
  declare reorderable: boolean;
  /**
   * Dragging a chip to a new place — the door the brief named, on the same intent as the other two.
   *
   * A threshold before it becomes a drag: a press that never travels is a press, and treating every
   * one as the beginning of a drag takes the chip's own controls away from anybody whose finger
   * moves a pixel. `pointercancel` puts it back untouched — the browser taking the gesture is not a
   * decision the person made.
   */
  private startChipDrag(event: PointerEvent, optionKey: string): void {
    if (!this.reorderable) return;
    const chip = event.currentTarget as HTMLElement;
    const order = (): readonly string[] => chosenKeyOrder(this.fieldController?.state() ?? { counts: new Map() });
    beginChipReorder(event, chip, {
      draggingClass: stateClass(MDY_CHIP_CLASSES.block, "dragging"),
      midpoints: () => order().map((each) => {
        const box = elementByDataKey(this, "key", each)?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : 0;
      }),
      from: () => order().indexOf(optionKey),
      onDrop: (to) => {
        this._saySoon = chipMovedAnnouncement(this.messages.selectionMoved, this.labelFor(optionKey), to + 1, order().length);
        this.fieldController?.dispatch({ type: "move-selected", optionKey, to });
        this._activeChip = optionKey;
      },
    });
  }

  /**
   * The pointer's way to move a chip, which is not a drag.
   *
   * WCAG 2.5.7 asks for a single-pointer path independently of the keyboard's: somebody who cannot
   * hold and drag has no way to reorder otherwise, and `Alt`+arrows does not discharge it.
   */
  private moveByPointer(optionKey: string, by: -1 | 1): void {
    const order = chosenKeyOrder(this.fieldController?.state() ?? { counts: new Map() });
    const to = Math.max(0, Math.min(order.length - 1, order.indexOf(optionKey) + by));
    this._saySoon = chipMovedAnnouncement(this.messages.selectionMoved, this.labelFor(optionKey), to + 1, order.length);
    this.fieldController?.dispatch({ type: "move-selected", optionKey, to });
    // The subject stays the chip that moved, decided rather than inherited: a pointer has no
    // continuity of its own, since after one press the chip is no longer under the finger.
    this._activeChip = optionKey;
  }

  /** Which chip carries the strip's tab stop. */
  private _activeChip: string | null = null;
  /** What the live region last spoke about; `null` until the first paint has been taken as given. */
  private _saidLast: readonly string[] | null = null;
  /** A sentence to say once, for a change no selection delta describes — a move. */
  private _saySoon: string | null = null;

  /** What the live region is saying now, so a render describing no change does not take it back. */
  private _said = "";

  /**
   * The chip a person is carrying, and where they picked it up from.
   *
   * A grab is a state and the arrows read it: the same key walks the strip when nothing is held and
   * carries what is held when something is. `from` is what `Escape` puts back — a person who picks
   * up the wrong chip has to be able to abandon the move rather than undo it afterwards.
   */
  private _grabbed: { readonly key: string; readonly from: number } | null = null;
  declare loading: boolean;
  declare mode: MdyMultiselectMode;
  declare filterFn?: (value: unknown) => boolean;
  declare optionTemplate?: unknown;
  declare _query: string;

  protected override readonly widgetKind = "multiselect" as const;
  private readonly overlay = new MdyLitOverlayController(this);
  private fieldController?: MdyMultiselectFieldController<unknown>;

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.fieldController) return;
    this.fieldController = createMultiselectFieldController<unknown>({
      widgetId: this.fieldId,
      handle: handle as never,
      options: this.filteredOptions(handle as never),
      mode: this.mode,
    });
  }

  /**
   * Where a person lands when the panel opens: the part the contract names for this kind.
   *
   * Focus stayed on the trigger here while every other panel in the library put it on the thing the
   * panel was opened to operate — a filter box, a day, an hour, a swatch. Both are patterns a
   * combobox may follow, and that is the problem: a person met one of them in this renderer and the
   * other in the two beside it. ADR 0197.
   *
   * Through `focusWhenShown` because the panel is portalled: the frame this runs in may be the one
   * before it is drawn, and a `focus()` there is a no-op that reports nothing.
   */
  protected override onOpened(): void {
    const part = focusPartOnOpen("multiselect", { searchable: this.searchable });
    if (part === null) return;
    focusWhenShown(
      () => this.querySelector<HTMLElement>(`.${this.partClass(part)}`),
      { still: () => this._open },
    );
  }

  protected override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    this.measureHiddenChips();
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
    // The option list is a property and can be replaced; the controller is told rather than
    // rebuilt, so the query it is holding survives a list that changes beneath it.
    // `filterFn` narrows the same list, so a rule that changes which values may be offered has to
    // reach the controller the same way the list itself does.
    if ((changed.has("options") || changed.has("filterFn")) && handle) {
      this.fieldController?.setOptions(this.filteredOptions(handle));
    }
  }

  constructor() {
    super();
    this.searchable = false;
    this.reorderable = false;
    this.loading = false;
    this.mode = "single";
    this._query = "";
  }

  protected override get multiselectable(): boolean {
    return true;
  }

  /**
   * What the field holds, as a list.
   *
   * A value that is not one is one value. `patchValue` is public and a draft is data, so a string, a
   * number or an object reaches this element; read with `.map` it threw from inside the render, and
   * an element whose render throws keeps what it was showing with nothing on the page to correct.
   * Held as one value, the form's own shape gate is what objects to it — visibly.
   */
  private held(handle: MdyFieldHandle<readonly unknown[]>): readonly unknown[] {
    const value = handle.value() as unknown;
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * What is chosen and how much of it — read from the controller rather than recounted here.
   *
   * Counting again means keying again, and a key the contract did not produce agrees with it on
   * strings and parts ways on objects: every one collapses to a single entry, so a strip of five
   * chips behaves as if it held one.
   */
  private chosen(): { readonly keys: ReadonlySet<string>; readonly counts: ReadonlyMap<string, number> } {
    const state = this.fieldController?.state();
    return { keys: state?.selectedKeys ?? new Set(), counts: state?.counts ?? new Map() };
  }

  protected override isSelected(
    // The base declares the handle; the answer comes from the controller bound to it, so this one
    // is the signature's and not the body's.
    _handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): boolean {
    return this.chosen().keys.has(defaultOptionKey(value));
  }

  /**
   * What a held value is called, matched the way the list itself is reconciled.
   *
   * Identity first, then the contract's key: a draft, a refetch or an import hands the field a fresh
   * object that *is* an option's value without *being* it, and asked only the exact question the
   * chip fell through to the fallback — which for an object is `[object Object]`, a label naming
   * nothing a person chose.
   */
  private labelFor(value: unknown): string {
    const key = defaultOptionKey(value);
    const option = this.options.find((o) => o.value === value)
      ?? this.options.find((o) => defaultOptionKey(o.value) === key);
    return option?.label ?? key;
  }

  /**
   * What this element paints: the declared options, plus every held value they do not contain.
   *
   * A widget does not erase a value to make itself consistent, and what it will not erase it has to
   * show — otherwise the form holds something nobody can see, and nobody can take off.
   */
  private paintedOptions(handle: MdyFieldHandle<readonly unknown[]>): ReadonlyArray<MdySelectOption<unknown>> {
    return optionsWithUnrecognizedValues(this.options, handle.value());
  }

  private filteredOptions(handle: MdyFieldHandle<readonly unknown[]>): ReadonlyArray<MdySelectOption<unknown>> {
    const opts = this.paintedOptions(handle);
    return this.filterFn ? opts.filter((o) => this.filterFn!(o.value)) : opts;
  }

  private searchResults(
    handle: MdyFieldHandle<readonly unknown[]>,
  ): ReadonlyArray<MdySelectOption<unknown>> {
    // Every option, chosen or not, with the state that says which. Filtering the chosen ones out
    // was this renderer's own answer: the contract gives each option a `selected` state and, in
    // toggle mode, `aria-pressed` — both unreachable for a list that removes what was taken. It also
    // made the strip's overflow affordance a lie, because the values it says are out of sight are
    // exactly the ones such a list omits.
    //
    // The narrowing is the controller's answer rather than a second one. Deriving it here as well
    // gave a value the field holds two fates — the widening for a held value the list does not carry
    // runs on both sides of `filterFn`, so a filter that rejects such a value removed it here and
    // the controller put it back — and left the cursor stepping a list this panel is not drawing.
    // ADR 0196.
    return this.fieldController?.filteredOptions() ?? this.filteredOptions(handle);
  }

  /**
   * One selection change, decided by the controller for this kind.
   *
   * Toggling, counting and what a readonly field refuses were written here, in a third form that
   * matched neither of the other renderers — which is the divergence a shared contract exists to
   * make impossible rather than to catch afterwards.
   */
  protected override pick(
    _handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): void {
    const optionKey = defaultOptionKey(value);
    this.fieldController?.dispatch(
      this.mode === "multi" ? { type: "increment", optionKey } : { type: "toggle", optionKey },
    );
  }

  private increment(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "increment", optionKey: defaultOptionKey(value) });
    this.sayQuantity(defaultOptionKey(value));
  }

  private decrement(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "decrement", optionKey: defaultOptionKey(value) });
    this.sayQuantity(defaultOptionKey(value));
  }

  /**
   * The quantity, said once the pressing stops.
   *
   * A held arrow steps many times, and a region read on every step reads a backlog out after the
   * person has let go. Nothing is said for a quantity that reached zero: the value is gone, and the
   * removal has its own sentence and its own way back.
   */
  private readonly quantityVoice = settledVoice((sentence) => { this._said = sentence; this.requestUpdate(); });

  private sayQuantity(key: string): void {
    const count = this.fieldController?.state().counts.get(key) ?? 0;
    if (count === 0) return;
    this.quantityVoice.announce(quantityAnnouncement(
      this.labelFor(key),
      count,
      { settled: this.messages.quantitySettled, atMinimum: this.messages.quantityAtMinimum },
    ));
  }

  /**
   * Takes a value off and puts focus where the contract says it goes.
   *
   * Left to the browser, focus lands on whatever now occupies that position — the next chip while
   * one exists, and the document at the end of the strip. So removing from the middle looks
   * deliberate and removing the last drops focus off the control entirely.
   */
  private removeAndPlaceFocus(
    handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
    direction: "forward" | "backward" = "forward",
  ): void {
    const order = chosenKeyOrder(this.fieldController?.state() ?? { counts: new Map() });
    const next = chipFocusAfterRemoval(order, defaultOptionKey(value), direction);
    // The stop moves with the focus, or the next Tab returns to a chip that is no longer there.
    if (next !== null) this._activeChip = next;
    this.removeValue(handle, value);
    // Twice: the first `updateComplete` can settle for a render that was already scheduled when the
    // value changed, so the strip is still the old one and focus lands on whatever sat at that
    // index before. The second waits for the render the removal caused.
    void this.updateComplete.then(() => this.updateComplete).then(() => {
      // The chip, not the button inside it: the strip is one tab stop and the chip is what carries
      // it, so landing on a child with `tabindex="-1"` leaves the roving index pointing at one
      // element and the keyboard standing on another.
      const landing = next === null
        ? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)
        : elementByDataKey(this, "key", next);
      (landing ?? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`))?.focus();
    });
  }

  /** Takes a chosen value off entirely, whatever its count — the chip's own control. */
  private removeValue(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "toggle", optionKey: defaultOptionKey(value) });
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    return this.held(handle).map((v) => this.labelFor(v)).join(", ");
  }

  /**
   * Open or closed, decided by the controller and mirrored here.
   *
   * The element kept its own answer and never told the controller, so the two disagreed about a
   * state only one of them owns: everything the controller derives from `open` — where the cursor
   * is, whether it may be announced — was computed against a list it believed to be closed, and
   * type-ahead moved a cursor `aria-activedescendant` then refused to name.
   */
  protected override toggleOpen(handle: MdyFieldHandle<readonly unknown[]>): void {
    if (handle.disabled()) return;
    this.fieldController?.dispatch({ type: "toggleOpen" });
    this._open = this.fieldController?.state().open ?? !this._open;
    if (this._open) {
      this.overlay.open();
      // This override does not reach the base's lifecycle, so the hook the base calls on opening has
      // to be called here: without it the panel opens and nothing tells the subclass, which is how
      // focus stayed on the trigger while every other panel put it on what the person opened it for.
      this.onOpened();
    } else {
      this.overlay.close();
    }
  }

  /**
   * Put focus back on the button that opened the list.
   *
   * Only on keyboard dismissal. Closing because the user clicked somewhere else must leave focus
   * where they clicked, so this is not folded into `close`.
   */
  private restoreFocus(): void {
    this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)?.focus();
  }

  protected override close(_handle: MdyFieldHandle<readonly unknown[]>): void {
    if (!this._open) return;
    this.fieldController?.dispatch({ type: "close" });
    this._open = false;
    this.overlay.close();
  }

  /**
   * Tab out of an open popup closes it, which is what the keyboard table declares for this kind.
   *
   * Not `preventDefault`: Tab is already carrying the keyboard onward and pulling it back would trap
   * a person in the field they just left.
   */
  protected override tabbedAway(): void {
    if (!this._open) return;
    if (!keyMeans("multiselect", "Tab", "cancel", true)) return;
    const handle = this.field;
    if (handle) this.close(handle);
  }

  /** Closed when the keyboard moves on, which this kind's contract asks for. */
  protected override focusLeft(): void {
    if (!this._open) return;
    if (!capabilityOf("multiselect", "dismissOnFocusOutside")) return;
    const handle = this.field;
    if (handle) this.close(handle);
  }

  override disconnectedCallback(): void {
    this.overlay.close();
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  private onSearchInput(e: Event): void {
    this._query = (e.target as HTMLInputElement).value;
    // Told to the controller, not only kept here. The cursor is the controller's and it steps
    // through the options the controller believes are visible: a query it never hears leaves the
    // keyboard walking the whole list while the panel draws a slice of it, and
    // `aria-activedescendant` then names an option nobody can see.
    this.fieldController?.dispatch({ type: "search", query: this._query });
  }

  protected override onKeydown(
    e: KeyboardEvent,
    handle: MdyFieldHandle<readonly unknown[]>,
  ): void {
    /**
     * The binding, not the intent. Both dismissals are declared `cancel` and they differ in what a
     * renderer may do with the key: `Escape` is the panel's to take, `Tab` is already carrying the
     * keyboard to the next field and cancelling it strands the person in a panel being torn down.
     * `restoresFocus` is the field that tells them apart. Asked by intent alone, this called
     * `preventDefault` on `Tab` — which no check outside a browser can see, because there is no
     * native Tab to prevent. ADR 0168.
     */
    const dismissal = keyBindingFor(this.widgetKind, e, this._open);
    if (dismissal?.intent === "cancel") {
      if (this._open) {
        if (dismissal.restoresFocus === true) e.preventDefault();
        this.close(handle);
        this.restoreFocus();
      }
      return;
    }
    // Which keys open it comes from the table, not from a list written here: a renderer that keeps
    // its own copy answers three of the four the contract declares, and the missing one is invisible
    // until somebody presses it.
    if (!this._open && keyMeans("multiselect", e, "open", false)) {
      e.preventDefault();
      this.overlay.open();
      this._open = true;
      // Raised from a key, so the cursor opens on a choice rather than nowhere. ADR 0179.
      this.fieldController?.dispatch({ type: "open", by: "keyboard" });
      this.followCursor();
      return;
    }
    // Moving through the options and taking one, from wherever the keyboard is — which with a
    // filter box is the filter box. The policy has always returned both; until the controller had a
    // cursor there was nowhere to send them, so a person who opened the list could reach the search
    // and nothing else.
    const action = multiselectOverlayAction({
      key: e,
      open: this._open,
      query: this._query,
      activeKey: this.fieldController?.state().activeKey ?? null,
    });
    // A letter typed at an open list without a filter box moves the cursor to the first match. Only
    // without one: a searchable popup already answers typing by narrowing the list, and the two
    // would compete for the same keystrokes.
    if (!action && !this.searchable && this._open && isTypeaheadCharacter(e.key, e)) {
      e.preventDefault();
      this.fieldController?.dispatch({ type: "typeahead", character: e.key });
      // The cursor lives in the controller and this element renders from a snapshot, so a move that
      // changes nothing else on screen would not repaint the reference that names it.
      this.requestUpdate();
      this.followCursor();
      return;
    }
    if (!action || action.type === "close" || action.type === "open") return;
    e.preventDefault();
    this.fieldController?.dispatch(action as never);
    if (action.type === "move") { this.requestUpdate(); this.followCursor(); }
  }

  /**
   * Which option the cursor is on, named on **the element that holds focus**.
   *
   * A reference on an element a person is not standing on says nothing. With a filter box the
   * keyboard is in it, so the filter box carries the reference; without one the trigger keeps focus
   * and carries it. `aria-activedescendant` is how a control points at something it does not
   * contain focus for, and it only speaks from where the person is reading.
   */
  private activeDescendant(): string | null {
    // The controller's `open`, not this element's copy of it: the two settle on different renders,
    // and reading the copy left the reference absent on exactly the pass that first had a cursor.
    const state = this.fieldController?.state();
    if (!state?.open || !state.activeKey) return null;
    return this.fieldController?.view().parts[state.activeKey]?.id ?? null;
  }

  /**
   * Puts DOM focus on the option the cursor is on, where there is no filter box to name it.
   *
   * With a filter box the cursor is announced through `aria-activedescendant` and focus stays where
   * a person is typing. Without one there is no element to carry that reference, so the cursor and
   * focus have to be the same thing.
   */
  private followCursor(): void {
    if (this.searchable) return;
    const key = this.fieldController?.state().activeKey;
    if (!key) return;
    void this.updateComplete.then(() => {
      const chip = elementByDataKey(this, "option-key", key);
      (chip?.querySelector<HTMLElement>("button") ?? chip)?.focus();
    });
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    // Composed by the factory, so the id is one a consumer can build from the scope. See the note in
    // the range field: a hyphen is unique and unreachable.
    const triggerId = defaultWidgetIdFactory.part(this.fieldId, "trigger");
    const position = this.overlay.state.position;
    const alignment = this.overlay.state.alignment;

    // The contract's `popup` part, not bare content: an overlay rendered straight into a
    // `display: contents` panel takes part in layout and shifts the page open.
    const overlay = html`
      <div
        class="${this.popupClass(position)} mdy-overlay"
        id=${overlayControlledId("multiselect", this.fieldId) ?? nothing}
        role=${this.partRole("popup")}
        aria-labelledby="${this.fieldId}__label"
        @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
      >
      ${this.searchable
        ? html`<input
            type="text"
            class="mdy-multiselect-overlay__input"
            .value=${this._query}
            @input=${this.onSearchInput}
            placeholder=${this.messages.searchPlaceholder}
            aria-label=${this.messages.searchOptionsLabel}
            aria-controls=${this.fieldController?.view().parts.group?.id ?? nothing}
            aria-activedescendant=${this.activeDescendant() ?? nothing}
          />`
        : nothing}
      ${this.optionTemplate
        ? html`<button type="button" class=${MDY_CHIP_CLASSES.wrapper}>Custom option</button>`
        : nothing}
      ${this.searchResults(handle).length === 0
        ? html`<div class="mdy-multiselect-overlay__empty">
            ${this.loading
              ? html`<div class="mdy-select__loading-content">
                  ${mdyIcon("LOADER", "mdy-select__loader")}
                  <span>Loading…</span>
                </div>`
              : html`${this.messages.noResults}`}
          </div>`
        : this.renderOptionsGrid(handle, this.searchResults(handle), "mdy-multiselect-overlay__grid")}
      </div>
    `;

    return html`
      ${this.renderLabel(handle, triggerId)}
      <div class="${this.wrapperClass(handle)}">
        ${this.querySelector('[slot="prefix"]') === null
          ? nothing
          : html`<div class="mdy-input-prefix"><slot name="prefix"></slot></div>`}
        <!-- The box carries no role, no name and no description. It held role="group" and both of
             the others, alone among the three renderers and declared by no contract — an extra level
             in the accessibility tree for the same document, depending on which renderer drew it.
             The combobox inside it holds the value, the name and the description; the list of
             options is the group the catalogue does declare. -->
        <div
          class="mdy-multiselect ${this._open ? "mdy-multiselect--open" : ""}"
          @keydown=${(e: KeyboardEvent) => {
            if (this.undoGesture(e)) return;
            // A key that reached the box was not necessarily aimed at it. The bindings this policy
            // answers name the part they belong to — `Enter` and `Space` are declared `on: "trigger"`
            // — and a command standing inside the field is a different part. Every one of them is a
            // `<button>`, which the platform already activates with both keys; answering here calls
            // `preventDefault` on it, and the button a person has focused draws its ring, says it can
            // be operated, and does nothing.
            // Compared against the opener by identity, not by tag: the opener is a button too, and
            // it is the one part whose keys these are. The popup is not covered by this — an option
            // there is a button, and the keys that move between options are this policy's.
            const target = e.target;
            const opener = this.querySelector(`.${this.partClass("trigger")}`);
            if (target !== opener && target instanceof HTMLElement && target.closest("button") !== null) return;
            this.onKeydown(e, handle);
          }}
          @click=${(e: Event) => {
            // The box forwards a press on **its own** area, and nothing else (ADR 0142). Asking
            // instead whether the press crossed a `button` on the way up let a chip through, because
            // a chip is a span: pressing one both focused it and opened the list, where the other
            // two renderers only focused it. What a press does is decided by what it landed on, not
            // by what that thing happens to be made of.
            if (e.target !== e.currentTarget) return;
            // The opener takes the reading position before the list opens, exactly as it does when
            // the keyboard opens it. A press leaves focus wherever the pointer left it — on the box,
            // which is not focusable, so nowhere — and a panel opened with focus on nothing answers
            // no arrow and no dismissal: the person who opened it with a hand on the mouse and then
            // reached for the keyboard cannot close what they just opened. Which way in a person
            // came is not a statement about which hand they will use next.
            this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)?.focus();
            if (!this._open) this.overlay.open(e);
            this.toggleOpen(handle);
          }}
        >
          <!-- The strip before the opener, and beside it rather than inside it: a chip carries a
               button that takes a value off, and a control that opens something may not contain a
               control that destroys something (ADR 0142). Read in this order too — the chips are
               what the field holds, the opener is the space after them. -->
          ${this.held(handle).length === 0 ? nothing : html`<span
            class="${this.partClass("chips")}"
            role=${this.partRole("chips")}
            aria-colcount=${this.held(handle).length}
            aria-rowcount="1"
            @wheel=${(e: WheelEvent) => this.onStripWheel(e)}
          ><!-- ARIA structures a grid as grid → row → cell, and this strip is one row of cells. ADR 0148. -->
            <span
              class="${this.partClass("chipRow")}"
              role=${this.partRole("chipRow")}
              aria-rowindex="1"
            >${this.renderValueChips(handle)}</span></span>`}

          <button
            type="button"
            id=${triggerId}
            class="${this.partClass("trigger")}"
            ?disabled=${handle.disabled()}
            @click=${(e: Event) => {
              // On the control itself. The box around it deliberately ignores clicks that land on a
              // button inside it — a chip, a stepper — and the control is a button, so a handler
              // only on the box never heard the one press that matters.
              if (!this._open) this.overlay.open(e);
              this.toggleOpen(handle);
            }}
            aria-label=${this.label || nothing}
            role=${MDY_POPUP_OPENERS.multiselect?.role ?? nothing}
            aria-haspopup=${this.popupPromise}
            aria-expanded=${this._open ? "true" : "false"}
            aria-required=${String(handle.required())}
            aria-readonly=${handle.readonly() ? "true" : nothing}
            aria-controls=${overlayControlledId("multiselect", this.fieldId) ?? nothing}
            aria-activedescendant=${this.searchable ? nothing : (this.activeDescendant() ?? nothing)}
            aria-describedby=${fieldDescribedBy({
              errorId: this.errorsId, descriptionId: this.descriptionId,
              errorsPresent: !this.inlineErrors && (this.showErrors(handle) || this.errorsReserved(handle)),
              descriptionPresent: true,
            }) ?? nothing}
            aria-invalid=${String(this.showErrors(handle))}
            @blur=${() => this.requestUpdate()}
            aria-disabled=${String(handle.disabled())}
          >
            ${this.held(handle).length === 0
              ? html`<span class="${this.partClass("placeholder")}">${this.messages.selectPlaceholder}</span>`
              : nothing}
            ${this.loading ? mdyIcon("LOADER", "mdy-select__loader") : nothing}
          </button>

          <!-- How many chips are out of sight, and the way to all of them. ADR 0127 lets the row
               scroll only where something reaches what leaves it: the wheel is that for most people
               and nothing at all for a pointer with no horizontal axis. -->
          ${html`<button
                type="button"
                class="${this.partClass("overflowCount")}"
                ?hidden=${this._hiddenChips === 0}
                ?disabled=${handle.disabled() || handle.readonly()}
                aria-label=${this._hiddenChips === 0
                  ? nothing
                  : this.messages.chipsHidden.replace("{count}", String(this._hiddenChips))}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  // The same door the trigger opens, taken the same way: the element's copy of
                  // `open` and the overlay's own state both have to move, and `toggleOpen` is what
                  // moves them together.
                  if (this.field && !this._open) { this.overlay.open(e); this.toggleOpen(this.field); }
                }}
              >${this._hiddenChips === 0
                  ? nothing
                  : this.messages.chipsHiddenShort.replace("{count}", String(this._hiddenChips))}</button>`}
          ${this.renderWayBack(handle)}
          <!-- Every choice off at once, beside the trigger rather than inside it: the trigger is a
               button, and a button inside a button is neither valid nor reachable. -->
          <!-- Drawn whether or not there is anything to discard, and dimmed when there is not: a
               control that comes and goes with what the field holds moves the one beside it under
               the hands of whoever is aiming at it. ADR 0171. -->
          ${html`<button
                type="button"
                class="${this.partClass("clearAll")} ${this.partStateClass("clearAll", "disabled", this.held(handle).length === 0 || handle.disabled() || handle.readonly())}"
                aria-disabled=${String(this.held(handle).length === 0 || handle.disabled() || handle.readonly())}
                aria-label=${this.messages.clearSelection}
                title=${this.messages.clearSelection}
                @click=${() => {
                  if (this.held(handle).length === 0 || handle.disabled() || handle.readonly()) return;
                  this.fieldController?.dispatch({ type: "clear" });
                }}
              >${mdyIcon("CLOSE", "")}</button>`}
          <!-- The mark that says the field opens, painted by the box at its own trailing edge. It is
               decoration and not a control: the whole field is what opens the list, so a caret with
               a name of its own would be a second stop on the keyboard for a gesture that already
               has one. Last, because only the commands are in an order and a drawing is in none. -->
          ${mdyIcon("CHEVRON_DOWN", `${this.partClass("arrow")} ${this.partStateClass("arrow", "open", this._open)}`)}
          <!-- Said rather than shown: a choice lands and the strip is the only confirmation, which
               is the one a person using a screen reader does not get. -->
          <div
            class="${this.partClass("announcement")}"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >${this.announcementText(handle)}</div>
          <!-- The full name, for a chip the strip had to cut. Shown on hover *and* on focus: WCAG
               1.4.13 asks for both, and the title attribute is neither — it never appears for a keyboard or a
               touch user, who are exactly the people who cannot widen the chip. One element for the
               control, not one per chip: a child of the chip is part of the chip's own text. -->
          <span
            class="${this.partClass("chipTooltip")}"
            id="${this.fieldId}__chiptip"
            role="tooltip"
            style="inset-inline-start: ${this._chipTipAt}px"
            ?hidden=${this._namedChip === null}
          >${this._namedChip === null ? nothing : this.labelFor(this._namedChip)}</span>
        </div>
        <!-- Drawn only when something was given to it. An empty slot is not an empty box: the
             container still takes its width, and it takes it at the field's trailing edge — so every
             affordance inside the field stopped short of the edge by that width, and the column the
             eye follows was sixteen pixels off in one renderer of three. -->
        ${this.querySelector('[slot="suffix"]') === null
          ? nothing
          : html`<div class="mdy-input-suffix"><slot name="suffix"></slot></div>`}
      </div>
      ${renderOverlayPanel(overlay, this._open, {
        closedId: overlayControlledId("multiselect", this.fieldId) ?? undefined,
        modal: position === "overlay",
        alignment,
        position,
      })}
      ${this.renderSupportingText()}
      ${showBlockErrors || this.errorsReserved(handle) ? this.renderErrors(handle) : nothing}
    `;
  }

  /**
   * A grid of option chips: the one in the field, and the one in the popup.
   *
   * Both carry `mdy-multiselect__options`, so one rule lays out both; the popup's adds the overlay
   * class on top. Each chip sits in the contract's wrapper, which is what the grid arranges.
   */
  /**
   * What was chosen, drawn in the closed control: one chip per distinct value, with how many.
   *
   * A repeated value is a **quantity**, not a duplicate — `increment` takes `["a"]` to
   * `["a","a","a"]` — so the count sits on the chip and the steppers with it. One chip per entry
   * would make undoing one decision three separate removals; a chip with no count answers the same
   * for one of something as for three.
   */
  /**
   * Rearranging what was chosen, from the chip a person is looking at.
   *
   * The keys are the contract's, and so is the direction: the strip runs in the writing direction,
   * so `ArrowLeft` moves a chip *later* in a right-to-left document and a renderer reading the key
   * rather than the binding would have to know that.
   */
  /**
   * Puts the value back and leaves the reading position on what came back.
   *
   * The offer is withdrawn by using it, so whatever held focus is gone from the page the moment it
   * works — and a reading position on nothing sends a keyboard back to the top of the document. The
   * value restored is where a person is looking, so it is where they are put; a restore with nothing
   * to land on falls back to the opener, which is the field itself.
   */
  private undoAndLand(): void {
    const restored = this.fieldController?.state().wayBack?.optionKey ?? null;
    this.fieldController?.dispatch({ type: "undo" });
    void this.updateComplete.then(() => this.updateComplete).then(() => {
      // Compared rather than selected: a value is whatever a document put in it, and a selector
      // built from one needs escaping that not every host this runs in provides.
      const landing = restored === null
        ? undefined
        : Array.from(this.querySelectorAll<HTMLElement>("[data-key]"))
          .find((chip) => chip.dataset.key === restored);
      (landing ?? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`))?.focus();
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
  private undoGesture(event: KeyboardEvent): boolean {
    const binding = MDY_WIDGET_KEYBOARD.multiselect.find((one) => one.intent === "undo");
    if (binding === undefined || !matchesKeyGesture(binding, event)) return false;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]") !== null) return false;
    if ((this.fieldController?.state().wayBack ?? null) === null) return false;
    event.preventDefault();
    this.undoAndLand();
    return true;
  }

  private onChipKeydown(event: KeyboardEvent, handle: MdyFieldHandle<readonly unknown[]>, optionKey: string): void {
    // A key pressed on a control the chip carries is that control's, not the chip's. The chip's own
    // bindings share `Enter` and `Space` with the platform's activation of a button, so answering
    // here takes the key from the button a person has focused inside it — and the chip does
    // something else with it, which is worse than doing nothing.
    if (event.target !== event.currentTarget) return;
    // Asked as the chip. A key with no binding here belongs to the control and must reach it —
    // `ArrowDown` opens the popup from the trigger, arrows move the chip (grabbed or not).
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this._open, "chip");
    if (!binding) return;
    // The chip's keys are the chip's. Left to bubble, the control's own handler answers the same
    // keys a second time and its answer lands on top of this one.
    event.stopPropagation();
    // The order the value has, not the order the options are in.
    const order = chosenKeyOrder(this.fieldController?.state() ?? { counts: new Map() });

    if (binding.intent === "move") {
      event.preventDefault();
      const at = order.indexOf(optionKey);
      const to = binding.toEnd
        ? (binding.by === -1 ? 0 : order.length - 1)
        : Math.max(0, Math.min(order.length - 1, at + (binding.by ?? 1)));
      // Held, the arrows carry the chip; free, they walk the strip. One movement, and the grab says
      // what its subject is.
      if (this._grabbed !== null && this._grabbed.key === optionKey) {
        if (to === at) return;
        this._saySoon = chipMovedAnnouncement(this.messages.selectionMoved, this.labelFor(optionKey), to + 1, order.length);
        this.fieldController?.dispatch({ type: "move-selected", optionKey, to });
        void this.updateComplete.then(() => this.focusChip(optionKey));
        return;
      }
      this.focusChip(order[to]);
      return;
    }
    // Picking up and putting down, one key: a state seen from both ends. Announced either way,
    // because a state nobody is told about is one they cannot know they are in — the arrows would
    // carry a chip a person believes is still walking the strip.
    if (binding.intent === "grab") {
      if (!this.reorderable) return;
      event.preventDefault();
      const at = order.indexOf(optionKey);
      const held = this._grabbed !== null && this._grabbed.key === optionKey;
      this._grabbed = held ? null : { key: optionKey, from: at };
      this._saySoon = chipMovedAnnouncement(
        held ? this.messages.selectionDropped : this.messages.selectionGrabbed,
        this.labelFor(optionKey), at + 1, order.length,
      );
      this.requestUpdate();
      return;
    }
    // Putting it back where it was picked up from, while something is held and not otherwise.
    if (binding.intent === "cancel") {
      if (this._grabbed === null || this._grabbed.key !== optionKey) return;
      event.preventDefault();
      const home = this._grabbed.from;
      this._grabbed = null;
      this._saySoon = chipMovedAnnouncement(this.messages.selectionReturned, this.labelFor(optionKey), home + 1, order.length);
      this.fieldController?.dispatch({ type: "move-selected", optionKey, to: home });
      void this.updateComplete.then(() => this.focusChip(optionKey));
      return;
    }
    // The quantity, from the keyboard. The ± controls are `tabindex="-1"` pointer affordances, so
    // these two keys are the only way to a counter chip's number without a mouse.
    if (binding.intent === "step") {
      event.preventDefault();
      this.fieldController?.dispatch(
        event.key === "ArrowUp" ? { type: "increment", optionKey } : { type: "decrement", optionKey },
      );
      this.sayQuantity(optionKey);
      void this.updateComplete.then(() => this.focusChip(optionKey));
      return;
    }
    if (binding.intent === "remove") {
      event.preventDefault();
      // Backspace goes back, Delete goes on — the convention every text field has.
      this.removeAndPlaceFocus(handle, optionKey, event.key === "Backspace" ? "backward" : "forward");
      return;
    }
  }

  /**
   * Which chip the strip's single tab stop is on.
   *
   * A roving index: one stop for the whole strip. One stop per chip made the cost of tabbing past
   * the field grow with what it holds — twelve chosen values were twenty-six presses.
   */
  private activeChip(): string | null {
    const order = chosenKeyOrder(this.fieldController?.state() ?? { counts: new Map() });
    if (this._activeChip !== null && order.includes(this._activeChip)) return this._activeChip;
    return order[0] ?? null;
  }

  private focusChip(key: string | undefined): void {
    if (key === undefined) return;
    this._activeChip = key;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      elementByDataKey(this, "key", key)?.focus();
    });
  }

  /** The strip's wheel behaviour is the contract's; see `scrollChipStripByWheel`. */
  /**
   * The one way back, under the control.
   *
   * Untimed: a message that disappears after five seconds is a time limit under WCAG 2.2.1, and an
   * undo has no exception under it. It stands until it is used or another act replaces it — and the
   * person who most needs it is the slowest to reach it, because the keyboard path to the field's
   * trailing edge runs through every chip.
   *
   * A mark rather than a sentence, so the act lives in its accessible name; it names the act because
   * one reversal covers three. What happened is said by the live region, which owes that
   * announcement whether or not a way back is on offer.
   */
  private renderWayBack(handle: MdyFieldHandle<readonly unknown[]>) {
    const offer = this.fieldController?.state().wayBack ?? null;
    const named = wayBackActionName(
      offer,
      {
        label: this.messages.wayBackLabel,
        removed: this.messages.wayBackRemoved,
        moved: this.messages.wayBackMoved,
        cleared: this.messages.wayBackCleared,
      },
      (key) => this.labelFor(key),
    );
    // Always in the row, dimmed where there is nothing to put back, so the clear-all beside it stands
    // where it stood whether or not a way back is on offer. A control that moves as the offer arrives
    // is one a person presses meaning the other.
    //
    // `aria-disabled` rather than the property: the native one takes the button out of the tab order
    // and takes focus with it when the state changes under somebody who has just pressed it.
    // Announced as unavailable, still reachable, refused in the handler. ADR 0171.
    const noWayBack = offer === null || handle.disabled() || handle.readonly();
    return html`<button
      type="button"
      class="${this.partClass("wayBackAction")} ${this.partStateClass("wayBackAction", "disabled", noWayBack)}"
      aria-disabled=${String(noWayBack)}
      aria-label=${named}
      title=${named}
      @click=${() => { if (!noWayBack) this.undoAndLand(); }}
    >${mdyIcon("UNDO", "")}</button>`;
  }

  private readonly onStripWheel = scrollChipStripByWheel;

  /**
   * The change, not the list, and nothing while the popup is open.
   *
   * Seeded from what the field already holds, because a value that arrived with the form is not
   * something the person just did.
   */
  private announcementText(handle: MdyFieldHandle<readonly unknown[]>): string {
    const now = [...new Set(this.held(handle).map((value) => defaultOptionKey(value)))];
    if (this._saidLast === null) { this._saidLast = now; return ""; }
    if (this._saySoon !== null) { this._said = this._saySoon; this._saySoon = null; this._saidLast = now; return this._said; }
    const said = multiselectAnnouncement(
      this._saidLast, now,
      {
        added: this.messages.selectionAdded,
        removed: this.messages.selectionRemoved,
        empty: this.messages.selectionEmpty,
        removedLast: this.messages.selectionRemovedLast,
        addedMany: this.messages.selectionAddedMany,
        removedMany: this.messages.selectionRemovedMany,
        removedManyLast: this.messages.selectionRemovedManyLast,
      },
      (key) => this.labelFor(key),
    );
    this._saidLast = now;
    // A render that describes no change leaves the sentence where it is. Returning "" over one
    // takes it back before a reader has reached it — and a move renders twice, once for the value
    // and once to put focus back on the chip that moved, so the second pass was erasing the first.
    if (said === "") return this._said;
    this._said = said;
    return said;
  }

  /** How many chips the strip is hiding, measured after each render of what was actually drawn. */
  private _hiddenChips = 0;

  /** Which chip is being named, and where its tooltip sits in the control's own coordinates. */
  private _namedChip: string | null = null;
  private _chipTipAt = 0;

  private revealChipName(chip: HTMLElement, _label: string): void {
    const strip = this.querySelector<HTMLElement>(`.${this.partClass("chips").split(" ")[0]}`);
    this._chipTipAt = strip === null ? 0 : chipTooltipOffset(chip, strip);
    this._namedChip = chip.dataset.key ?? null;
    this.requestUpdate();
  }

  private hideChipName(): void {
    this._namedChip = null;
    this.requestUpdate();
  }

  private renderValueChips(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const tally = new Map<string, { readonly value: unknown; readonly label: string; count: number }>();
    for (const value of this.held(handle)) {
      const key = defaultOptionKey(value);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { value, label: this.labelFor(value), count: 1 });
    }
    return [...tally.values()].map(({ value, label, count }, index) => html`<span
      class=${multiselectChipClasses({ mode: this.mode, role: "value", selected: true }).join(" ")}
      tabindex=${this.activeChip() === defaultOptionKey(value) ? "0" : "-1"}
      role=${this.partRole("chip")}
      @focus=${(e: FocusEvent) => {
        this._activeChip = defaultOptionKey(value);
        this.revealChipName(e.currentTarget as HTMLElement, label);
        const strip = this.querySelector<HTMLElement>(".mdy-multiselect__chips");
        if (strip !== null) requestAnimationFrame(() => keepFocusedChipInView(strip));
      }}
      @pointerenter=${(e: PointerEvent) => this.revealChipName(e.currentTarget as HTMLElement, label)}
      @pointerleave=${() => this.hideChipName()}
      @blur=${() => this.hideChipName()}
      aria-describedby=${this._namedChip === defaultOptionKey(value) ? `${this.fieldId}__chiptip` : nothing}
      @pointerdown=${(e: PointerEvent) => this.startChipDrag(e, defaultOptionKey(value))}
      @keydown=${(e: KeyboardEvent) => this.onChipKeydown(e, handle, defaultOptionKey(value))}
      aria-label=${count > 1 ? `${label}, ${count}` : label}
      title=${label}
      data-key=${defaultOptionKey(value)}
      aria-colindex=${index + 1}
    >
      ${this.reorderable
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.move}
            tabindex="-1"
            aria-label=${chipActionName(this.messages.chipMoveEarlierLabel, label)}
            @click=${(e: Event) => { e.stopPropagation(); this.moveByPointer(defaultOptionKey(value), -1); }}
          ></button>`
        : nothing}
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            tabindex="-1"
            aria-label=${chipActionName(this.messages.chipDecrementLabel, label)}
            @click=${(e: Event) => { e.stopPropagation(); this.decrement(handle, value); }}
          >${mdyIcon("MINUS", "")}</button>`
        : nothing}
      <span class=${MDY_CHIP_CLASSES.label}>${label}</span>
      <span class=${MDY_CHIP_CLASSES.count} ?hidden=${count <= 1}>${count > 1 ? String(count) : ""}</span>
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            tabindex="-1"
            aria-label=${chipActionName(this.messages.chipIncrementLabel, label)}
            @click=${(e: Event) => { e.stopPropagation(); this.increment(handle, value); }}
          >${mdyIcon("PLUS", "")}</button>`
        : nothing}
      ${this.reorderable
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.move}
            tabindex="-1"
            aria-label=${chipActionName(this.messages.chipMoveLaterLabel, label)}
            @click=${(e: Event) => { e.stopPropagation(); this.moveByPointer(defaultOptionKey(value), 1); }}
          ></button>`
        : nothing}
      <button
        type="button"
        class=${MDY_CHIP_CLASSES.remove}
        tabindex="-1"
        aria-label=${chipActionName(this.messages.chipRemoveLabel, label)}
        @click=${(e: Event) => { e.stopPropagation(); this.removeAndPlaceFocus(handle, value); }}
      ></button>
    </span>`);
  }

  private renderOptionsGrid(
    handle: MdyFieldHandle<readonly unknown[]>,
    options: ReadonlyArray<MdySelectOption<unknown>>,
    extraClass: string,
  ): unknown {
    // The id the projection gives the grid — not the one the opener names, which is the popup's and
    // is already on the panel. Two elements claiming one id is worse than a grid claiming none: every
    // reference to it stops being deterministic.
    return html`<div
      id=${this.fieldController?.view().parts.group?.id ?? nothing}
      class="${this.partClass("options")} ${extraClass}"
      role="group"
    >
      ${options.map(
        (option) => html`<div class=${MDY_CHIP_CLASSES.wrapper} data-option-key=${defaultOptionKey(option.value)}>${this.renderOptionChip(handle, option)}</div>`,
      )}
    </div>`;
  }

  /**
   * The id the projection gives one option, put on the element that draws it.
   *
   * `aria-activedescendant` names an element. Without this the control pointed at an id nothing
   * carried, so the cursor moved and a screen reader was told to look at nothing.
   */
  /**
   * How many chips the strip is hiding, taken from what the browser laid out.
   *
   * After the update rather than during it: how many fit depends on the labels, the theme's spacing
   * and the width the host gave the field, and a count computed before layout is a guess.
   */
  private measureHiddenChips(): void {
    const strip = this.querySelector<HTMLElement>(".mdy-multiselect__chips");
    if (strip === null) return;
    // The affordance takes its width out of the strip, so a chip the browser scrolled to on focus is
    // outside again by about that width. Whatever the strip ends up as wide as, the focused chip is
    // inside it.
    keepFocusedChipInView(strip);
    const hidden = hiddenChipCount(strip);
    if (hidden === this._hiddenChips) return;
    this._hiddenChips = hidden;
    this.requestUpdate();
  }

  /**
   * Everything the contract says about one option in the list, taken whole.
   *
   * The id was read from the projection and the classes were rebuilt beside it, which left the part
   * nothing rebuilt — `aria-disabled` and the native `disabled` — off the element entirely. An option
   * a document had closed was drawn exactly like one that could be chosen: the press was refused and
   * nothing on the page said why.
   */
  private optionPart(option: MdySelectOption<unknown>): MdyPartContract {
    return this.fieldController?.view().parts[defaultOptionKey(option.value)] ?? { classes: [], attributes: {} };
  }

  private renderOptionChip(
    handle: MdyFieldHandle<readonly unknown[]>,
    option: MdySelectOption<unknown>,
  ): unknown {
    if (this.mode === "multi") {
      const count = this.chosen().counts.get(defaultOptionKey(option.value)) ?? 0;
      return html`<div ${mdyPart(this.optionPart(option))}>
        <button
          type="button"
          class=${MDY_CHIP_CLASSES.step}
          ?disabled=${count === 0}
          aria-label=${`Decrease ${option.label}`}
          @click=${() => this.decrement(handle, option.value)}
        >
          ${mdyIcon("MINUS", "")}
        </button>
        <span class=${MDY_CHIP_CLASSES.label}>${option.label}</span>
        <span class=${MDY_CHIP_CLASSES.count}>×${count}</span>
        <button
          type="button"
          class=${MDY_CHIP_CLASSES.step}
          aria-label=${`Increase ${option.label}`}
          @click=${() => this.increment(handle, option.value)}
        >
          ${mdyIcon("PLUS", "")}
        </button>
      </div>`;
    }
    return html`<button
      type="button"
      ${mdyPart(this.optionPart(option))}
      title=${option.label}
      @click=${() => this.pick(handle, option.value)}
    >
      ${mdyIcon("CHECKMARK", MDY_CHIP_CLASSES.check)}
      <span class=${MDY_CHIP_CLASSES.label}>${option.label}</span>
    </button>`;
  }
}
