import {
  MDY_POPUP_OPENERS,
  overlayControlledId,
  shownErrorsOf,
  keyBindingFor,
  chipFocusAfterRemoval,
  multiselectAnnouncement,
  multiselectOverlayAction,
  chipMovedAnnouncement,
  chipDropIndex,
  stateClass,
  chipStripWheelDelta,
  isTypeaheadCharacter,
} from "@modyra/widgets";
import { type MdyFieldHandle, type MdyMultiselectMode, type MdySelectOption } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/widgets";
import {
  createMultiselectFieldController,
  MDY_CHIP_CLASSES,
  multiselectChipClasses,
  optionsWithUnrecognizedValues,
  type MdyMultiselectFieldController,
} from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations } from "lit";
import { mdyIcon } from "../base.js";
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
  private startChipDrag(event: PointerEvent, handle: MdyFieldHandle<readonly unknown[]>, optionKey: string): void {
    if (!this.reorderable || event.button !== 0) return;
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
      const order = [...new Set(this.held(handle).map((v) => String(v)))];
      const midpoints = order.map((each) => {
        const box = this.querySelector(`[data-key="${each}"]`)?.getBoundingClientRect();
        return box ? box.left + box.width / 2 : 0;
      });
      const to = chipDropIndex(midpoints, upEvent.clientX, order.indexOf(optionKey));
      if (to === order.indexOf(optionKey)) return;
      this._saySoon = chipMovedAnnouncement(this.messages.selectionMoved, this.labelFor(optionKey), to + 1, order.length);
      this.fieldController?.dispatch({ type: "move-selected", optionKey, to });
      this._activeChip = optionKey;
    };
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerup", onUp);
    view.addEventListener("pointercancel", done);
  }

  /**
   * The pointer's way to move a chip, which is not a drag.
   *
   * WCAG 2.5.7 asks for a single-pointer path independently of the keyboard's: somebody who cannot
   * hold and drag has no way to reorder otherwise, and `Alt`+arrows does not discharge it.
   */
  private moveByPointer(handle: MdyFieldHandle<readonly unknown[]>, optionKey: string, by: -1 | 1): void {
    const order = [...new Set(this.held(handle).map((v) => String(v)))];
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
      options: this.options,
      mode: this.mode,
    });
  }

  override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed);
    // A field out of play keeps no popup over it: the overlay is torn down where every renderer
    // tears it down, in answer to the field rather than to a gesture.
    const handle = this.field;
    if (handle) closeOverlayOutOfPlay(this, handle.interactivity(), () => this.overlay.close());
    // The option list is a property and can be replaced; the controller is told rather than
    // rebuilt, so the query it is holding survives a list that changes beneath it.
    if (changed.has("options")) this.fieldController?.setOptions(this.options);
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

  private selectedSet(handle: MdyFieldHandle<readonly unknown[]>): Set<string> {
    return new Set(this.held(handle).map((v) => String(v)));
  }

  private counts(handle: MdyFieldHandle<readonly unknown[]>): Map<string, number> {
    const map = new Map<string, number>();
    for (const v of this.held(handle)) {
      const key = String(v);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  protected override isSelected(
    handle: MdyFieldHandle<readonly unknown[]>,
    value: unknown,
  ): boolean {
    return this.selectedSet(handle).has(String(value));
  }

  private labelFor(value: unknown): string {
    return this.options.find((o) => o.value === value)?.label ?? String(value);
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
    let opts = this.filteredOptions(handle);
    if (this.mode === "single") {
      const selected = this.selectedSet(handle);
      opts = opts.filter((o) => !selected.has(String(o.value)));
    }
    return filterOptionsByQuery(opts, this._query);
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
    const optionKey = String(value);
    this.fieldController?.dispatch(
      this.mode === "multi" ? { type: "increment", optionKey } : { type: "toggle", optionKey },
    );
  }

  private increment(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "increment", optionKey: String(value) });
  }

  private decrement(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "decrement", optionKey: String(value) });
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
    const order = [...new Set(this.held(handle).map((v) => String(v)))];
    const next = chipFocusAfterRemoval(order, String(value), direction);
    this.removeValue(handle, value);
    // Twice: the first `updateComplete` can settle for a render that was already scheduled when the
    // value changed, so the strip is still the old one and focus lands on whatever sat at that
    // index before. The second waits for the render the removal caused.
    void this.updateComplete.then(() => this.updateComplete).then(() => {
      const landing = next === null
        ? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`)
        : this.querySelector<HTMLElement>(`[data-key="${next}"] .${MDY_CHIP_CLASSES.remove}`);
      (landing ?? this.querySelector<HTMLElement>(`.${this.partClass("trigger")}`))?.focus();
    });
  }

  /** Takes a chosen value off entirely, whatever its count — the chip's own control. */
  private removeValue(_handle: MdyFieldHandle<readonly unknown[]>, value: unknown): void {
    this.fieldController?.dispatch({ type: "toggle", optionKey: String(value) });
  }

  protected override triggerText(handle: MdyFieldHandle<readonly unknown[]>): string {
    return this.held(handle).map((v) => this.labelFor(v)).join(", ");
  }

  protected override toggleOpen(handle: MdyFieldHandle<readonly unknown[]>): void {
    if (handle.disabled()) return;
    this._open = !this._open;
    if (this._open) {
      this.overlay.open();
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
    this._open = false;
    this.overlay.close();
  }

  override disconnectedCallback(): void {
    this.overlay.close();
    this.fieldController?.destroy();
    this.fieldController = undefined;
    super.disconnectedCallback();
  }

  private onSearchInput(e: Event): void {
    this._query = (e.target as HTMLInputElement).value;
  }

  protected override onKeydown(
    e: KeyboardEvent,
    handle: MdyFieldHandle<readonly unknown[]>,
  ): void {
    if (e.key === "Escape") {
      if (this._open) {
        e.preventDefault();
        this.close(handle);
        this.restoreFocus();
      }
      return;
    }
    if (!this._open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      this.overlay.open();
      this._open = true;
      this.fieldController?.dispatch({ type: "open" });
      return;
    }
    // Moving through the options and taking one, from wherever the keyboard is — which with a
    // filter box is the filter box. The policy has always returned both; until the controller had a
    // cursor there was nowhere to send them, so a person who opened the list could reach the search
    // and nothing else.
    const action = multiselectOverlayAction({
      key: e.key,
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
   * Puts DOM focus on the option the cursor is on, where there is no filter box to name it.
   *
   * With a search box the cursor is announced through `aria-activedescendant` and focus stays where
   * a person is typing. Without one there is no element to carry that reference, so the cursor and
   * focus have to be the same thing.
   */
  /**
   * Which option the cursor is on, named from wherever focus actually is.
   *
   * Focus stays on the control while the list is open here, so the cursor has no element of its own
   * to be announced from: without this it moves and nothing says so. `aria-activedescendant` is how
   * a control points at something it does not contain focus for.
   */
  private activeDescendant(): string | null {
    // The controller's `open`, not this element's copy of it: the two settle on different renders,
    // and reading the copy left the reference absent on exactly the pass that first had a cursor.
    const state = this.fieldController?.state();
    if (!state?.open || !state.activeKey) return null;
    return this.fieldController?.view().parts[state.activeKey]?.id ?? null;
  }

  private followCursor(): void {
    if (this.searchable) return;
    const key = this.fieldController?.state().activeKey;
    if (!key) return;
    void this.updateComplete.then(() => {
      this.querySelector<HTMLElement>(`[data-option-key="${key}"] button, [data-option-key="${key}"]`)?.focus();
    });
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    const triggerId = `${this.fieldId}-trigger`;
    const position = this.overlay.state.position;
    const alignment = this.overlay.state.alignment;

    // The contract's `popup` part, not bare content: an overlay rendered straight into a
    // `display: contents` panel takes part in layout and shifts the page open.
    const overlay = html`
      <div
        class="${this.popupClass(position)} mdy-overlay"
        id=${overlayControlledId("multiselect", this.fieldId) ?? nothing}
        role=${this.partRole("popup")}
      >
      ${this.searchable
        ? html`<input
            type="text"
            class="mdy-multiselect-overlay__input"
            .value=${this._query}
            @input=${this.onSearchInput}
            placeholder=${this.messages.searchPlaceholder}
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
        <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
        <div
          class="mdy-multiselect ${this._open ? "mdy-multiselect--open" : ""}"
          @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          @click=${(e: Event) => {
            // The whole trigger opens the popup, not only the search affordance: every other widget
            // in the catalog opens from its trigger. Clicks that landed on a control inside it —
            // a chip, a step button, the search button — are that control's, not the trigger's.
            const path = e.composedPath();
            const own = path.slice(0, path.indexOf(e.currentTarget as EventTarget));
            if (own.some((node) => (node as Element).localName === "button")) return;
            if (!this._open) this.overlay.open(e);
            this.toggleOpen(handle);
          }}
          role="group"
          aria-label=${this.label || nothing}
          aria-describedby=${this.showErrors(handle) && !this.inlineErrors ? this.errorsId : this.descriptionId}
        >
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
            aria-controls=${this._open ? overlayControlledId("multiselect", this.fieldId) ?? nothing : nothing}
            aria-activedescendant=${this.activeDescendant() ?? nothing}
            aria-describedby=${this.showErrors(handle) && !this.inlineErrors ? this.errorsId : this.descriptionId}
            aria-invalid=${String(shownErrorsOf(handle).length > 0)}
            aria-disabled=${String(handle.disabled())}
          >
            <span
              class="${this.partClass("chips")}"
              @wheel=${(e: WheelEvent) => this.onStripWheel(e)}
            >${this.renderValueChips(handle)}</span>
            ${this.held(handle).length === 0
              ? html`<span class="${this.partClass("placeholder")}">${this.label ? `Select ${this.label.toLowerCase()}…` : "Select…"}</span>`
              : nothing}
            ${this.loading ? mdyIcon("LOADER", "mdy-select__loader") : nothing}
            <span class="${this.partClass("arrow")}" aria-hidden="true"></span>
          </button>
          <!-- Said rather than shown: a choice lands and the strip is the only confirmation, which
               is the one a person using a screen reader does not get. -->
          <div
            class="${this.partClass("announcement")}"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >${this.announcementText(handle)}</div>
        </div>
        <div class="mdy-input-suffix"><slot name="suffix"></slot></div>
      </div>
      ${renderOverlayPanel(overlay, this._open, {
        modal: position === "overlay",
        alignment,
        position,
      })}
      ${showBlockErrors ? this.renderErrors(handle) : nothing}
      ${this.renderSupportingText()}
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
  private onChipKeydown(event: KeyboardEvent, handle: MdyFieldHandle<readonly unknown[]>, optionKey: string): void {
    const binding = keyBindingFor("multiselect", `${event.altKey ? "Alt+" : ""}${event.key}`, this._open);
    // Only the intents this chip answers. A key the chip does not handle — `ArrowDown` opening the
    // popup, say — must reach the control, and swallowing it here left it doing nothing at all.
    if (!binding || !["move", "remove", "reorder"].includes(binding.intent)) return;
    // The chip's keys are the chip's. Left to bubble, the control's own handler answers the same
    // keys a second time and its answer lands on top of this one.
    event.stopPropagation();
    // The order the value has, not the order the options are in.
    const order = [...new Set(this.held(handle).map((v) => String(v)))];

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
      // Backspace goes back, Delete goes on — the convention every text field has.
      this.removeAndPlaceFocus(handle, optionKey, event.key === "Backspace" ? "backward" : "forward");
      return;
    }
    if (binding.intent !== "reorder" || !this.reorderable) return;
    event.preventDefault();
    // Said out loud, and set before dispatching. This way of reordering has no *grabbed* state to
    // announce, so the movement itself is the only thing there is to say.
    const to = Math.max(0, Math.min(order.length - 1, order.indexOf(optionKey) + (binding.by ?? 1)));
    this._saySoon = chipMovedAnnouncement(this.messages.selectionMoved, this.labelFor(optionKey), to + 1, order.length);
    this.fieldController?.dispatch({ type: "move-selected", optionKey, to });
    void this.updateComplete.then(() => this.focusChip(optionKey));
  }

  /**
   * Which chip the strip's single tab stop is on.
   *
   * A roving index: one stop for the whole strip. One stop per chip made the cost of tabbing past
   * the field grow with what it holds — twelve chosen values were twenty-six presses.
   */
  private activeChip(handle: MdyFieldHandle<readonly unknown[]>): string | null {
    const order = [...new Set(this.held(handle).map((v) => String(v)))];
    if (this._activeChip !== null && order.includes(this._activeChip)) return this._activeChip;
    return order[0] ?? null;
  }

  private focusChip(key: string | undefined): void {
    if (key === undefined) return;
    this._activeChip = key;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      this.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
    });
  }

  /** How many are chosen, in the field's own description: the state, asked for rather than announced. */
  protected override describedState(): string {
    const handle = this.field;
    if (!handle) return "";
    const count = new Set(this.held(handle).map((value) => String(value))).size;
    return count === 0 ? "" : this.messages.selectionCount.replace("{count}", String(count));
  }

  /**
   * A wheel reaches what has scrolled out of the strip.
   *
   * ADR 0127 allows the row to scroll only if there is a mechanism rather than a cue, and many
   * desktop mice have no horizontal axis at all.
   */
  private onStripWheel(event: WheelEvent): void {
    const strip = event.currentTarget as HTMLElement;
    const delta = chipStripWheelDelta(event.deltaX, event.deltaY, strip.scrollWidth, strip.clientWidth);
    if (delta === 0) return;
    event.preventDefault();
    strip.scrollLeft += delta;
  }

  /**
   * The change, not the list, and nothing while the popup is open.
   *
   * Seeded from what the field already holds, because a value that arrived with the form is not
   * something the person just did.
   */
  private announcementText(handle: MdyFieldHandle<readonly unknown[]>): string {
    const now = [...new Set(this.held(handle).map((value) => String(value)))];
    if (this._saidLast === null) { this._saidLast = now; return ""; }
    if (this._saySoon !== null) { const once = this._saySoon; this._saySoon = null; this._saidLast = now; return once; }
    const said = multiselectAnnouncement(
      this._saidLast, now,
      { added: this.messages.selectionAdded, removed: this.messages.selectionRemoved, empty: this.messages.selectionEmpty },
      (key) => this.labelFor(key),
      this._open,
    );
    this._saidLast = now;
    return said;
  }

  private renderValueChips(handle: MdyFieldHandle<readonly unknown[]>): unknown {
    const tally = new Map<string, { readonly value: unknown; readonly label: string; count: number }>();
    for (const value of this.held(handle)) {
      const key = String(value);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { value, label: this.labelFor(value), count: 1 });
    }
    const size = tally.size;
    return [...tally.values()].map(({ value, label, count }, index) => html`<span
      class=${multiselectChipClasses({ mode: this.mode, selected: true }).join(" ")}
      tabindex=${this.activeChip(handle) === String(value) ? "0" : "-1"}
      role="group"
      @focus=${() => { this._activeChip = String(value); }}
      @pointerdown=${(e: PointerEvent) => this.startChipDrag(e, handle, String(value))}
      @keydown=${(e: KeyboardEvent) => this.onChipKeydown(e, handle, String(value))}
      aria-label=${count > 1 ? `${label}, ${count}` : label}
      title=${label}
      data-key=${String(value)}
      aria-posinset=${index + 1}
      aria-setsize=${size}
    >
      ${this.reorderable
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.move}
            tabindex="-1"
            aria-label=${this.messages.chipMoveEarlierLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.moveByPointer(handle, String(value), -1); }}
          ></button>`
        : nothing}
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            tabindex="-1"
            aria-label=${this.messages.chipDecrementLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.decrement(handle, value); }}
          ></button>`
        : nothing}
      <span class=${MDY_CHIP_CLASSES.label}>${label}</span>
      <span class=${MDY_CHIP_CLASSES.count} ?hidden=${count <= 1}>${count > 1 ? String(count) : ""}</span>
      ${this.mode === "multi"
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.step}
            tabindex="-1"
            aria-label=${this.messages.chipIncrementLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.increment(handle, value); }}
          ></button>`
        : nothing}
      ${this.reorderable
        ? html`<button
            type="button"
            class=${MDY_CHIP_CLASSES.move}
            tabindex="-1"
            aria-label=${this.messages.chipMoveLaterLabel}
            @click=${(e: Event) => { e.stopPropagation(); this.moveByPointer(handle, String(value), 1); }}
          ></button>`
        : nothing}
      <button
        type="button"
        class=${MDY_CHIP_CLASSES.remove}
        tabindex="-1"
        aria-label=${this.messages.chipRemoveLabel}
        @click=${(e: Event) => { e.stopPropagation(); this.removeAndPlaceFocus(handle, value); }}
      ></button>
    </span>`);
  }

  private renderOptionsGrid(
    handle: MdyFieldHandle<readonly unknown[]>,
    options: ReadonlyArray<MdySelectOption<unknown>>,
    extraClass: string,
  ): unknown {
    return html`<div class="${this.partClass("options")} ${extraClass}" role="group">
      ${options.map(
        (option) => html`<div class=${MDY_CHIP_CLASSES.wrapper} data-option-key=${String(option.value)}>${this.renderOptionChip(handle, option)}</div>`,
      )}
    </div>`;
  }

  private renderOptionChip(
    handle: MdyFieldHandle<readonly unknown[]>,
    option: MdySelectOption<unknown>,
  ): unknown {
    if (this.mode === "multi") {
      const count = this.counts(handle).get(String(option.value)) ?? 0;
      return html`<div
        class=${multiselectChipClasses({ mode: "multi", selected: count > 0 }).join(" ")}
      >
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
    const selected = this.isSelected(handle, option.value);
    return html`<button
      type="button"
      class=${multiselectChipClasses({ mode: "single", selected }).join(" ")}
      ?disabled=${handle.disabled()}
      aria-pressed=${selected ? "true" : "false"}
      title=${option.label}
      @click=${() => this.pick(handle, option.value)}
    >
      ${mdyIcon("CHECKMARK", MDY_CHIP_CLASSES.check)}
      <span class=${MDY_CHIP_CLASSES.label}>${option.label}</span>
    </button>`;
  }
}
