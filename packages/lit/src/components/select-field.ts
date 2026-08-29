import { type MdyFieldHandle, type MdySelectOption } from "@modyra/core";
import { defaultOptionKey, fieldDescribedBy, filterOptionsByQuery, stepOutOfOverlay } from "@modyra/widgets";
import { html, nothing, type PropertyDeclarations, type PropertyValueMap } from "lit";
import { MdyFieldElement, mdyIcon } from "../base.js";
import {
  createTypeahead,
  isTypeaheadCharacter,
  optionsWithUnrecognizedValue,
  selectKeyboardAction, listboxNextIndex, focusWhenShown } from "@modyra/widgets";
import { MdyLitSelectAdapter } from "../widget-runtime/index.js";
import { MdyDropdownFieldElement } from "./dropdown-field.js";
import {
  MdyLitOverlayController,
  renderOverlayPanel,
} from "./popup-styles.js";

export class MdySelectFieldElement extends MdyDropdownFieldElement<unknown | null> {
  static override properties: PropertyDeclarations = {
    searchable: { type: Boolean },
    loading: { type: Boolean },
    allowCreate: { type: Boolean, attribute: "allow-create" },
  };
  declare searchable: boolean;
  /**
   * The typeahead, held per element rather than per keystroke.
   *
   * A buffer that is rebuilt each key is not a buffer: this is what accumulates `mar` from three
   * events, and what its idle timeout expires when the user stops.
   */
  private readonly typeahead = createTypeahead();
  declare loading: boolean;
  /** When true, searchable selects show a "Create …" row for unknown queries. */
  declare allowCreate: boolean;

  protected override readonly widgetKind = "select" as const;
  private selectAdapter?: MdyLitSelectAdapter<unknown>;
  private readonly overlay = new MdyLitOverlayController(this);

  constructor() {
    super();
    this.searchable = false;
    this.loading = false;
    this.allowCreate = false;
  }

  /** The same question the popup asks when it decides whether to draw the create row. */
  private createAvailable(): boolean {
    const handle = this.field;
    const query = this.selectAdapter?.state.query ?? "";
    if (!handle) return false;
    return this.showCreateOption(query, filterOptionsByQuery(this.renderedOptions(handle.value()), query));
  }

  private showCreateOption(
    query: string,
    filtered: ReadonlyArray<{ label: string }>,
  ): boolean {
    if (!this.allowCreate || !this.searchable) return false;
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return !filtered.some((o) => o.label.trim().toLowerCase() === q);
  }

  private onCreateOption(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    this.dispatchEvent(new CustomEvent("option-created", { detail: trimmed }));
    this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
  }

  /**
   * What this element renders: its options, plus the value the field holds when the list does not
   * contain it. The widget does not erase such a value to make itself consistent, so it has to be
   * visible — a control that looks empty while the form holds something tells the user nothing.
   */
  protected renderedOptions(value: unknown): ReadonlyArray<MdySelectOption<unknown>> {
    // The controller decides what is painted — it is the one place the rule lives, so a renderer
    // cannot forget it. Before it exists (connectedCallback has not run) the declared list plus the
    // held value is the same answer.
    // Asked of the value every time, not only of the list the adapter was built with. A value that
    // arrives *after* the mount — a draft, a server, a scripted write — is exactly the one no
    // option carries, and reading the adapter's list alone left the control presenting the first
    // option as the current choice while the form held something else.
    return optionsWithUnrecognizedValue(this.selectAdapter?.state?.options ?? this.options, value);
  }

  /**
   * The search box takes the keyboard when the list opens, because it is what the list is for.
   *
   * A document asking for search got the box drawn and never focused: the keys fell through to the
   * trigger, where the type-ahead answered them, so a value still came out and the filter never saw a
   * character. It looked like it worked — and a person watching the empty box while the list refused
   * to narrow had nothing to act on.
   *
   * Through `focusWhenShown` because the panel is portalled: the frame this runs in may be the one
   * before it is drawn, and a `focus()` there is a no-op that reports nothing.
   */
  protected override onOpened(): void {
    if (!this.searchable) return;
    focusWhenShown(() => this.querySelector(".mdy-select__search"), { still: () => this._open });
  }

  protected override get listOptions(): ReadonlyArray<MdySelectOption<unknown>> {
    return this.renderedOptions(this.field?.value());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const handle = this.field;
    if (!handle || this.selectAdapter) return;

    this.selectAdapter = new MdyLitSelectAdapter(
      this,
      {
        widgetId: this.fieldId,
        handle: handle as never,
        options: this.renderedOptions(handle.value()),
        loading: this.loading,
      },
      (part: string, key: string | undefined) => {
        const view = this.selectAdapter?.view;
        if (!view) return undefined;
        if (part === "trigger") {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts.trigger.id}`) ??
            undefined
          );
        }
        if (part === "options") {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts.options.id}`) ??
            undefined
          );
        }
        if (part === "option" && key !== undefined) {
          return (
            this.renderRoot.querySelector<HTMLElement>(`#${view.parts[key].id}`) ??
            undefined
          );
        }
        return undefined;
      },
    );

    this.selectAdapter.connectHandlers({
      setOpen: (open) => {
        this._open = open;
        if (open) {
          this.overlay.open();
          // The searchable shape opens through the adapter rather than through the base's lifecycle,
          // so the hook that hands the keyboard to the search box is called from here too.
          this.onOpened();
        } else {
          // Closing is not a validation event: the adapter reports a real touch through
          // `onTouched`, and a user who opened the list and dismissed it decided nothing.
          this.overlay.close();
        }
        this.requestUpdate();
      },
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  override disconnectedCallback(): void {
    this.overlay.close();
    this.selectAdapter?.destroy();
    this.selectAdapter = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);
    const handle = this.field;
    if (!this.selectAdapter || !handle) return;

    // What the form says, not a constant. This controller holds no handle, so `false` here made a
    // read-only select one that refuses every change and reports itself editable.
    this.selectAdapter.setReadonly(handle.readonly());

    this.selectAdapter.setLoading(this.loading);
    // Keep the local open flag in sync with the controller before rendering.
    this._open = this.selectAdapter.state.open;
  }

  private optionKey(value: unknown): string {
    return String(value);
  }

  protected override isSelected(handle: MdyFieldHandle<unknown | null>, value: unknown): boolean {
    return handle.value() === value;
  }

  protected override pick(_handle: MdyFieldHandle<unknown | null>, value: unknown): void {
    this.selectAdapter?.dispatch({ type: "select", optionKey: this.optionKey(value) });
  }

  protected override triggerText(handle: MdyFieldHandle<unknown | null>): string {
    return this.renderedOptions(handle.value()).find((o) => o.value === handle.value())?.label ?? "";
  }

  protected override toggleOpen(handle: MdyFieldHandle<unknown | null>): void {
    if (handle.disabled()) return;
    if (this._open) {
      this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
    } else {
      this.selectAdapter?.dispatch({ type: "open", source: "pointer" });
    }
  }

  protected override close(_handle: MdyFieldHandle<unknown | null>): void {
    if (!this._open) return;
    this.selectAdapter?.dispatch({ type: "close", restoreFocus: true });
  }

  /**
   * The select keyboard, answered by the contract rather than by a switch here.
   *
   * The local version differed in ways nobody chose: an arrow on a closed list moved an active
   * option no one could see instead of opening it, `Tab` left the list floating over a form the user
   * had already left, and a focused search field did not change what `Home` meant.
   */
  protected override onKeydown(e: KeyboardEvent, _handle: MdyFieldHandle<unknown | null>): void {
    const action = selectKeyboardAction({
      key: e,
      open: this._open,
      // Whether the *search field* has focus, not merely that the select can search: the opener
      // and the search box answer `Home` differently, which is the distinction the policy takes.
      searchFocused:
        this.querySelector(".mdy-select__search") === (this.ownerDocument?.activeElement ?? null),
      activeKey: this.selectAdapter?.state.activeKey ?? null,
      createAvailable: this.createAvailable(),
    });

    if (!action) return;
    // Tab is the way out and keeps the browser's meaning: focus moves to the trigger and the panel
    // closes after it, so the browser's own Tab carries on from a control that still exists. Closing
    // first left focus on an element being removed, and the browser put it on the body — from which
    // the next press starts over at the top of the document.
    if (e.key === "Tab") {
      stepOutOfOverlay(
        this.querySelector<HTMLElement>(".mdy-select__trigger"),
        () => { this.overlay.close(); this.selectAdapter?.dispatch({ type: "close", restoreFocus: false }); },
      );
      return;
    }
    {
      e.preventDefault();
      switch (action.type) {
        case "open":
          this.overlay.open();
          this.selectAdapter?.dispatch({ type: "open", source: "keyboard" });
          return;
        case "close":
          this.selectAdapter?.dispatch({ type: "close", restoreFocus: action.restoreFocus });
          return;
        case "move":
          this.selectAdapter?.dispatch({ type: "move", target: action.target });
          // The cursor lives in the adapter, which is not one of this element's reactive properties,
          // so moving it changes nothing on the page: the class that lights the option under it and
          // the attribute that names that option are both products of a render, and only opening and
          // typing asked for one. What reads the cursor live — the key that commits — kept working,
          // so the value arrived while both reports stood on the first option: a person watching saw
          // the same row lit at every press, and a person listening was told the same option while
          // the selection travelled past the others.
          //
          // Here and not after every dispatch: the intents that open and close already repaint
          // through `setOpen`, and repainting under them a second time re-enters the overlay's
          // lifecycle — measured, five of the select's own checks go red.
          this.requestUpdate();
          return;
        case "select":
          this.selectAdapter?.dispatch({ type: "select", optionKey: action.optionKey });
          return;
        case "create":
          this.onCreateOption(this.selectAdapter?.state.query ?? "");
          return;
      }
    }

    switch (e.key) {
      default:
        // Only the combobox reaches here: a select that does not filter renders the native chooser,
        // which brings the platform's own typeahead and never builds this keyboard path.
        if (!isTypeaheadCharacter(e.key, e)) break;
        // The query is the whole buffer rather than the last key. The controller *replaces* what it
        // is given, so dispatching one character searched for one character and a typeahead could
        // never match a word — typing `mar` searched `m`, then `a`, then `r`.
        this.selectAdapter?.dispatch({ type: "search", query: this.typeahead.push(e.key) });
        break;
    }
  }

  private onSearchInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.selectAdapter?.dispatch({ type: "search", query: value });
    // The query lives in the adapter, which is not one of this element's reactive properties: only
    // `setOpen` asked for a repaint, so the box held what was typed while the list under it kept
    // showing everything. A filter nobody can see is a filter nobody has.
    this.requestUpdate();
  }

  /**
   * The native chooser, for a select that is not searchable.
   *
   * A custom combobox with no search field gives a keyboard user arrows and nothing else: no way to
   * type towards an option, which the authoring practices call typeahead and which a list of fifty
   * options needs. Building an incremental-search buffer is one answer; using the control that
   * already has one — along with the platform's keyboard model and the mobile picker — is the other,
   * and it is what the framework adapter with the same choice already does.
   *
   * `searchable` is the switch, and it defaults to false, so this is also the default path.
   */
  protected override renderControl(handle: MdyFieldHandle<unknown | null>): unknown {
    const options = this.renderedOptions(handle.value());
    const held = handle.value();
    // Nothing chosen is a state a native chooser can only show by having an entry for it. Without
    // one, index 0 is a real option: the control read "A" while the form held `null` — a field that
    // looks answered and is not — and the first step of a keyboard landed on the option the control
    // was already showing, so the platform's own keyboard model changed nothing.
    //
    // Disabled, so it cannot be chosen back into; it leaves as soon as something is.
    const empty = held === null || held === undefined || held === "";
    // Kept while it is the state, or while a placeholder gives it words. Once something is chosen and
    // there is nothing to say about the absence, the entry goes: a list that keeps offering "nothing"
    // after a choice is a list with a row nobody can use.
    const offersEmpty = empty || this.placeholder !== "";
    return html`<select
      id=${this.fieldId}
      class="mdy-select__trigger"
      ?disabled=${handle.disabled()}
      aria-invalid=${this.showErrors(handle) ? "true" : "false"}
      aria-readonly=${handle.readonly() ? "true" : nothing}
      aria-required=${String(handle.required())}
      aria-describedby=${fieldDescribedBy({
        errorId: this.errorsId, descriptionId: this.descriptionId,
        errorsPresent: this.showErrors(handle) || this.errorsReserved(handle),
        descriptionPresent: true,
      }) ?? nothing}
      @change=${(event: Event) => {
        // Matched by what the element reports rather than by where it sits: the entry for "nothing
        // chosen" comes and goes with the state, so an index into this closure's list is an index
        // into a list that may have moved under it.
        //
        // And by the contract's key, not `String()`. An `<option>`'s value is a string, so an
        // object-valued list wrote `[object Object]` on every one of them: the browser could not
        // tell them apart, and this lookup answered with whichever came first. Choosing the second
        // choice put the first in the model — the person's own selection, silently replaced.
        const picked = (event.target as HTMLSelectElement).value;
        const option = options.find((each) => defaultOptionKey(each.value) === picked);
        if (!option) return;
        handle.set(option.value);
        handle.markAsDirty();
        handle.markAsTouched();
      }}
      @keydown=${(event: KeyboardEvent) => this.stepNative(event, handle, options)}
      @blur=${() => { handle.markAsTouched(); this.requestUpdate(); }}
    >
      ${offersEmpty
        ? html`<option
            class="${this.partClass("placeholder")}"
            value=""
            disabled
            ?selected=${empty}
          >${this.placeholder || " "}</option>`
        : nothing}
      ${options.map((option) => html`<option
        .value=${defaultOptionKey(option.value)}
        ?disabled=${option.disabled === true}
        ?selected=${this.isChosen(held, option.value)}
      >${option.label}</option>`)}
    </select>
    <!-- The foundation takes the platform's own arrow off every native chooser so that a form of
         them looks like one form, and a kind that removes an affordance owes one back. This shape
         drew neither: the field had nothing at its trailing edge saying it opens, while the four
         other kinds in this renderer draw theirs. -->
    ${mdyIcon("CHEVRON_DOWN", "mdy-select__arrow")}`;
  }

  /**
   * The arrows on the native chooser, answered here as well as by the platform.
   *
   * The reason this shape exists is the control that already has a keyboard model — and where the
   * platform's own list is drawn outside the document, as it is on a picker the page cannot see,
   * that model produces no event and the value never moves. The contract's policy is what answers
   * then, because it is the only description of the move that does not depend on the platform
   * having drawn the list where the page can reach it.
   *
   * Deliberately without `preventDefault`: where the platform *does* answer, it answers first and
   * lands on the same option this does, and setting one value twice changes nothing. Suppressing it
   * would take away the model this shape was chosen for.
   */
  private stepNative(
    event: KeyboardEvent,
    handle: MdyFieldHandle<unknown | null>,
    options: ReadonlyArray<MdySelectOption<unknown>>,
  ): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (options.length === 0 || handle.disabled() || handle.readonly()) return;
    const at = options.findIndex((option) => option.value === handle.value());
    const to = listboxNextIndex(event.key, at, options.length);
    if (to === null) return;
    const option = options[to];
    if (!option || option.disabled === true) return;
    handle.set(option.value);
    handle.markAsDirty();
    handle.markAsTouched();
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle || !this.selectAdapter) return super.render();
    // Not searchable: the base shell wraps `renderControl`, which is the native chooser above. None
    // of the overlay machinery below is reachable in that mode, and none of it should run.
    if (!this.searchable) return MdyFieldElement.prototype.render.call(this);
    // Which description is on screen is this element's decision — it renders one or the other — so
    // it has to tell the projection before reading the trigger back out of it. `aria-describedby`
    // must name an element that exists.
    const blockErrors = !this.inlineErrors && this.showErrors(handle);
    // Both, not one or the other. The container is named while it is on the page — which is under any
    // field that can fail a rule, not only while it holds a message — and the help is named whenever
    // this element drew it. An error does not take the place of the instruction that prevents it.
    this.selectAdapter.setDescribedBy({
      errorsVisible: !this.inlineErrors && (blockErrors || this.errorsReserved(handle)),
      descriptionVisible: this.hasDescription(),
    });
    // The same rule for the other reference the trigger carries: this element builds its listbox on
    // open, so while closed there is nothing for `aria-controls` to name.
    this.selectAdapter.setPopupRendered(this._open);
    const state = this.selectAdapter.state;
    const view = this.selectAdapter.view;
    const trigger = view.parts.trigger;
    const listbox = view.parts.options;
    const text = this.triggerText(handle);
    const filtered = filterOptionsByQuery(this.renderedOptions(handle.value()), state.query);
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);

    this.syncStateClasses(handle);
    this.classList.toggle("mdy-renderer--open", this._open);

    const position = this.overlay.state.position;
    const alignment = this.overlay.state.alignment;

    const dropdown = html`
      <div
        class="${this.popupClass(position, alignment)} mdy-overlay mdy-glass-effect"
      >
        ${this.searchable
        ? html`<input
              type="text"
              class="mdy-select__search"
              aria-label=${this.nameOfPart("select.search")}
              .value=${state.query}
              @input=${this.onSearchInput}
              @keydown=${(event: KeyboardEvent) => this.onKeydown(event, handle)}
            />`
        : nothing}
        <ul
          class="mdy-select__list"
          id=${listbox.id}
          role="listbox"
          aria-labelledby=${trigger.id}
        >
          ${filtered.map((option) => {
          const key = this.optionKey(option.value);
          const part = view.parts[key];
          const selected = state.selectedKey === key;
          const active = state.activeKey === key;
          return html`<li
              class="mdy-select__option ${selected ? "mdy-select__option--selected" : ""} ${active
              ? "mdy-select__option--active"
              : ""}"
              id=${part.id}
              role="option"
              aria-selected=${selected ? "true" : "false"}
              aria-disabled=${option.disabled ? "true" : nothing}
              @pointerdown=${(e: Event) => e.preventDefault()}
              @click=${() => {
              if (!option.disabled) this.pick(handle, option.value);
            }}
            >
              <span class="mdy-select__option-label">${option.label}</span>
            </li>`;
        })}
          ${this.showCreateOption(state.query, filtered)
        ? html`<li
                class="mdy-select__option mdy-select__option--create"
                role="option"
                @click=${() => this.onCreateOption(state.query)}
              >
                Create “${state.query.trim()}”
              </li>`
        : nothing}
          ${filtered.length === 0 && !this.showCreateOption(state.query, filtered)
        ? html`<li class="mdy-select__no-results" role="presentation">
                ${state.loading
            ? html`<div class="mdy-select__loading-content">
                      ${mdyIcon("LOADER", "mdy-select__loader")}
                      <span>Loading…</span>
                    </div>`
            : html`${this.messages.noResults}`}
              </li>`
        : nothing}
        </ul>
      </div>
    `;

    return html`
      ${this.renderLabel(handle, trigger.id)}
      <div class="mdy-select">
        <div class="${this.wrapperClass(handle)}">
          <div class="mdy-input-prefix"><slot name="prefix"></slot></div>
          <button
            type="button"
            class="mdy-select__trigger ${trigger.classes.slice(1).join(" ")}"
            id=${trigger.id}
            aria-haspopup=${trigger.attributes["aria-haspopup"]}
            aria-expanded=${trigger.attributes["aria-expanded"] === "true" ? "true" : "false"}
            role=${trigger.role ?? nothing}
            aria-controls=${trigger.attributes["aria-controls"]}
            aria-describedby=${trigger.attributes["aria-describedby"] ?? nothing}
            aria-activedescendant=${trigger.attributes["aria-activedescendant"] ?? nothing}
            aria-disabled=${trigger.attributes["aria-disabled"] === "true" ? "true" : nothing}
            aria-readonly=${handle.readonly() ? "true" : nothing}
            aria-invalid=${this.showErrors(handle) ? "true" : "false"}
            aria-required=${handle.required() ? "true" : "false"}
            aria-label=${this.label || nothing}
            ?disabled=${handle.disabled()}
            @click=${(e: Event) => {
        if (!this._open) this.overlay.open(e);
        this.toggleOpen(handle);
      }}
            @keydown=${(e: KeyboardEvent) => this.onKeydown(e, handle)}
          >
            ${text
        ? html`<span class="mdy-select__value">${text}</span>`
        : html`<span class="mdy-select__placeholder">${this.placeholder || "\u00A0"}</span>`}
          </button>
          <div class="mdy-input-suffix">
            ${state.loading
        ? mdyIcon("LOADER", "mdy-select__loader")
        : mdyIcon("CHEVRON_DOWN", `mdy-select__arrow ${this._open ? "mdy-select__arrow--open" : ""}`)}
            <slot name="suffix"></slot>
          </div>
        </div>
        ${renderOverlayPanel(dropdown, this._open, {
          modal: position === "overlay",
          alignment,
          position,
          panelDisplayContents: true,
        })}
      </div>
      ${this.renderSupportingText()}
      ${showBlockErrors || this.errorsReserved(handle) ? this.renderErrors(handle) : nothing}
    `;
  }
}

