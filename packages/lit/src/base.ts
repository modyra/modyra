import {
  handleFormOf, MdyFieldHandle, type MdyFieldConstraints, type MdyValueKind } from "@modyra/core";
import { MDY_ICONS, MDY_PART_NAMES, MDY_POPUP_OPENERS, idSafeKey, stateClass, type MdyStateName, adoptSilentWrites, applySubmissionNames, bindFormReset, groupSubmitName, submissionFor, syncSubmitValues, defaultOptionKey, messagesForLocale, widgetScopeOf, type MdyI18nMessages,
  shellStateClasses,
} from "@modyra/widgets";
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
  fieldNameAttributes,
  errorsVisible,
  focusIsInsideField,
  keepKeyboardInPlay,
  reportIdCollision,
  holdsUneditedValue,
  fieldCanBeInvalid,
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
/**
 * The class names a state answer turned on.
 *
 * The shared answer names every class, on or off, because a renderer toggling them needs to know what
 * to take away as much as what to add. A template that builds a `class` attribute from scratch has
 * already taken everything away, so it wants only the half that is on.
 */
function onlyOn(named: Readonly<Record<string, boolean>>): readonly string[] {
  return Object.entries(named).filter(([, isOn]) => isOn).map(([name]) => name);
}

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
  /**
   * Whether a held value is this option's, asked the way the contract asks it.
   *
   * Identity first, then the key: a draft, a refetch or an import hands the field a fresh object that
   * *is* an option's value without *being* it, and asked only the exact question no option admitted
   * to the value the model holds. Asked through `String()` instead — which was the other half of the
   * same defect — every plain object matched every other, and a single-choice group marked all of
   * them.
   */
  protected isChosen(held: unknown, optionValue: unknown): boolean {
    if (held === optionValue) return true;
    if (held === null || held === undefined || optionValue === null || optionValue === undefined) {
      return false;
    }
    return defaultOptionKey(held) === defaultOptionKey(optionValue);
  }

  protected get fieldId(): string {
    const path = this.field?.path;
    if (path === undefined || path === "") return this._mountId;
    // A single character neither part may contain: the joiner's first occurrence always ends the
    // scope, so two distinct scopes cannot produce one id.
    // The form this handle belongs to, when the element was not told a scope: two forms built from
    // one document would otherwise both claim `when__label`, and a reference from the second
    // resolves into the first. ADR 0146.
    const scope = this.idScope ?? widgetScopeOf(
      this.field,
      (candidate) => (this.ownerDocument ?? document).querySelector(`[id^="${candidate}-"]`) !== null,
    );
    // The path is data — a document names a nested field `rows.0.name` — and the separator is a class
    // selector to a browser, so an id carrying it cannot be reached by the consumer it was published
    // for. Spelled in the character set an id may hold, as every other piece of data in one is
    // (ADR 0141).
    const safe = idSafeKey(path);
    return scope ? `${scope}-${safe}` : safe;
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
   * The modifier a part wears in one of its states, built from the part's own first class.
   *
   * The first and not the join: a modifier is a suffix on one block, and a part carrying two classes
   * would otherwise produce a name with a space in the middle that no rule can match. Empty when the
   * state is off or the part names no class, so it can be interpolated unguarded.
   */
  protected partStateClass(part: string, state: MdyStateName, on: boolean): string {
    if (!on) return "";
    const parts = MDY_WIDGET_CONTRACTS[this.widgetKind].parts as Readonly<Record<string, { classes: readonly string[] }>>;
    const base = parts[part]?.classes?.[0];
    return base === undefined ? "" : stateClass(base, state);
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
      // A form locked for review looked exactly like one waiting to be filled in, and the only way
      // to find out was to try. The class is declared by the shared state vocabulary; nothing was
      // reading the state that turns it on.
      readonly: handle.readonly(),
    };
    // The box, on the kinds whose value is read inside one. A slider's track *is* its value — there
    // is nothing to look into — and framing it drew a surface around a control that has no inside.
    // Asked of the contract rather than settled here: three renderers each decided separately which
    // kinds wore it, and they disagreed. The element stays; the treatment is what it stops carrying.
    if (MDY_WIDGET_CONTRACTS[this.widgetKind].valueSlot !== "container") return "";
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
    this.nameRadioGroup();
    this.nameSubmissionParts();
    this.syncHiddenSubmission();
    this.watchSilentWrites();

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

  /**
   * Somewhere to stand when this element's control goes out of play under the cursor.
   *
   * Disabling a focused element blurs it — that is the platform — and the person who was typing is
   * then on `body`, their next Tab starting at the top of the page. Read-only keeps the keyboard, so
   * losing it is a choice rather than a fact about browsers.
   *
   * Heard as the focus leaving with nowhere to go: `relatedTarget` is null exactly when the platform
   * took it rather than a person moving it, which is the one case worth acting on. Asked a beat
   * later, because the element is disabled during the render that blurs it and the question is about
   * what happened after.
   */
  private readonly onFocusLost = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    // Focus left this element *for something else on the page*. A widget with an overlay says what
    // to do about that through its own contract, and answers here.
    //
    // `relatedTarget === null` is deliberately not that: re-rendering the element removes whatever
    // was focused and blurs it into nowhere — a calendar cell replaced when the view changes — and
    // reading that as leaving closed the popup on the click that was operating it.
    const isNode = typeof next === "object" && next !== null
      && typeof (next as { nodeType?: unknown }).nodeType === "number";
    // Asked of the contract rather than of the tree: a panel drawn outside this element to escape a
    // scrolling ancestor is still part of the field, and `contains` alone called that a leaving.
    // ADR 0167.
    if (isNode && !focusIsInsideField(this, next as Node)) this.focusLeft();
    if (next !== null) return;
    queueMicrotask(() => {
      if (this.field?.disabled() !== true) return;
      const active = this.ownerDocument.activeElement;
      if (active !== null && active !== this.ownerDocument.body) return;
      keepKeyboardInPlay(this, this.parentElement, { afterBlur: true });
    });
  };

  /**
   * Focus has left this element for somewhere else on the page.
   *
   * A no-op for a control with nothing open. A kind whose contract declares
   * `dismissOnFocusOutside` closes its popup here: a calendar left open behind the field a person
   * has moved on to is a dialog over a page they are trying to use, and the keys they press next
   * reach it instead of the control they are looking at.
   */
  protected focusLeft(): void {}

  /**
   * Tab was pressed inside this element.
   *
   * Focus leaving is not enough to hear it: these popups render *inside* the element, so Tab from
   * the trigger moves into the popup and never crosses the boundary a `focusout` would report. The
   * keyboard table says what Tab means while a kind is open — `cancel` for the four whose overlay
   * has nothing to commit — and this is where a kind answers it.
   */
  protected tabbedAway(): void {}

  private readonly onTabAway = (event: KeyboardEvent): void => {
    if (event.key === "Tab") this.tabbedAway();
  };

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

  private _unbindFormReset: (() => void) | null = null;

  /** Stops watching for values written into this control by something other than the renderer. */
  private _stopWatchingWrites: (() => void) | null = null;

  /**
   * Each control's submission key, for the kinds whose value is spread over more than one.
   *
   * The shared control projection names every control it is bound to, which for a range's two ends
   * and a colour's picker-plus-hex means two controls under one key — and a value sent twice, of
   * which a receiver keeps the first without an error. The contract decides which element gets which
   * key, and clears the ones that carry none.
   */
  private nameSubmissionParts(): void {
    const handle = this.field;
    if (!handle) return;
    const kind = this.widgetKind as MdyWidgetKind;
    if (!(kind in MDY_WIDGET_CONTRACTS)) return;
    applySubmissionNames(this, kind, handle.path);
  }

  /**
   * The values a native submit reads, for the kinds that draw no form control at all.
   *
   * A select is a button and a listbox; a multiselect is a button and a strip of chips. Neither is
   * something a form serialises, so without these inputs the browser sends nothing for the field —
   * not an empty value, nothing. Which kinds need them is the contract's answer, not this file's.
   */
  private syncHiddenSubmission(): void {
    const handle = this.field;
    if (!handle) return;
    const kind = this.widgetKind as MdyWidgetKind;
    if (!(kind in MDY_WIDGET_CONTRACTS) || submissionFor(kind).form !== "hidden") return;
    const value = handle.value();
    syncSubmitValues(this, handle.path, Array.isArray(value) ? value : value === null || value === undefined ? [] : [value], handle.disabled());
  }

  /**
   * The one name a set of radio inputs shares, written after the render.
   *
   * Two jobs in one attribute — it groups the set, and it is the key the answer arrives under — and
   * which one is at stake depends on whether this element has a form around it. Written here rather
   * than in a template because at template time the element may not be in the document yet, and
   * "is there a form around this" has no answer until it is.
   */
  private nameRadioGroup(): void {
    const radios = this.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    if (radios.length === 0) return;
    const handle = this.field;
    if (!handle) return;
    const shared = groupSubmitName(this, handle.path, this.fieldId);
    for (const radio of Array.from(radios)) radio.name = shared;
  }

  /**
   * Watches for values written into this control by something other than the renderer.
   *
   * Session history restoration hands a person their typing back when they press Back, and autofill
   * puts an address into fields nobody touched. Both write the value property and announce nothing,
   * so the field showed one value while the form held another and a submit sent the second.
   *
   * Idempotent, and does nothing until the control exists: called from both the connection and each
   * render, whichever is the first to have something to watch.
   */
  private watchSilentWrites(): void {
    if (this._stopWatchingWrites !== null) return;
    if (this.querySelector("input, textarea, select") === null) return;
    this._stopWatchingWrites = adoptSilentWrites({ root: this });
  }

  /**
   * The reset of a `<form>` this control is inside, answered by returning to the initial value.
   *
   * A consumer's Cancel button is `type="reset"`, and the browser's reset sets each box back to its
   * `value` *attribute* — which this renderer never writes. So the box emptied and the model kept
   * what was typed: a person pressed Cancel, watched the field clear, and submitted the value they
   * believed they had discarded.
   *
   * Every control in the form binds its own, and the form's reset returns all of them — so this runs
   * once per control and does the same thing each time. Idempotent by construction rather than by
   * coordination, which is cheaper than the bookkeeping that would make it run once.
   */
  private bindEnclosingFormReset(): void {
    this._unbindFormReset?.();
    const handle = this.field;
    const form = handle === undefined ? undefined : handleFormOf(handle) as { reset?: () => void } | undefined;
    if (form?.reset === undefined) { this._unbindFormReset = null; return; }
    this._unbindFormReset = bindFormReset({ element: this, reset: () => { form.reset?.(); } });
  }

  override disconnectedCallback(): void {
    this.removeEventListener("focusout", this.onFocusLost);
    this.removeEventListener("keydown", this.onTabAway, true);
    this._unbindFormReset?.();
    this._unbindFormReset = null;
    this._stopWatchingWrites?.();
    this._stopWatchingWrites = null;
    if (this._unboundFrame !== null) {
      cancelAnimationFrame(this._unboundFrame);
      this._unboundFrame = null;
    }
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add(...this.rootClasses);
    this.addEventListener("focusout", this.onFocusLost);
    this.addEventListener("keydown", this.onTabAway, true);
    this.bindEnclosingFormReset();

    // Values written into the control by something that never says so, told to the model.
    //
    // Session history restoration hands a person their typing back when they press Back, and
    // autofill puts an address into fields nobody touched. Both write the value property and
    // announce nothing, so the field showed one value while the form held another.
    //
    // Started only once there are controls to watch. The comparison that catches a history restore
    // reads their values as it begins, so beginning before the first render reads an empty element
    // and catches nothing. An element that reconnects after being moved already has its controls,
    // and must start again here: it does not render a second time, so `updated` never runs.
    this.watchSilentWrites();
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
    /**
     * Drawn even when a document writes no caption, and hidden when it does not.
     *
     * Everything inside a field is named by pointing at this element: a panel's `aria-labelledby`
     * resolves here, and a reference that lands on nothing announces the role and nothing else — two
     * of the dialogs here were "dialog" and no more on a caption-less document. So the element exists
     * always, carries what the resolver chooses, and where those words are the field's own key rather
     * than a person's, it is taken out of sight. A name is owed to a screen reader; a heading is not.
     */
    const written = fieldAccessibleName({
      ariaLabel: this._pendingName,
      label: this.label,
      name: this.field?.path,
    });
    if (!written) return nothing;
    const unwritten = !this.label;
    const filled = this.isFilled(handle);
    const hasError = this.showErrors(handle);
    // The label always carries the id the projections name it by. A popup's inner view is labelled by
    // the field's label — `aria-labelledby="<widget>__label"` — and a label with no id left every one
    // of those references pointing at nothing the moment a person opened the view that uses it.
    return html`<label
      class="${[SHELL.label, ...onlyOn(shellStateClasses({ filled, error: hasError, unwritten }).label)].join(" ")}"
      id=${labelId || `${this.fieldId}__label`}
      for=${labelId ? nothing : forId}
    >
      ${written}
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
        // Pointed at while the container is on the page, not while it holds a message: one reference
        // that never changes, instead of one written when a message arrives and withdrawn when it goes.
        errorsReserved: this.showErrors(handle) || this.errorsReserved(handle),
        // Only where there is something at the other end of the reference.
        descriptionVisible: this.hasDescription(),
        // The key a native submit reads this control's value under: the field's path, not the
        // scoped id this element uses for its DOM references.
        submitName: handle.path,
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
    // The element a person operates, asked of the contract before being guessed at by role. A kind
    // whose control is a plain button — a swatch that opens a palette — matched none of the roles
    // below, so this never named it and the component wrote its own English fallback beside the
    // resolver. The catalogue says which part opens each kind; a list of roles cannot.
    const opener = MDY_POPUP_OPENERS[this.widgetKind]?.opener;
    const control = (opener === undefined ? null : this.querySelector<HTMLElement>(`.${this.partClass(opener)}`))
      ?? this.querySelector<HTMLElement>("input, select, textarea, [role='combobox'], [role='listbox']");
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

  /**
   * The name for a control this element cannot reach imperatively.
   *
   * A group is named by pointing at its caption, and on a document that writes none there is nothing
   * to point at — `aria-labelledby` resolves to `nothing` and the group is announced as its role,
   * which says there is a set of choices here and not what it is asking. The imperative naming above
   * finds a single control; a `role="radiogroup"` is not one of those and cannot be, because naming
   * the group means naming the container rather than any input inside it.
   *
   * So a template asks for the same answer the resolver gives, rather than writing a word beside it.
   */
  /**
   * What a part is called, where no relation points at it.
   *
   * A panel's search box, the second date of a range: a person types in both, and nothing in the
   * contract's relations claims them, so what they are announced as was each renderer's own word —
   * one built a phrase around the caption, another said nothing at all, and a translated page said
   * the English half. `MDY_PART_NAMES` binds the part to the message; this reads the binding rather
   * than the message, so the binding is what a renderer follows and not a comment beside it.
   */
  protected nameOfPart(part: string): string | typeof nothing {
    const key = MDY_PART_NAMES[part];
    const said = key === undefined ? undefined : (this.messages as unknown as Record<string, unknown>)[key];
    return typeof said === "string" && said !== "" ? said : nothing;
  }

  protected fallbackName(): string | typeof nothing {
    return fieldAccessibleName({
      ariaLabel: this._pendingName,
      label: this.label,
      name: this.field?.path,
    }) || nothing;
  }

  /** The name given through the host's `aria-label`, kept once the attribute is taken off it. */
  protected _pendingName: string | null = null;

  /** Id the controllers point `aria-describedby` at when the field has no errors. */
  protected get descriptionId(): string {
    return ID.part(this.fieldId, "description");
  }

  /** The caption's id, through the factory rather than spelled here. */
  protected get labelId(): string {
    return ID.part(this.fieldId, "label");
  }

  /**
   * Which attribute names this control, asked of the contract rather than answered per element.
   *
   * Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so
   * an `aria-label` beside it is text nobody hears — and a control named by neither is announced by
   * its own text, which for a typeable date is whatever was last typed into it. `nothing` where the
   * contract says the attribute is absent, so lit removes it. ADR 0175.
   */
  protected namedBy(): { readonly labelledby: string | typeof nothing; readonly label: string | typeof nothing } {
    const named = fieldNameAttributes({
      ariaLabel: this._pendingName,
      label: this.label,
      name: this.field?.path,
      labelId: this.labelId,
    });
    return {
      labelledby: named["aria-labelledby"] ?? nothing,
      label: named["aria-label"] ?? nothing,
    };
  }

  /** Helper text slot rendered when no block errors are shown. It carries the id the widget
   * contract describes the control by — an unrendered id would leave that reference dangling. */
  /** What this kind says about itself in its own description. Empty unless a kind has something. */
  protected describedState(): string {
    return "";
  }

  /**
   * Whether this element draws a description at all.
   *
   * The reference is only worth making when there is something at the other end: a control naming an
   * empty description sends a reader somewhere to hear nothing, which costs them the move and
   * teaches them not to follow the next one. Asked on every projection, because a host may supply
   * the text after the element was built.
   */
  protected hasDescription(): boolean {
    return Boolean(this.supportingText) || this.describedState() !== ""
      || this.querySelector('[slot="supporting-text"]') !== null;
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

  /**
   * The error list block, and the empty container that holds its place.
   *
   * Present under any field that can fail a rule, and it stays once a message clears. Rendered only
   * when there is something to say, it appears under the field somebody has just left, pushing down
   * the field they are already moving toward; taking the space back on a correction is the same jump,
   * upward. Its contents follow the errors; only the box follows the rules.
   */
  protected renderErrors(handle: MdyFieldHandle<T>): unknown {
    const showing = this.showErrors(handle);
    if (!showing && !this.errorsReserved(handle)) return nothing;
    return html`<ul
      class="${SHELL.errors}"
      id=${this.errorsId}
      aria-live="polite"
    >
      ${showing
        ? [...this.controlErrors(), ...shownErrorsOf(handle).map((er) => er.message)].map(
          (message) => html`<li class="${SHELL.errorItem}">${message}</li>`,
        )
        : nothing}
    </ul>`;
  }

  /**
   * Whether the error container is on the page, whether or not it holds a message.
   *
   * A fact about the field, not about this renderer: the contract declares the container present
   * under any field that can fail a rule, so every renderer answers it the same way from the same
   * predicate rather than each deciding.
   */
  protected errorsReserved(handle: MdyFieldHandle<T>): boolean {
    return fieldCanBeInvalid({
      required: handle.required(), constraints: handle.constraints(), disabled: handle.disabled(),
    });
  }

  /**
   * Single-source host state classes, the contract's own state bindings.
   * Subclasses with extra host modifiers (e.g. `--open`) call this and then
   * toggle their own class.
   */
  protected syncStateClasses(handle: MdyFieldHandle<T>): void {
    // Which class a state carries is the contract's answer, and it names the ones that are *off* as
    // well — so a state that goes away takes its class with it rather than leaving the element saying
    // something that stopped being true.
    for (const [className, isOn] of Object.entries(shellStateClasses({ touched: handle.touched() }).field)) {
      this.classList.toggle(className, isOn);
    }
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
      ${this.renderSupportingText()}
      ${showBlockErrors || this.errorsReserved(handle) ? this.renderErrors(handle) : nothing}
    `;
  }
}

