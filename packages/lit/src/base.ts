import { MdyFieldHandle, type MdyFieldConstraints } from "@modyra/core";
import { MDY_ICONS } from "@modyra/widgets";
import { html, LitElement, nothing, PropertyDeclarations } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import {
  MDY_FIELD_SHELL_CLASSES as SHELL,
  MDY_WIDGET_CONTRACTS,
  defaultWidgetIdFactory as ID,
  popupAlignmentClass,
  popupPlacementClass,
  projectFieldShellA11y,
  shownErrorsOf,
  type MdyOverlayAlignment,
  type MdyOverlayPlacement,
  type MdyPartContract,
  type MdyPopupWidgetKind,
  type MdyWidgetKind,
} from "@modyra/widgets";
import { MdyFormController } from "./adapter.js";
import { narrowConstraints } from "@modyra/widgets";

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
    inlineErrors: { type: Boolean, attribute: "inline-errors" },
    floatingLabel: { type: Boolean, attribute: "floating-label" },
  };

  declare field: MdyFieldHandle<T> | undefined;
  declare label: string;
  declare inlineErrors: boolean;
  declare floatingLabel: boolean;

  protected readonly fieldId = `mdy-field-${nextId++}`;
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

  /** Class list for one of this widget's contract parts. Adapters must not invent equivalents. */
  protected partClass(part: string): string {
    const parts = MDY_WIDGET_CONTRACTS[this.widgetKind].parts as Readonly<Record<string, { classes: readonly string[] }>>;
    return (parts[part]?.classes ?? []).join(" ");
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
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add(...this.rootClasses);
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

  protected showErrors(handle: MdyFieldHandle<T>): boolean {
    return handle.touched() && shownErrorsOf(handle).length > 0;
  }

  /** Whether the field currently holds a value (drives label styling). */
  protected isFilled(handle: MdyFieldHandle<T>): boolean {
    const v = handle.value();
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }

  /** Error text joined for inline display. */
  protected inlineErrorText(handle: MdyFieldHandle<T>): string {
    return shownErrorsOf(handle)
      .map((e) => e.message)
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
    return html`<label
      class="${SHELL.label} ${filled ? `${SHELL.label}--filled` : ""} ${hasError ? `${SHELL.label}--has-error` : ""}"
      id=${labelId || nothing}
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
      { disabled: handle.disabled(), required: handle.required() },
      shownErrorsOf(handle),
      {
        widgetId: this.fieldId,
        kind: this.widgetKind,
        // The field's rules, narrowed by whatever this element asks for. One place composes them,
        // and the part carries the result — so no element names an attribute.
        constraints: narrowConstraints(handle.constraints(), this.narrowedConstraints()),
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
    const name = this._pendingName || this.label;
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
  protected renderSupportingText(): unknown {
    return html`<div class="${SHELL.supportingText}" id=${this.descriptionId}><slot name="supporting-text"></slot></div>`;
  }

  /** Error list block (rendered only once the field was touched). */
  protected renderErrors(handle: MdyFieldHandle<T>): unknown {
    if (!this.showErrors(handle)) return nothing;
    return html`<ul
      class="${SHELL.errors}"
      id=${this.errorsId}
      aria-live="polite"
    >
      ${shownErrorsOf(handle).map(
        (er) => html`<li class="${SHELL.errorItem}">${er.message}</li>`,
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
          class="${SHELL.inputWrapper} ${handle.disabled() ? `${SHELL.inputWrapper}--disabled` : ""}"
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

