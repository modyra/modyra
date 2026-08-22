import { MdyFieldHandle, type MdyFieldConstraints, type MdyValueKind } from "@modyra/core";
import { MDY_ICONS, MDY_POPUP_OPENERS, messagesForLocale, type MdyI18nMessages } from "@modyra/widgets";
import { html, LitElement, nothing, PropertyDeclarations } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import {
  MDY_FIELD_SHELL_CLASSES as SHELL,
  MDY_FIELD_STATE_CLASSES,
  MDY_WIDGET_CONTRACTS,
  defaultWidgetIdFactory as ID,
  popupAlignmentClass,
  popupPlacementClass,
  projectFieldShellA11y,
  fieldAccessibleName,
  errorsVisible,
  reportIdCollision,
  holdsUneditedValue,
  shownErrorsOf,
  type MdyOverlayAlignment,
  type MdyOverlayPlacement,
  type MdyPartContract,
  type MdyPopupWidgetKind,
  type MdyWidgetKind,
} from "@modyra/widgets";
import { MdyFormController } from "./adapter.js";
import { narrowConstraints } from "@modyra/widgets";

/**
 * The build-time development flag, read the way the engine's is: production bundles define
 * `__MDY_DEV__ = false` and the warning below — its message string included — is dropped.
 *
 * Declared here because an element with no field has no form behind it either, so the form's
 * `devWarnings` switch is not reachable from where this is said.
 */
declare const __MDY_DEV__: boolean | undefined;
const MDY_DEV: boolean = typeof __MDY_DEV__ === "undefined" || __MDY_DEV__;


/** Renders an icon from the shared library (same SVGs as every adapter). */
export function mdyIcon(name: keyof typeof MDY_ICONS, className: string): unknown {
  const icon = MDY_ICONS[name];
  return html`<svg
    class=${className}
    viewBox=${icon.viewBox}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style="display:inline-flex;flex-shrink:0;width:1.25em;height:1.25em"
  >${unsafeSVG(icon.content)}</svg>`;
}

let nextId = 0;

/**
 * Shared scaffolding for every Modyra Lit control: renders in light DOM
 * with the documented theme class structure (`mdy-renderer`,
 * `mdy-input-wrapper`, `mdy-label`, `mdy-control__errors`), tracks the
 * bound field handle through a `MdyFormController`, and wires label,
 * required marker, error list and the aria attributes.
 *
 * Subclasses implement {@link renderControl} (the widget inside the
 * wrapper) and declare their `rendererClass` modifier.
 */
export abstract class MdyFieldElement<T> extends LitElement {
  static properties: PropertyDeclarations = {
    field: { attribute: false },
    label: { type: String },
    supportingText: { type: String, attribute: "supporting-text" },
    inlineErrors: { type: Boolean, attribute: "inline-errors" },
    floatingLabel: { type: Boolean, attribute: "floating-label" },
    locale: { type: String },
    idScope: { type: String, attribute: "id-scope" },
  };

  declare field: MdyFieldHandle<T> | undefined;
  declare label: string;
  /** The line under the control: a format, a limit, why the field is there. */
  declare supportingText: string | undefined;
  declare inlineErrors: boolean;
  declare floatingLabel: boolean;
  /**
   * The language this control speaks. Unset it follows the page, which is what a control owes a
   * reader who never chose one.
   */
  declare locale: string | undefined;

  /**
   * The words this control shows, for the locale it was given.
   *
   * From the widget contract's tables, never spelled here: the same button was written three ways
   * across three renderers while each of them owned its own English.
   *
   * Public, because things that speak *for* the element read it — an overlay controller saying that
   * a popup has opened is the element's sentence, in the element's language, and a second copy
   * resolved elsewhere is how two parts of one control come to speak different languages.
   */
  get messages(): MdyI18nMessages {
    return messagesForLocale(this.resolvedLocale);
  }

  /** The host's choice if it made one, the page's otherwise. */
  protected get resolvedLocale(): string {
    return this.locale ?? (typeof navigator === "undefined" ? "en-US" : navigator.language);
  }

  /**
   * The id every part of this widget is built from.
   *
   * Derived from the field's own path (ADR 0135), so the same document renders the same ids every
   * time: a consumer can write `aria-describedby="when__label"` in their own markup, a stylesheet or
   * a test can name one, and server-rendered markup agrees with a client mount. A mount counter is a
   * property of what else was on the page first, and made every one of those a guess.
   *
   * Two fields called `when` on one page collide, visibly, and that is the better failure: two
   * counters never collide and never mean anything either. `idScope` is what a host with two forms
   * uses to keep them apart.
   *
   * The counter survives for a widget bound to **no** field — a documented shape in this package,
   * with nothing to derive an id from. Its ids are not stable across mounts, because nothing about
   * such a widget is.
   */
  protected get fieldId(): string {
    const path = this.field?.path;
    if (path === undefined || path === "") return this._mountId;
    // A single character neither part may contain: the joiner's first occurrence always ends the
    // scope, so two distinct scopes cannot produce one id.
    return this.idScope ? `${this.idScope}-${path}` : path;
  }

  /**
   * Which form on the page this widget belongs to, where a host renders more than one.
   *
   * Unset is the ordinary case. Set, it scopes every id this widget publishes, so two forms built
   * from the same document do not both claim `when__label`.
   */
  declare idScope?: string;

  private readonly _mountId = `mdy-field-${nextId++}`;
  private _tracker: MdyFormController | null = null;

  /** The widget kind this element renders. Its classes come from the catalog, never from here. */
  protected abstract readonly widgetKind: MdyWidgetKind;

  /**
   * What this element asks for on top of the field's rules — nothing, unless a subclass has its own
   * limits to state. It cannot ask for more than the rules allow; the projection takes whichever is
   * tighter.
   */
  protected narrowedConstraints(): Partial<MdyFieldConstraints> {
    return {};
  }

  /** Root classes for this kind, straight from the catalog. */
  protected get rootClasses(): readonly string[] {
    return MDY_WIDGET_CONTRACTS[this.widgetKind].rootClasses;
  }

  /**
   * What this widget's opener promises will appear, as `aria-haspopup` states it.
   *
   * Read from the catalogue rather than written here. A screen reader announces the promise with the
   * control — "combobox, has popup listbox" — so a person acts on it before anything has opened, and
   * the words are not interchangeable: a listbox is options with a selected state, a grid is walked
   * with the arrow keys, a dialog is somewhere to go and come back from. Written as a literal at each
   * opener, one renderer promised a dialog where another promised a grid over the same widget.
   *
   * `nothing` for a kind with no overlay, so an element that has no popup makes no promise.
   */
  protected get popupPromise(): string | typeof nothing {
    return MDY_POPUP_OPENERS[this.widgetKind]?.promises ?? nothing;
  }

  /** Class list for one of this widget's contract parts. Adapters must not invent equivalents. */
  protected partClass(part: string): string {
    const parts = MDY_WIDGET_CONTRACTS[this.widgetKind].parts as Readonly<Record<string, { classes: readonly string[] }>>;
    return (parts[part]?.classes ?? []).join(" ");
  }

  /**
   * The role the catalogue declares for one of this widget's parts, or `nothing`.
   *
   * A part that carries a role is a statement about the DOM rather than about styling — a dialog is
   * somewhere to go and come back from, and an element that builds the part without it has built a
   * `<div>`. Read here so an element cannot answer with a different word than the contract, or with
   * none.
   */
  protected partRole(part: string): string | typeof nothing {
    const parts = MDY_WIDGET_CONTRACTS[this.widgetKind].parts as Readonly<Record<string, { role?: string }>>;
    return parts[part]?.role ?? nothing;
  }

  /**
   * The input wrapper's classes, with the states the shell declares for it.
   *
   * `MDY_FIELD_STATE_CLASSES.controlStates` names them — `disabled` and `error` — and a state named
   * there that nothing writes is a state a theme can style and no field ever wears. Composed here
   * rather than at each control, because seven of them were composing it and every one of them wrote
   * only half.
   *
   * `error` answers the same question the label answers, so the two faces of one verdict cannot
   * disagree inside one control.
   */
  protected wrapperClass(handle: MdyFieldHandle<T>): string {
    const on: Readonly<Record<string, boolean>> = {
      disabled: handle.disabled(),
      error: this.showErrors(handle),
    };
    return [
      MDY_FIELD_STATE_CLASSES.control,
      ...MDY_FIELD_STATE_CLASSES.controlStates
        .filter((state) => on[state] === true)
        .map((state) => `${MDY_FIELD_STATE_CLASSES.control}--${state}`),
    ].join(" ");
  }

  /**
   * The popup part's classes, with the state that says which side it ended up on.
   *
   * The placement cannot live on the overlay wrapper: that is a marker with `display: contents` and
   * no geometry, so `mdy-overlay-panel--above` styled nothing however it was spelled. It belongs
   * here, on the popup itself, under the name the catalog gives it — the same class Plain writes and
   * a host-projected panel does.
   */
  protected popupClass(placement: MdyOverlayPlacement, alignment?: MdyOverlayAlignment): string {
    const kind = this.widgetKind as MdyPopupWidgetKind;
    const states = [
      popupPlacementClass(kind, placement),
      alignment ? popupAlignmentClass(kind, alignment) : null,
    ].filter((name): name is string => name !== null);
    return [this.partClass("popup"), ...states].join(" ");
  }

  constructor() {
    super();
    this.label = "";
    this.inlineErrors = false;
    this.floatingLabel = false;
  }

  /** Light DOM so the global theme stylesheets reach the markup. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /**
   * After the render commits, because that is when the control exists to be named.
   *
   * The host carries `aria-label` as an attribute — that is what an author writes — and it would
   * name the *element* rather than the control inside it, which is not what a screen reader reads.
   */
  protected override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    this.applyControlName();
    // Once per element: two forms over one document claim one set of ids, and a sentence repeated
    // every frame is one a developer scrolls past.
    // Checked on every update and said once per id: this element may paint before the form it
    // collides with is on the page at all, and a latch spent on the first frame is a guard that
    // never sees the second one.
    if (MDY_DEV) {
      let message: string | null = null;
      const shared = reportIdCollision(
        this,
        "Set `id-scope` on the controls of each form.",
        (said) => { message = said; },
      );
      const fresh = shared.filter((id) => !this._saidCollision.has(id));
      if (fresh.length > 0 && message !== null) {
        console.warn(message);
        for (const id of fresh) this._saidCollision.add(id);
      }
    }
  }

  /** The ids this element has already reported a collision on. A sentence repeated every frame is
   *  one a developer scrolls past. */
  private readonly _saidCollision = new Set<string>();

  /** Said once per element: a sentence repeated every frame is one a developer scrolls past. */
  private _saidUnbound = false;
  private _unboundFrame: number | null = null;

  /**
   * An element that painted with nothing to paint from says so.
   *
   * Binding after appending is legitimate and is what a host writes — create the element, append it,
   * assign `.field` — so the question is asked a frame after the first paint rather than on
   * connection. A warning rather than a refusal, for the same reason: throwing would reject that
   * order. What is left otherwise is an empty custom element, which reads as a gap in the layout and
   * gives nobody a word to search for.
   */
  private reportIfUnbound(): void {
    if (this._saidUnbound || this._unboundFrame !== null) return;
    if (typeof requestAnimationFrame !== "function") return;
    // Three frames, because a host that appends and binds on the next one is doing nothing wrong and
    // must not be told it is. Any deadline is a choice; this one leaves the whole create-append-bind
    // order silent, its frame boundary included, and still speaks long before a developer starts
    // looking for the element that is missing from the page.
    let frames = 3;
    const look = (): void => {
      if (frames > 0) {
        frames -= 1;
        this._unboundFrame = requestAnimationFrame(look);
        return;
      }
      this._unboundFrame = null;
      if (this.field !== undefined || !this.isConnected) return;
      this._saidUnbound = true;
      const named = this.label ? ` labelled "${this.label}"` : "";
      console.warn(
        `[modyra] <${this.localName}>${named} rendered nothing: no field was bound to it. ` +
        `A Modyra element paints from the handle on its \`field\` property — ` +
        `element.field = form.f.<name>.`,
      );
    };
    this._unboundFrame = requestAnimationFrame(look);
  }

  override disconnectedCallback(): void {
    if (this._unboundFrame !== null) {
      cancelAnimationFrame(this._unboundFrame);
      this._unboundFrame = null;
    }
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add(...this.rootClasses);
    if (MDY_DEV) this.reportIfUnbound();
    const handle = this.field;
    if (handle && !this._tracker) {
      // Every signal a subclass may read while rendering. A signal left off this list does not
      // produce a missing attribute — it produces an inert binding, rendered once and never
      // updated when that signal changes.
      this._tracker = new MdyFormController(this, [
        handle.value,
        handle.errors,
        handle.touched,
        handle.required,
        handle.disabled,
        handle.readonly,
      ]);
      this._tracker.hostConnected();
    }
  }

  /** The control widget rendered inside `.mdy-input-wrapper`. */
  protected abstract renderControl(handle: MdyFieldHandle<T>): unknown;

  /** Whether the wrapper div should be rendered (radio groups skip it). */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style -- subclasses override this accessor
  protected get useWrapper(): boolean {
    return true;
  }

  /** Id the label points to. Override when the rendered input id differs (daterange). */
  protected get labelForId(): string {
    return this.fieldId;
  }

  protected get errorsId(): string {
    return ID.part(this.fieldId, "errors");
  }

  /**
   * What this control has to say that the form does not hold.
   *
   * A date or time entry the control could not read is the case: the form holds nothing, so it has
   * no error to give, and a control keeping the text without saying anything leaves the person
   * looking at their own writing believing it was taken.
   */
  protected controlErrors(): readonly string[] {
    return [];
  }

  /**
   * Whether the error text is on screen — `errorsVisible`, asked rather than restated.
   *
   * The rule about *when* a verdict is readable is one every renderer of this contract answers the
   * same way, so it is read from the one place that holds it. What belongs here is the exception
   * beside it: an entry this control could not read is its own verdict, held by no rule the form
   * ran, and there is nothing for the form to have been touched about.
   */
  protected showErrors(handle: MdyFieldHandle<T>): boolean {
    if (this.controlErrors().length > 0) return true;
    return errorsVisible({
      disabled: handle.disabled(),
      touched: handle.touched(),
      // A value that arrived with the form and has not been edited since: a refusal about it is
      // about something already there, which nobody at this page can have caused by inaction.
      holdsUnedited: holdsUneditedValue(
        { value: handle.value(), dirty: handle.dirty() },
        this.widgetKind as MdyValueKind,
      ),
    }, handle.errors());
  }

  /** Whether the field currently holds a value (drives label styling). */
  protected isFilled(handle: MdyFieldHandle<T>): boolean {
    const v = handle.value();
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }

  /** Error text joined for inline display. */
  protected inlineErrorText(handle: MdyFieldHandle<T>): string {
    return [...this.controlErrors(), ...shownErrorsOf(handle).map((e) => e.message)]
      .filter((msg) => !!msg && msg.trim() !== "")
      .join(", ");
  }

  /** Inline error icon + tooltip rendered inside the label. */
  protected renderInlineErrorIcon(handle: MdyFieldHandle<T>): unknown {
    const text = this.inlineErrorText(handle);
    return html`<span
      class="mdy-control__inline-errors"
      role="img"
      aria-label=${text}
    >
      ${mdyIcon("ERROR", "mdy-control__inline-errors-icon")}
      <span class="mdy-control__inline-errors-tooltip">${text}</span>
    </span>`;
  }

  /**
   * Shared label block, matching the contract's label anatomy component.
   * - `labelId` is used for group renderers (radio, segmented); when set, no
   *   `for` attribute is emitted and the radiogroup references it via
   *   `aria-labelledby`.
   * - Renders nothing when the label is empty, as the contract's shell side.
   */
  protected renderLabel(
    handle: MdyFieldHandle<T>,
    forId = this.labelForId,
    labelId = "",
  ): unknown {
    if (!this.label) return nothing;
    const filled = this.isFilled(handle);
    const hasError = this.showErrors(handle);
    // The label always carries the id the projections name it by. A popup's inner view is labelled by
    // the field's label — `aria-labelledby="<widget>__label"` — and a label with no id left every one
    // of those references pointing at nothing the moment a person opened the view that uses it.
    return html`<label
      class="${SHELL.label} ${filled ? `${SHELL.label}--filled` : ""} ${hasError ? `${SHELL.label}--has-error` : ""}"
      id=${labelId || `${this.fieldId}__label`}
      for=${labelId ? nothing : forId}
    >
      ${this.label}
      ${handle.required()
        ? html`<span
          class="${SHELL.requiredMarker} ${filled ? `${SHELL.requiredMarker}--filled` : ""}"
          aria-hidden="true"
        >*</span>`
        : nothing}
      ${this.inlineErrors && hasError ? this.renderInlineErrorIcon(handle) : nothing}
    </label>`;
  }

  /**
   * Prefix and suffix are optional contract parts: rendered only when the host actually projects
   * something into them. An always-present empty box is padding with no content in it.
   */
  protected renderAffix(slot: "prefix" | "suffix"): unknown {
    if (!this.querySelector(`[slot="${slot}"]`)) return nothing;
    const className = slot === "prefix" ? SHELL.prefix : SHELL.suffix;
    return html`<div class="${className}"><slot name="${slot}"></slot></div>`;
  }

  /**
   * The semantic state of this control, as the shared contract projects it.
   *
   * An element binding `${mdyPart(this.controlPart(handle))}` receives `aria-invalid`,
   * `aria-required`, `aria-disabled` and `aria-describedby` from the projection, so no element
   * decides for itself which of a widget's states to expose.
   *
   * The visibility flags are answered here because the projection cannot know them: these elements
   * render the error list only once the field is touched, and supporting text only when a host
   * slots some in.
   */
  protected controlPart(handle: MdyFieldHandle<T>): MdyPartContract {
    return projectFieldShellA11y(
      { disabled: handle.disabled(), required: handle.required(), readonly: handle.readonly() },
      shownErrorsOf(handle),
      {
        widgetId: this.fieldId,
        kind: this.widgetKind,
        // The field's rules, narrowed by whatever this element asks for. One place composes them,
        // and the part carries the result — so no element names an attribute.
        constraints: narrowConstraints(handle.constraints(), this.narrowedConstraints()),
        // A slider's track has to span what the field holds — the one attribute that depends on the
        // value rather than on the rules.
        value: typeof handle.value() === "number" ? (handle.value() as number) : null,
        errorsVisible: this.showErrors(handle),
        descriptionVisible: true,
      },
    ).control;
  }

  /**
   * Names the control when no visible label does.
   *
   * The explicit name comes from the element's own `aria-label` and moves to the control, because a
   * name belongs to the thing a user operates. Without one the visible label's text is used — the
   * label element also holds the required marker, so a name read from its content would carry an
   * asterisk the user's word does not.
   */
  protected applyControlName(): void {
    const named = this._pendingName ?? this.getAttribute("aria-label");
    if (named !== null) {
      // Held here rather than on the host: an element that keeps its own name is a second named
      // thing where the user sees one.
      this._pendingName = named;
      this.removeAttribute("aria-label");
    }
    const control = this.querySelector<HTMLElement>(
      "input, select, textarea, [role='combobox'], [role='listbox']",
    );
    if (!control) return;
    // A label is optional in a document by design, and a control with no accessible name is
    // announced as its role and nothing else. `fieldAccessibleName` holds the order so this renderer
    // and the next answer the same; the field's own name is the last thing left to say.
    const name = fieldAccessibleName({
      ariaLabel: this._pendingName,
      label: this.label,
      name: this.field?.path,
    });
    if (name) control.setAttribute("aria-label", name);
    else control.removeAttribute("aria-label");
  }

  /** The name given through the host's `aria-label`, kept once the attribute is taken off it. */
  private _pendingName: string | null = null;

  /** Id the controllers point `aria-describedby` at when the field has no errors. */
  protected get descriptionId(): string {
    return ID.part(this.fieldId, "description");
  }

  /** Helper text slot rendered when no block errors are shown. It carries the id the widget
   * contract describes the control by — an unrendered id would leave that reference dangling. */
  /** What this kind says about itself in its own description. Empty unless a kind has something. */
  protected describedState(): string {
    return "";
  }

  protected renderSupportingText(): unknown {
    // No height when there is nothing to say, and still present: `aria-describedby` names this id
    // unconditionally, so removing the element leaves the reference pointing at nothing — which is
    // the defect one step worse than an empty description.
    // A kind may add a sentence of its own — the multiselect states how many are chosen, which is
    // one of the conditions ADR 0127 lets its scrolling row exist under.
    const own = this.describedState();
    const empty = !this.supportingText && !own && !this.querySelector('[slot="supporting-text"]');
    return html`<div
      class="${SHELL.supportingText}"
      id=${this.descriptionId}
      ?hidden=${empty}
    >${[this.supportingText, own].filter(Boolean).join(". ")}<slot name="supporting-text"></slot></div>`;
  }

  /** Error list block (rendered only once the field was touched). */
  protected renderErrors(handle: MdyFieldHandle<T>): unknown {
    if (!this.showErrors(handle)) return nothing;
    return html`<ul
      class="${SHELL.errors}"
      id=${this.errorsId}
      aria-live="polite"
    >
      ${[...this.controlErrors(), ...shownErrorsOf(handle).map((er) => er.message)].map(
        (message) => html`<li class="${SHELL.errorItem}">${message}</li>`,
      )}
    </ul>`;
  }

  /**
   * Single-source host state classes, the contract's own state bindings.
   * Subclasses with extra host modifiers (e.g. `--open`) call this and then
   * toggle their own class.
   */
  protected syncStateClasses(handle: MdyFieldHandle<T>): void {
    this.classList.toggle("mdy-renderer--touched", handle.touched());
    this.classList.toggle("mdy-floating-label", this.floatingLabel);
    this.classList.toggle("mdy-inline-errors", this.inlineErrors);
  }

  override render(): unknown {
    const handle = this.field;
    if (!handle) return nothing;
    this.syncStateClasses(handle);
    const control = this.renderControl(handle);
    const showBlockErrors = !this.inlineErrors && this.showErrors(handle);
    return html`
      ${this.renderLabel(handle)}
      ${this.useWrapper
        ? html`<div
          class="${this.wrapperClass(handle)}"
        >
          ${this.renderAffix("prefix")}
          ${control}
          ${this.renderAffix("suffix")}
        </div>`
        : control}
      ${showBlockErrors ? this.renderErrors(handle) : nothing}
      ${this.renderSupportingText()}
    `;
  }
}

