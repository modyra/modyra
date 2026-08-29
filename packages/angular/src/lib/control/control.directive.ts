import {
  computed,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  afterNextRender,
  inject,
  input,
  InputSignal,
  OnInit,
  Signal,
  signal,
  Injector,
  untracked,
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY, MDY_FLOATING_LABELS, MDY_FORM_ADAPTER, MDY_INLINE_ERRORS } from "../core/tokens";
import { MdyFieldHandle } from "../core/typed-form";
import { angularReactivity } from "../core/reactivity-angular";
import { MdyFieldError, MdyFieldState, MdyFormAdapter } from "../core/types";
import { handleFormOf, NO_CONSTRAINTS, registerHandleOwner, type MdyFieldConstraints } from "@modyra/core";
import type { MdyInteractivity } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  applySubmissionNames,
  groupSubmitName,
  submissionFor,
  submitFalsePart,
  syncSubmitValues,
  createValueWidgetController,
  type MdyValueWidgetController,
  defaultWidgetIdFactory,
  narrowConstraints,
  projectFieldShellA11y,
  type MdyPartContract,
  type MdyValueWidgetIntent,
  type MdyWidgetKind,
  widgetScopeOf,
  idSafeKey,
} from "@modyra/widgets";

declare const ngDevMode: boolean | undefined;
import { MdyPrefixDirective } from "./prefix.directive";
import { MdySuffixDirective } from "./suffix.directive";
import { MdySupportingTextDirective } from "./supporting-text.directive";
import { MDY_FIELD_STATE_CLASSES, blocksValueChange, errorsVisible, fieldAccessibleName, fieldCanBeInvalid, fieldDescribedBy, fieldNameAttributes, fieldShellPartIds, holdsUneditedValue, keepKeyboardInPlay, reportIdCollision, shownErrors, showsAsInvalid, stateClass } from "@modyra/widgets";
import type { MdyValueKind } from "@modyra/core";

/** Global counter for generating unique field IDs. */
let _nextFieldId = 0;

/**
 * Abstract base class for all renderer components.
 *
 * Injects the nearest MdyFormAdapter (provided by MdyFormComponent)
 * and resolves the field state by name. Provides convenience computed
 * signals that concrete renderers bind in their templates.
 */
@Directive({
  host: {
    "[class.mdy-renderer--touched]": "touched()",
    "(focusout)": "onFocusLost($event)",
  },
})
export abstract class MdyBaseControl<TValue = unknown> implements OnInit {
  protected readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _injector = inject(Injector);
  private prefixObserver?: ResizeObserver;
  /** Field name currently claimed on the registry (tracks name changes). */
  private _claimedName: string | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => {
      this.prefixObserver?.disconnect();
      if (this._claimedName !== null) {
        this._declarativeRegistry?.removeField(this._claimedName);
      }
    });
    // Create and claim the field in an effect (side effects belong here, not
    // in the fieldState computed — B8). Claim counting lets the adapter warn
    // on duplicate names and drop state only with the last owner (B9).
    effect(() => {
      const n = this.effectiveName();
      untracked(() => {
        if (this._claimedName === n) return;
        if (this._claimedName !== null) {
          this._declarativeRegistry?.removeField(this._claimedName);
          this._claimedName = null;
        }
        if (!n) {
          if (typeof ngDevMode !== "undefined" && ngDevMode) {
            console.warn(
              "[modyra] Control has neither a name attribute nor a [field] handle.",
            );
          }
          return;
        }
        this.adapter.getField(n);
        this._declarativeRegistry?.claimField(n);
        this._claimedName = n;
      });
    });
    // Each control's submission key, for the kinds whose value is spread over more than one. The
    // shared control projection names every control it is bound to, which for a range's two ends
    // means two controls under one key — a value sent twice, of which a receiver keeps the first
    // without an error.
    effect(() => {
      const kind = this.widgetKind as MdyWidgetKind;
      if (!(kind in MDY_WIDGET_CONTRACTS)) return;
      this.fieldState().value();
      applySubmissionNames(this.hostElement.nativeElement as Element, kind, this.effectiveName());
    });

    // The hidden inputs a select or a multiselect submits through, kept in step with the value.
    // In an effect because the value moves: the inputs are the only thing a form can read for these
    // two kinds, and one left behind sends what was chosen a moment ago.
    effect(() => { this.syncHiddenSubmission(); });

    effect(() => {
      const hasPrefix = !!this.prefix();
      const isFloating = this.isFloatingLabel();

      this.prefixObserver?.disconnect();

      if (hasPrefix && isFloating) {
        if (typeof requestAnimationFrame === "undefined") return; // SSR guard (R2)
        // Aspettiamo che il DOM venga aggiornato dal blocco @if (prefix())
        requestAnimationFrame(() => {
          const host = this.hostElement.nativeElement;
          const prefixEl = host.querySelector('.mdy-input-prefix') as HTMLElement;

          if (prefixEl && typeof ResizeObserver !== 'undefined') {
            this.prefixObserver = new ResizeObserver((entries) => {
              const target = entries[0]?.target as HTMLElement | undefined;
              if (target) {
                // Calcolo esatto perfetto (Larghezza reale nel DOM)
                const width = target.offsetWidth;
                // Impostiamo la variabile CSS sul componente host, delegando il gap al CSS
                host.style.setProperty('--mdy-label-left-offset', `calc(${width}px + var(--mdy-fl-input-padding-with-prefix, 0.75rem))`);
              }
            });
            this.prefixObserver.observe(prefixEl);
          }
        });
      } else {
        this.hostElement.nativeElement.style.removeProperty('--mdy-label-left-offset');
      }
    });
  }
  /**
   * Field name for declarative (`name`-based) mode.
   * Optional when a typed `[field]` handle is bound instead.
   */
  public readonly name: InputSignal<string> = input<string>("");

  /**
   * Typed field handle from an `mdyForm()` schema — the type-safe
   * alternative to the stringly `name` attribute:
   * `<mdy-control-text [field]="form.f.email" />`.
   * Accepts the nullable variant too: adapter fields start as `null`
   * (e.g. Zod-derived handles are `T | null`) and every renderer already
   * treats `null` as "empty". The control only reads the handle's path.
   */
  public readonly field = input<
    MdyFieldHandle<TValue> | MdyFieldHandle<TValue | null> | undefined
  >(undefined);

  /** Resolved adapter path: the handle's path or the `name` input. */
  protected readonly effectiveName: Signal<string> = computed(
    () => this.field()?.path ?? this.name(),
  );

  /**
   * Which form on the page this control belongs to, where a host renders more than one.
   *
   * Unset is the ordinary case. Set, it scopes every id this control publishes, so two forms built
   * from the same document do not both claim `when__label`. A single character neither part may
   * contain joins them, so two distinct scopes cannot produce one id.
   */
  public readonly idScope = input<string>("");

  /** What a control with no field falls back to. Not stable across mounts, because nothing about
   *  such a control is. */
  private readonly mountId = `mdy-control-${MdyBaseControl.nextId()}`;

  /**
   * The id every part of this control is built from.
   *
   * Derived from the field's own path (ADR 0135), so the same document renders the same ids every
   * time: a consumer can write `aria-describedby="when__label"` in their own markup, a stylesheet or
   * a test can name one, and server-rendered markup agrees with a client mount. A mount counter is a
   * property of what else was on the page first, and made every one of those a guess.
   *
   * Two fields called `when` on one page collide, visibly, and that is the better failure: two
   * counters never collide and never mean anything either. `idScope` is what a host with two forms
   * uses to keep them apart.
   */
  protected get fieldId(): string {
    const name = this.effectiveName();
    if (!name) return this.mountId;
    // The form this control's handle belongs to, when no scope was bound: two forms built from one
    // document would otherwise both claim `when__label`, and a reference from the second resolves
    // into the first. ADR 0146.
    const scope = this.idScope() || widgetScopeOf(
      this.field(),
      (candidate) => (this.hostElement.nativeElement as HTMLElement).ownerDocument.querySelector(`[id^="${candidate}-"]`) !== null,
    );
    // The name is a path — a document names a nested field `rows.0.name` — and the separator is a
    // class selector to a browser, so an id carrying it cannot be reached by the consumer it was
    // published for. Spelled in the character set an id may hold, as every other piece of data in
    // one is (ADR 0141).
    const safe = idSafeKey(name);
    return scope ? `${scope}-${safe}` : safe;
  }

  /** The label text for the form control. */
  public readonly label = input<string>("");

  /**
   * The control's name when nothing visible carries it — a cell in a table, a control in a toolbar
   * whose column or icon says what it is to someone who can see it.
   *
   * Read only while `label` is empty. A visible label already names the control natively, and a
   * second name over the top of it is what makes the spoken name disagree with the written one.
   */
  public readonly ariaLabel = input<string | null>(null);

  /**
   * The name on the control element.
   *
   * The explicit one when it is given, otherwise the visible label's text. Naming the control from
   * the label as well as through `for` is redundant on paper and load-bearing in practice: the
   * label element also holds the required marker, so a name computed from its content carries an
   * asterisk the user's word does not — and anything matching on the name exactly, a test or an
   * assistive tool's find-by-name, then misses the control the user is asking for.
   */
  /**
   * What this control is announced as.
   *
   * The order is the contract's: a spoken name a document wrote, the visible label, and the field's
   * own name when there is neither. A control with none of the three is announced as its role and
   * nothing else — a text box, on a form of them — and the field name is the one thing always
   * present, so it is a poor name and better than no name.
   */
  protected readonly controlAriaLabel: Signal<string | null> = computed(
    () => fieldAccessibleName({
      ariaLabel: this.ariaLabel(),
      label: this.label(),
      name: this.effectiveName(),
    }) || null,
  );

  /**
   * Which attribute names this control, asked of the contract rather than answered per renderer.
   *
   * Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so
   * an `aria-label` beside it is text nobody hears — and a renderer writing `aria-label` where the
   * field has a visible caption replaces the words a person is reading with words only a reader
   * hears. ADR 0175.
   */
  protected readonly namedBy: Signal<Readonly<Record<string, string | null>>> = computed(
    () => fieldNameAttributes({
      ariaLabel: this.ariaLabel(),
      label: this.label(),
      name: this.effectiveName(),
      labelId: fieldShellPartIds(this.fieldId).labelId,
    }),
  );

  /** Opt-in or opt-out of floating labels on a per-control basis, overriding the form-level directive. */
  public readonly floatingLabel = input<boolean | undefined>(undefined);

  /**
   * Optional initial value for declarative mode.
   * Takes precedence over [formValue] set on the parent <mdy-form>.
   */
  readonly initialValue = input<unknown>(undefined);

  /**
   * The form this control writes into.
   *
   * Injected optionally so the failure can name the control. Without a form above it, Angular's own
   * error reports the missing token and nothing else — true, and useless in a template with thirty
   * controls in it, because the one that is outside is exactly the one it does not name.
   */
  private readonly _adapterOrNull = inject<MdyFormAdapter<Record<string, unknown>>>(
    MDY_FORM_ADAPTER,
    { optional: true },
  );

  private get adapter(): MdyFormAdapter<Record<string, unknown>> {
    if (this._adapterOrNull) return this._adapterOrNull;
    throw new Error(
      `[modyra] <${this.hostElement.nativeElement.tagName.toLowerCase()}>` +
      `${this._nameForError()} is outside a form. ` +
      "A control writes into the form that encloses it, so it must be a descendant of <mdy-form>; " +
      "a control rendered into an overlay or a dialog body is outside it unless the form element " +
      "wraps that too.",
    );
  }

  /** What identifies this control in a message, when it has said anything about which field it is. */
  private _nameForError(): string {
    const name = untracked(() => this.effectiveName());
    return name ? ` bound to "${name}"` : "";
  }

  private readonly _declarativeRegistry = inject(MDY_DECLARATIVE_REGISTRY, {
    optional: true,
  });

  /** True when MdyInlineErrorsDirective is applied to this element. */
  protected readonly inlineErrors: boolean =
    inject(MDY_INLINE_ERRORS, { self: true, optional: true }) ?? false;

  private readonly globalFloatingLabels = inject(MDY_FLOATING_LABELS, {
    optional: true,
  });

  /** Marks the field as required for assistive technology. */
  readonly ariaRequired = input<boolean>(false);

  /** Marks the field as disabled for assistive technology (auto-derived from field state). */
  readonly ariaDisabled = input<boolean | undefined>(undefined);


  /** Leading content (icon/text) provided via `mdyPrefix` directive. */
  protected readonly prefix = contentChild(MdyPrefixDirective);

  /** Trailing content (icon/text/button) provided via `mdySuffix` directive. */
  protected readonly suffix = contentChild(MdySuffixDirective);

  /** Supporting text (helper text) provided via `mdySupportingText` directive. */
  protected readonly projectedSupportingText = contentChild(MdySupportingTextDirective);

  /**
   * The line under the control, as a value rather than a projected template.
   *
   * Projection is how a hand-written host supplies it; this is how a **document** does. A field
   * declaring `supportingText` had no route to the slot in this adapter, so the words existed in the
   * contract and reached three renderers of four.
   */
  readonly supportingText = input<string | undefined>(undefined);

  /** Whether anything at all wants the description slot — either route. */
  protected readonly hasSupportingText = computed(
    () => !!this.projectedSupportingText() || !!this.supportingText(),
  );

  /**
   * Inert state served while `name`/`[field]` are still unresolved. Input
   * signals are not set during construction, so any computed chained to
   * {@link fieldState} (value, errors, …) must stay readable there instead
   * of throwing; the constructor effect reports controls that are STILL
   * unresolved after init. Per instance — never shared.
   */
  private _detachedState?: MdyFieldState<TValue>;

  private _detached(): MdyFieldState<TValue> {
    if (!this._detachedState) {
      const value = signal(null as TValue);
      const touched = signal(false);
      const dirty = signal(false);
      const off: Signal<boolean> = computed(() => false);
      const interactivity: Signal<MdyInteractivity> = computed(() => "enabled");
      this._detachedState = {
        interactivity,
        value,
        touched,
        dirty,
        required: off,
        // No field, so no rule to read a constraint from.
        constraints: computed(() => NO_CONSTRAINTS),
        valid: computed(() => true),
        errors: computed(() => []),
        disabled: off,
        readonly: off,
        pending: off,
      } as MdyFieldState<TValue>;
    }
    return this._detachedState;
  }

  /**
   * The form that built the bound handle, when it is one this library made and it is not the form
   * enclosing this control. `null` for a `name` binding, a hand-built handle, or the ordinary case
   * of a handle from the enclosing form.
   */
  private _formOfHandle(): MdyFormAdapter<Record<string, unknown>> | null {
    const handle = this.field();
    if (!handle) return null;
    const form = handleFormOf(handle as object);
    if (!form || form === this._adapterOrNull) return null;
    return form as MdyFormAdapter<Record<string, unknown>>;
  }

  /** Resolved field state — reactive to name/[field] changes. */
  protected readonly fieldState: Signal<MdyFieldState<TValue>> = computed(
    () => {
      const n = this.effectiveName();
      if (!n) {
        // Constructor-time read (inputs unresolved) or a control with
        // neither binding: stay inert, the init effect warns on the latter.
        return this._detached();
      }
      // A handle knows which form built it, and that is the form to read. `[field]` names a path,
      // and a path means nothing without its form: two forms on one page share every path they have
      // in common, so resolving against whichever form encloses the control sends what the user
      // types into the wrong one, silently. The enclosing form answers only for `name`.
      const source = this._formOfHandle() ?? this.adapter;
      const ref = source.getField(n);
      if (!ref) {
        // A path inside a keyed collection whose row has not been declared. The control renders
        // empty and binds when the row arrives; it must not be the thing that brings it into being,
        // which is why the adapter answers null rather than creating a field on the way past.
        //
        // Reading `fieldNames` is what makes "when the row arrives" happen: whether the path is
        // open is answered from the collection's own set, which a gate reads without touching a
        // signal, so nothing else here would ever re-ask. The dependency is taken only on the
        // branch that has no field — a bound control depends on its own state and not on every
        // registration in the form.
        source.fieldNames?.();
        return this._detached();
      }
      return ref() as MdyFieldState<TValue>;
    },
  );

  // ── Convenience signals for templates ───────────────────────────────────────

  public readonly value: Signal<TValue> = computed(() =>
    this.fieldState().value(),
  );
  /**
   * The errors this control shows — which is not always the errors the field holds.
   *
   * A field the form is not asking about carries no verdict on screen: the rule belongs to
   * `@modyra/widgets`, and everything below reads it from here, so the wrapper class, the label
   * state, `aria-invalid` and the error list cannot drift apart. The devtools panel deliberately
   * reads the field instead: a debugging view shows the model, not what the user is being asked.
   */
  protected readonly errors: Signal<ReadonlyArray<MdyFieldError>> = computed(() =>
    shownErrors({ disabled: this.isDisabled() }, this.fieldState().errors()),
  );
  protected readonly touched: Signal<boolean> = computed(() =>
    this.fieldState().touched(),
  );
  protected readonly dirty: Signal<boolean> = computed(() =>
    this.fieldState().dirty(),
  );
  protected readonly isDisabled: Signal<boolean> = computed(() =>
    this.fieldState().disabled(),
  );
  /**
   * Read but not written.
   *
   * Angular had no counterpart to `isDisabled`, so no template could bind the native attribute and
   * a field a form had marked read-only kept accepting typing. `dispatchValueIntent` already fed
   * `readonly` to the scalar controller, which meant the blocking half worked while the DOM said
   * nothing — the confusing state this closes.
   */
  protected readonly isReadonly: Signal<boolean> = computed(() =>
    this.fieldState().readonly(),
  );
  protected readonly isValid: Signal<boolean> = computed(() =>
    this.fieldState().valid(),
  );
  protected readonly hasErrors: Signal<boolean> = computed(
    () => this.errors().length > 0,
  );

  /**
   * The messages a person is reading right now, which is not the same list as the ones that exist.
   *
   * `errors` answers *which refusals there are*; this answers *whether they are being told yet*, and
   * a renderer painting a list is asking the second. Bound to the first, every kind printed
   * "required" under a field nobody had answered — while `aria-invalid` beside it said `false`,
   * because that one had been taught the rule and this had not. One field, two verdicts, and the one
   * a sighted person reads was the wrong one.
   *
   * The container stays reserved either way: a message arriving must not push the page down.
   */
  protected readonly errorsOnScreen: Signal<ReadonlyArray<MdyFieldError>> = computed(
    () => (this.errorsRendered() ? this.errors() : []),
  );

  /**
   * Whether the control announces itself as failing — the one answer for `aria-invalid`.
   *
   * Named for the question because eight templates were answering it and one of them answered
   * differently: the colours field waited for `touched`, so a screen-reader user met a control the
   * form was rejecting and the control said nothing was wrong. The rule is the contract's
   * (`showsAsInvalid`: out of play, no verdict), and `errors()` already withholds the errors of a
   * field the form is not asking about — so a template that spells its own combination is a
   * template that can disagree with both.
   */
  protected readonly paintsAsInvalid: Signal<boolean> = computed(() =>
    // Out of play, no verdict — and beyond that, the same answer the error list takes. Every widget
    // projection in the contract writes `aria-invalid` from `errorsVisible`, so a control announcing
    // itself as wrong while nothing on the page says what is wrong is a control saying half of what
    // the contract says. `holdsUnedited` is what keeps the other half honest: a refusal about a
    // value that arrived with the form is spoken straight away, because nobody here caused it by
    // inaction and nobody can see the reason unless it is said.
    showsAsInvalid({ valid: this.isValid(), disabled: this.isDisabled() })
    && errorsVisible(
      {
        disabled: this.isDisabled(),
        touched: this.touched(),
        holdsUnedited: holdsUneditedValue(
          { value: this.value(), dirty: this.dirty() },
          this.widgetKind as MdyValueKind,
        ),
      },
      this.errors(),
    ),
  );
  /**
   * The classes on the wrapper that holds the control, which is where a field shows it is unusable,
   * locked or wrong.
   *
   * Composed here from the contract's own table rather than spelled per template. Every renderer
   * wrote the base class and bound `--disabled` beside it, and none of them bound the other two the
   * contract lists: a field the form had refused looked exactly like one it had accepted, and a
   * field locked for review exactly like one waiting to be filled in. The error class follows
   * `paintsAsInvalid`, the same answer `aria-invalid` takes, so what a theme paints and what a
   * screen reader is told cannot disagree.
   */
  protected readonly wrapperClasses: Signal<string> = computed(() => {
    const base = MDY_FIELD_STATE_CLASSES.control;
    const classes = [base];
    if (this.isDisabled()) classes.push(stateClass(base, "disabled"));
    if (this.isReadonly()) classes.push(stateClass(base, "readonly"));
    if (this.paintsAsInvalid()) classes.push(stateClass(base, "error"));
    return classes.join(" ");
  });

  /**
   * Where the keyboard goes when this field leaves play under it.
   *
   * Disabling a focused element blurs it — that is the platform. What follows is this library's: the
   * person who was typing is on `<body>`, their next Tab starts at the top of the document, and
   * nothing says where they went. A document's rule reaches this without anyone clicking, when a
   * value arriving from a fetch takes the field under the cursor out of play mid-word.
   *
   * `relatedTarget === null` is the only case handled: focus went nowhere rather than to something
   * else on the page. It is read one microtask later because the control is disabled during the
   * render that blurs it, and the question is what happened after.
   */
  protected onFocusLost(event: FocusEvent): void {
    if (event.relatedTarget !== null) return;
    queueMicrotask(() => {
      if (!this.fieldState().disabled()) return;
      const host = this.hostElement.nativeElement;
      const active = host.ownerDocument.activeElement;
      if (active !== null && active !== host.ownerDocument.body) return;
      keepKeyboardInPlay(host, host.parentElement, { afterBlur: true });
    });
  }

  /** Effective aria-disabled: explicit input overrides field state. */
  protected readonly effectiveAriaDisabled: Signal<boolean> = computed(
    () => this.ariaDisabled() ?? this.isDisabled(),
  );

  /**
   * Whether the error list is actually in the DOM.
   *
   * The single condition every renderer template guards the list with, so that anything naming the
   * list — `aria-describedby` above all — cannot disagree with whether it was rendered. An invalid
   * but untouched field is the common case: it has errors and shows none.
   */
  /**
   * Whether the error list is in the DOM, whether or not it holds a message.
   *
   * What the templates guard on. The container is reserved under any field that can fail a rule,
   * because one that appears with the first message pushes down the field below it — the field
   * somebody leaving is moving toward, at the moment they are already moving. It stays once a message
   * clears: taking the space back is the same jump, upward.
   *
   * Distinct from {@link errorsRendered}, which stays "there is something to show". Supporting text
   * is displayed when no errors are, and folding the two together would hide the help at rest under
   * every field with a rule — an error must not take the place of the instruction that prevents it.
   */
  protected readonly errorsReserved: Signal<boolean> = computed(
    () =>
      !this.inlineErrors
      && (this.errorsRendered()
        || fieldCanBeInvalid({
          required: this.isRequired(),
          constraints: this.fieldState().constraints(),
          disabled: this.isDisabled(),
        })),
  );

  protected readonly errorsRendered: Signal<boolean> = computed(
    () =>
      !this.inlineErrors &&
      errorsVisible(
        {
          disabled: this.isDisabled(),
          touched: this.touched(),
          // A value that arrived with the form and has not been edited since: a refusal about it is
          // about something already there, which nobody at this page can have caused by inaction.
          holdsUnedited: holdsUneditedValue(
            { value: this.value(), dirty: this.dirty() },
            this.widgetKind as MdyValueKind,
          ),
        },
        this.fieldState().errors(),
      ),
  );

  /**
   * The same question for a renderer that draws its error text beside the control rather than in a
   * list below it. One of the two is true at a time; both read the one rule, so a renderer cannot
   * show text the other would have hidden.
   */
  protected readonly inlineErrorShown: Signal<boolean> = computed(
    () =>
      this.inlineErrors &&
      errorsVisible(
        {
          disabled: this.isDisabled(),
          touched: this.touched(),
          // A value that arrived with the form and has not been edited since: a refusal about it is
          // about something already there, which nobody at this page can have caused by inaction.
          holdsUnedited: holdsUneditedValue(
            { value: this.value(), dirty: this.dirty() },
            this.widgetKind as MdyValueKind,
          ),
        },
        this.fieldState().errors(),
      ),
  );

  /**
   * The id the supporting-text element carries, or `null` when none is rendered.
   *
   * Bound as `[id]` on that element by every renderer that draws one. Without it the text is
   * rendered, styled, and announced to nobody: a description no reference can reach is invisible to
   * assistive technology however carefully it is worded.
   */
  protected descriptionId(fieldId: string): string | null {
    // Rendered in the branch the error list does not occupy, so the two are never both present.
    // Named whenever it is on the page. It used to be withheld while errors were shown, which is the
    // error taking the place of the help at the moment the help is most useful.
    return this.hasSupportingText() ? defaultWidgetIdFactory.part(fieldId, "description") : null;
  }

  /**
   * The id for `aria-describedby`, or `null` when there is nothing rendered to name.
   *
   * Takes the renderer's own `fieldId`, since each renderer mints one. The error list wins where
   * there is one, the supporting text answers otherwise, and a control with neither describes itself
   * by nothing — never by an id no element holds.
   */
  protected describedById(fieldId: string): string | null {
    // Both, error first — an error does not take the place of the instruction that would have
    // prevented it, and a description is a list. The shared factory mints the ids, so this and the
    // elements it names cannot spell the same relation two ways.
    return fieldDescribedBy({
      errorId: defaultWidgetIdFactory.part(fieldId, "errors"),
      descriptionId: defaultWidgetIdFactory.part(fieldId, "description"),
      errorsPresent: this.errorsReserved(),
      descriptionPresent: this.hasSupportingText(),
    });
  }

  /**
   * The semantic state of this control, as the shared contract projects it.
   *
   * A renderer binding `[mdyPart]="controlPart()"` receives `aria-invalid`, `aria-required`,
   * `aria-disabled` and `aria-describedby` from the shared projection, so no renderer decides for
   * itself which of a widget's states to expose.
   *
   * `errorsVisible` is answered here because the projection cannot know it: these renderers defer
   * the error list until the field is touched, so having errors is not the same as showing them.
   */
  /**
   * The values a native submit reads, for the kinds that draw no form control at all.
   *
   * A select is a button and a listbox; a multiselect is a button and a strip of chips. Neither is
   * something a form serialises, so without these inputs the browser sends nothing for the field —
   * not an empty value, nothing. Which kinds need them is the contract's answer, not this file's.
   */
  private syncHiddenSubmission(): void {
    const kind = this.widgetKind as MdyWidgetKind;
    if (!(kind in MDY_WIDGET_CONTRACTS) || submissionFor(kind).form !== "hidden") return;
    const value = this.fieldState().value();
    syncSubmitValues(
      this.hostElement.nativeElement as Element,
      this.effectiveName(),
      Array.isArray(value) ? value : value === null || value === undefined ? [] : [value],
      this.isDisabled(),
    );
  }

  /**
   * The name a group of radio inputs shares.
   *
   * Two jobs in one attribute — it groups the set, and it is the key the answer arrives under — and
   * which one is at stake depends on whether this control has a form to belong to. Read from the DOM
   * rather than from state, because that is where the answer lives.
   */
  protected groupName(): string {
    return groupSubmitName(this.hostElement.nativeElement as Element, this.effectiveName(), this.fieldId);
  }

  /**
   * The hidden input a boolean field renders ahead of its box.
   *
   * HTML leaves an unchecked box out of the payload altogether, so without this a person who said no
   * and a form that never carried the question arrive identical at the other end. It carries `false`
   * under the field's key; when the box is checked it sends `true` after this one, and the later
   * value is the answer.
   */
  protected readonly submitFalsePart: Signal<MdyPartContract> = computed(
    () => submitFalsePart(this.effectiveName(), { disabled: this.isDisabled(), checked: this.fieldState().value() === true }),
  );

  protected readonly controlPart: Signal<MdyPartContract> = computed(() =>
    projectFieldShellA11y(
      {
        disabled: this.ariaDisabled() ?? this.isDisabled(),
        required: this.ariaRequired() || this.isRequired(),
        readonly: this.isReadonly(),
      },
      this.errors(),
      {
        widgetId: this.fieldId,
        // The kind decides which native constraints its control can carry, and the projection turns
        // the field's rules into those attributes — so a renderer binding this part offers them
        // without naming one, and a renderer that gains a constraint tomorrow needs no edit.
        kind: this.widgetKind,
        constraints: narrowConstraints(this.fieldState().constraints(), this.narrowedConstraints()),
        errorsVisible: this.errorsRendered(),
        // The container is pointed at while it is on the page, not while it holds a message: the
        // templates guard on the same signal, so the reference and the element cannot disagree.
        errorsReserved: this.errorsReserved(),
        // What the control says about itself, which is not the same as which element holds the
        // words: with inline errors there is no list to point at and the field is still refused.
        invalid: this.paintsAsInvalid(),
        // Supporting text is only emitted when a host projects some.
        descriptionVisible: this.hasSupportingText(),
        // The key a native submit reads this control's value under: the field's path, not the
        // scoped id this control uses for its DOM references.
        submitName: this.effectiveName(),
      },
    ).control,
  );


  /**
   * The kind this renderer draws.
   *
   * The projection decides from it which native constraints the control can carry, so a renderer
   * that does not say leaves a slider claiming `maxlength` and offering no range. It was typed
   * `string` and defaulted to text, which is how nine renderers came to inherit an answer none of
   * them meant; the union is what makes a wrong one unspellable.
   */
  protected readonly widgetKind: MdyWidgetKind = "text";


  /**
   * What this renderer asks for on top of the field's rules — nothing, unless it has its own limits
   * to state. It cannot ask for more: the projection takes whichever end is tighter.
   */
  protected narrowedConstraints(): Partial<MdyFieldConstraints> {
    return {};
  }
  /** Whether the field is required (deduced from validators). */
  protected readonly isRequired: Signal<boolean> = computed(() =>
    this.fieldState().required(),
  );
  /** Error messages joined as a single string for inline display. */
  protected readonly inlineErrorText: Signal<string> = computed(() =>
    this.errors()
      .map((e: MdyFieldError) => e.message)
      .filter((msg) => !!msg && msg.trim() !== "")
      .join(", "),
  );

  /** Whether the field should display a floating label. */
  protected readonly isFloatingLabel: Signal<boolean> = computed(() => {
    const local = this.floatingLabel();
    if (local !== undefined) {
      return local;
    }
    return this.globalFloatingLabels?.mdyFloatingLabels() ?? false;
  });

  // ── Widgets scalar-controller bridge ───────────────────────────────────────

  private readonly _valueControllers = new Map<MdyWidgetKind, MdyValueWidgetController<unknown>>();

  /**
   * Sends scalar UI transitions through Widgets. Angular remains responsible
   * only for extracting the native DOM value and applying controller commands
   * to the form adapter.
   */
  protected dispatchValueIntent<T>(kind: MdyWidgetKind, intent: MdyValueWidgetIntent<T>): void {
    // A field that is not in play takes no writes, whatever the DOM still allows. The engine reports
    // a destroyed form's fields as out of play, and a control left on the page after its form ended
    // otherwise kept editing a form that no longer exists.
    if (blocksValueChange(this.fieldState().interactivity())) return;
    let controller = this._valueControllers.get(kind) as MdyValueWidgetController<T> | undefined;
    if (!controller) {
      controller = createValueWidgetController<T>({
        kind,
        value: this.value() as unknown as T,
        onChange: (next) => this.setValue(next as unknown as TValue),
      });
      this._valueControllers.set(kind, controller as MdyValueWidgetController<unknown>);
      this._destroyRef.onDestroy(() => controller?.destroy());
    }
    controller.setValue(this.value() as unknown as T);
    controller.setDisabled(this.isDisabled());
    controller.setReadonly(this.fieldState().readonly());
    controller.setInvalid(showsAsInvalid({ valid: this.isValid(), disabled: this.isDisabled() }));
    for (const command of controller.dispatch(intent)) {
      if (command.type === "mark-dirty") this.markAsDirty();
      if (command.type === "mark-touched") this.markAsTouched();
    }
  }

  /**
   * The kind's own controller, built the first time this renderer needs it.
   *
   * Deferred rather than built in `ngOnInit`, because a field initializer is an injection context
   * and `ngOnInit` is not — and because six renderers each writing the same lifecycle is the
   * duplication that adopting a shared controller was supposed to remove, not relocate.
   */
  protected adoptFieldController<TController extends { destroy(): void }>(
    create: (handle: MdyFieldHandle<TValue | null>, widgetId: string) => TController,
    sync?: (controller: TController) => void,
  ): () => TController | undefined {
    let controller: TController | undefined;
    let built = false;
    // Built outside any reactive context: the first read can come from a computed, and an effect
    // created inside one is a nested effect Angular refuses (NG0602). Nothing here should be a
    // dependency of the caller either — the controller is built once, not per recomputation.
    return () =>
      untracked(() => {
        if (built) return controller;
        const handle = this.controllerHandle();
        // Not built until there is a handle to build on. Latching before the check made the first
        // read the only one: a renderer whose template reads the controller during the first change
        // detection — before a name resolves to a field — cached `undefined` for the life of the
        // component, and every later interaction went nowhere.
        if (!handle) return undefined;
        built = true;
        controller = create(handle, this.fieldId);
        this._destroyRef.onDestroy(() => controller?.destroy());
        // What a reactive input feeds the controller — an option list, a pair of bounds. Told
        // rather than rebuilt: a fresh controller forgets the query, the roving focus and the month
        // on screen. The injector is passed because the first read is not an injection context.
        if (sync) effect(() => sync(controller as TController), { injector: this._injector });
        return controller;
      });
  }

  /**
   * A handle for the control to build its controller on, however the field was named.
   *
   * `[field]` hands one over. The `name` form does not — it resolves to the registry's state — and
   * for want of a handle every renderer kept a second way to commit its value, so the kind's
   * controller decided for one caller and the renderer decided for the other. The state carries
   * everything a handle exposes; what was missing was the shape, and the shape is written once.
   *
   * Registered against Angular's own runtime, because a controller resolves the runtime that owns
   * its handle: a synthetic one nobody claims would be observed by a vanilla runtime that cannot
   * see an Angular signal, and would render once and then never again.
   */
  private _syntheticHandle: MdyFieldHandle<TValue | null> | undefined;
  private controllerHandle(): MdyFieldHandle<TValue | null> | undefined {
    const bound = this.field();
    if (bound) return bound as MdyFieldHandle<TValue | null>;
    if (!this.effectiveName()) return undefined;
    if (!this._syntheticHandle) {
      const state = () => this.fieldState();
      const handle: MdyFieldHandle<TValue | null> = {
        get path() { return "" as string; },
        value: computed(() => state().value() as TValue | null),
        errors: computed(() => state().errors()),
        touched: computed(() => state().touched()),
        dirty: computed(() => state().dirty()),
        valid: computed(() => state().valid()),
        pending: computed(() => state().pending()),
        required: computed(() => state().required()),
        constraints: computed(() => state().constraints()),
        interactivity: computed(() => state().interactivity()),
        disabled: computed(() => state().disabled()),
        readonly: computed(() => state().readonly()),
        set: (value) => this.setValue(value as TValue),
        markAsTouched: () => this.markAsTouched(),
        markAsDirty: () => this.markAsDirty(),
        reportEntry: (problem: string | null) => this.reportEntry(problem),
      };
      // The *owner* registry, not the form one: `observerFor` reads this to decide which runtime a
      // controller should observe the handle through. Registered in the wrong one, the controller
      // fell back to a vanilla runtime whose signals an Angular computed cannot see — so its state
      // changed and nothing re-rendered, which is the failure this registry exists to prevent.
      registerHandleOwner(handle, angularReactivity(this._injector));
      this._syntheticHandle = handle;
    }
    return this._syntheticHandle;
  }

  protected dispatchValueBlur(kind: MdyWidgetKind): void {
    this.dispatchValueIntent(kind, { type: "blur" });
  }

  /**
   * The touched and dirty callbacks a widget runtime takes, answered by the owner of the value.
   *
   * A renderer that answers them itself has taken a decision the controller exists to make, and the
   * next renderer will not take it the same way. The runtime asks; this is who it reaches.
   */
  protected valueOwnerCallbacks(): { readonly onTouched: () => void; readonly onDirty: () => void } {
    return { onTouched: () => this.markAsTouched(), onDirty: () => this.markAsDirty() };
  }

  /** Applies non-user synchronization without dirty/touched side effects. */
  protected synchronizeValue(value: TValue): void {
    this.setValue(value);
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────

  public setValue(newValue: TValue): void {
    this.fieldState().value.set(newValue);
  }

  protected markAsTouched(): void {
    this.fieldState().touched.set(true);
  }

  protected markAsDirty(): void {
    this.fieldState().dirty.set(true);
  }

  /**
   * An entry the control could not read, said to the form.
   *
   * Resolved against the same form the state came from — a path means nothing without its form —
   * and silently ignored when the control is not bound, which is the state a detached control is in
   * before its name resolves.
   */
  protected reportEntry(problem: string | null): void {
    const name = this.effectiveName();
    if (!name) return;
    const source = this._formOfHandle() ?? this.adapter;
    source.reportEntry(name, problem);
  }

  /** Generate a unique ID for template label/input association. */
  protected static nextId(): number {
    return _nextFieldId++;
  }

  ngOnInit(): void {
    const iv = this.initialValue();
    const n = this.effectiveName();
    if (this._declarativeRegistry && iv !== undefined && n) {
      this._declarativeRegistry.setInitialValue(n, iv);
    }
    // After the render that put this control's ids in the document: two forms built from one
    // document claim one set of them unless the host scopes them, and silent that is worse than
    // either — every reference resolves into whichever rendered last.
    if (typeof ngDevMode !== "undefined" && ngDevMode) {
      afterNextRender(
        // Both doors, because the advice is only ever right for half the audience otherwise: a
        // consumer assembling controls binds the scope on them, and a consumer of the dynamic form
        // component places no controls at all — it binds the scope on the form.
        () => reportIdCollision(
          this.hostElement.nativeElement,
          "Bind `[idScope]` on each form — on `<mdy-dynamic-form>` where a document renders itself, " +
          "or on the controls where you place them yourself.",
        ),
        { injector: this._injector },
      );
    }
  }


}
